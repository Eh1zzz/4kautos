import mysql  from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

/* ── Connection pool ──────────────────────────────────────────────────────────
   Parse DATABASE_URL into a config object so the pool is TUNABLE (mysql2's
   string form can't take extra options). The key knob for horizontal scaling is
   `connectionLimit`: keep  replicas × connectionLimit  under MySQL
   `max_connections`, or a traffic spike across replicas exhausts the DB (a
   classic outage). Defaults preserve today's behavior (limit 10); set
   DB_POOL_SIZE to tune. Falls back to the raw connection string if the URL
   can't be parsed, so this never breaks an exotic DSN. */
const DSN = process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/4kautos';

function buildPoolConfig(dsn) {
  const tuning = {
    connectionLimit: Math.max(Number(process.env.DB_POOL_SIZE) || 10, 1),
    queueLimit:      Math.max(Number(process.env.DB_QUEUE_LIMIT) || 0, 0),
    enableKeepAlive: true,        // keep idle pooled sockets alive (PaaS proxies drop them)
    keepAliveInitialDelay: 10_000,
  };
  try {
    const u = new URL(dsn);
    if (!/^mysql/i.test(u.protocol)) return dsn; // not a mysql URL → hand back as-is
    const cfg = {
      host:     u.hostname,
      port:     u.port ? Number(u.port) : 3306,
      user:     decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, '')) || undefined,
      ...tuning,
    };
    // Managed MySQL (PlanetScale, some Railway public endpoints) requires TLS.
    if (process.env.DB_SSL === 'true' || /^(REQUIRED|true)$/i.test(u.searchParams.get('ssl-mode') || u.searchParams.get('ssl') || ''))
      cfg.ssl = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
    return cfg;
  } catch {
    return dsn; // unparseable DSN → preserve the original string-based behavior
  }
}

export const pool = mysql.createPool(buildPoolConfig(DSN));

/* Whether the cars FULLTEXT index exists. Car.findAll reads this (a live ESM
   binding) to decide between an indexed MATCH..AGAINST search and the LIKE
   fallback — so a DB where the index couldn't be created never errors. */
export let fulltextReady = false;

let sweepTimer = null; // module-level so repeated connectDB() calls (tests) don't stack timers

export async function connectDB() {
  await pool.query('SELECT 1'); // verify connection

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          INT           AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(255)  NOT NULL,
      email       VARCHAR(255)  NOT NULL UNIQUE,
      password    VARCHAR(255)  NOT NULL,
      role        VARCHAR(20)   NOT NULL DEFAULT 'buyer',
      verified    BOOLEAN       NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (role IN ('buyer','seller','admin'))
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cars (
      id          INT           AUTO_INCREMENT PRIMARY KEY,
      title       VARCHAR(255),
      make        VARCHAR(100),
      model       VARCHAR(100),
      year        INT,
      mileage     INT,
      vin         VARCHAR(100),
      \`condition\` VARCHAR(20)  NOT NULL DEFAULT 'good',
      description TEXT,
      photos      JSON,
      price       DECIMAL(15,2),
      currency    VARCHAR(3)    NOT NULL DEFAULT 'NGN',
      body_type   VARCHAR(40),
      location    VARCHAR(160),
      latitude    DECIMAL(9,6),
      longitude   DECIMAL(9,6),
      featured    BOOLEAN       NOT NULL DEFAULT FALSE,
      seller_id   INT           NOT NULL,
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (\`condition\` IN ('excellent','good','fair','poor')),
      CHECK (currency IN ('NGN','USD')),
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migrate databases created before these columns existed.
  // (MySQL has no ADD COLUMN IF NOT EXISTS, so check information_schema first.)
  await ensureColumn('cars', 'currency',  "VARCHAR(3) NOT NULL DEFAULT 'NGN'");
  await ensureColumn('cars', 'body_type', 'VARCHAR(40)');
  await ensureColumn('cars', 'location',  'VARCHAR(160)');
  await ensureColumn('cars', 'latitude',  'DECIMAL(9,6)');
  await ensureColumn('cars', 'longitude', 'DECIMAL(9,6)');

  // Extended vehicle specs (Phase 1).
  await ensureColumn('cars', 'ext_color',        'VARCHAR(40)');
  await ensureColumn('cars', 'int_color',        'VARCHAR(40)');
  await ensureColumn('cars', 'engine',           'VARCHAR(80)');
  await ensureColumn('cars', 'transmission',     'VARCHAR(20)');
  await ensureColumn('cars', 'drivetrain',       'VARCHAR(20)');
  await ensureColumn('cars', 'mpg',              'VARCHAR(30)');
  await ensureColumn('cars', 'horsepower',       'INT');
  await ensureColumn('cars', 'seats',            'INT');
  await ensureColumn('cars', 'towing_capacity',  'VARCHAR(40)');
  await ensureColumn('cars', 'comfort_features', 'JSON');
  await ensureColumn('cars', 'safety_features',  'JSON');
  await ensureColumn('cars', 'modifications',    'JSON');
  // Mechanical disclosures (seller-entered condition criteria; not shown publicly).
  await ensureColumn('cars', 'accident_history', 'VARCHAR(8)');     // 'yes' | 'no'
  await ensureColumn('cars', 'inspection_report', 'VARCHAR(512)');  // file URL (future upload)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          INT           AUTO_INCREMENT PRIMARY KEY,
      buyer_id    INT           NOT NULL,
      seller_id   INT           NOT NULL,
      car_id      INT,
      status      VARCHAR(30)   NOT NULL DEFAULT 'initiated',
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (status IN ('initiated','pending_inspection','payment_in_escrow','completed','cancelled','disputed')),
      FOREIGN KEY (buyer_id)  REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (car_id)    REFERENCES cars(id) ON DELETE SET NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id          INT           AUTO_INCREMENT PRIMARY KEY,
      car_id      INT,
      buyer_id    INT           NOT NULL,
      seller_id   INT           NOT NULL,
      sender_id   INT           NOT NULL,
      body        VARCHAR(2000) NOT NULL,
      read_at     TIMESTAMP     NULL,
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (buyer_id)  REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (car_id)    REFERENCES cars(id)  ON DELETE SET NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id          INT           AUTO_INCREMENT PRIMARY KEY,
      email       VARCHAR(255)  NOT NULL UNIQUE,
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS saved_searches (
      id         INT          AUTO_INCREMENT PRIMARY KEY,
      user_id    INT          NOT NULL,
      label      VARCHAR(160) NOT NULL,
      filters    JSON         NOT NULL,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id         INT           AUTO_INCREMENT PRIMARY KEY,
      name       VARCHAR(120)  NOT NULL,
      email      VARCHAR(255)  NOT NULL,
      message    VARCHAR(4000) NOT NULL,
      created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Indexes for the columns we filter/sort on (seller_id is already indexed by its FK).
  await ensureIndex('cars', 'idx_cars_created',   'created_at');
  await ensureIndex('cars', 'idx_cars_body_type', 'body_type');
  await ensureIndex('cars', 'idx_cars_price',     'price');
  await ensureIndex('cars', 'idx_cars_mileage',   'mileage');
  await ensureIndex('cars', 'idx_cars_condition', '`condition`');
  await ensureIndex('messages', 'idx_msg_thread', 'car_id, buyer_id');

  // FULLTEXT index for the free-text catalogue search. A leading-wildcard
  // `LIKE '%q%'` can't use a B-tree index (full scan); MATCH..AGAINST against
  // this index scales. Best-effort — if it can't be created the app keeps
  // working via the LIKE fallback (gated by the fulltextReady flag).
  fulltextReady = await ensureFulltextIndex();

  // Escrow / payments (Flutterwave) — snapshot of what was charged + provider refs.
  await ensureColumn('transactions', 'amount',      'DECIMAL(15,2)');
  await ensureColumn('transactions', 'currency',    "VARCHAR(3) NOT NULL DEFAULT 'NGN'");
  await ensureColumn('transactions', 'payment_ref', 'VARCHAR(64)'); // our tx_ref sent to Flutterwave
  await ensureColumn('transactions', 'flw_tx_id',   'VARCHAR(64)'); // Flutterwave's id (idempotency)
  await ensureColumn('transactions', 'paid_at',     'TIMESTAMP NULL');
  await ensureIndex('transactions', 'idx_tx_payment_ref', 'payment_ref');

  // Seller payout details (for releasing escrow via Flutterwave transfers) + the
  // payout transfer reference on the transaction.
  await ensureColumn('users', 'bank_code',      'VARCHAR(10)');
  await ensureColumn('users', 'account_number', 'VARCHAR(20)');
  await ensureColumn('users', 'account_name',   'VARCHAR(120)');
  await ensureColumn('transactions', 'transfer_ref', 'VARCHAR(64)');

  // Multi-rail payouts: payout method + international fields, and the per-release
  // payout status ('transferred' = auto via Flutterwave, 'pending'/'paid' = manual).
  await ensureColumn('users', 'payout_method',   'VARCHAR(20)');
  await ensureColumn('users', 'payout_country',  'VARCHAR(60)');
  await ensureColumn('users', 'payout_currency', 'VARCHAR(3)');
  await ensureColumn('users', 'payout_details',  'VARCHAR(500)');

  // Password reset (hashed, single-use, time-limited token).
  await ensureColumn('users', 'reset_token_hash', 'VARCHAR(64)');
  await ensureColumn('users', 'reset_expires',    'DATETIME');
  await ensureColumn('transactions', 'payout_status', 'VARCHAR(20)');

  // Email verification (separate from the admin-set `verified` KYC flag). The
  // login wall is only enforced when an email driver is configured; until then
  // accounts are auto-verified at signup so $0/no-email mode isn't locked out.
  const addedEmailVerified = await ensureColumn('users', 'email_verified', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('users', 'verify_token_hash', 'VARCHAR(64)');
  await ensureColumn('users', 'verify_expires',    'DATETIME');
  // Grandfather every pre-existing account the first time this column appears, so
  // turning on email later never walls out users who signed up before this.
  if (addedEmailVerified) await pool.query('UPDATE users SET email_verified = 1');

  // Buyer's saved location/locale (e.g. "Accra, Ghana") — personalises landed-cost
  // estimates and feeds the localized shipping resolver.
  await ensureColumn('users', 'location', 'VARCHAR(160)');

  // Idempotency keys for replay-safe money mutations. The PK is the atomic lock:
  // a reserved-but-unfinished row (status_code NULL) means "in progress".
  await pool.query(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id_key      VARCHAR(80)  PRIMARY KEY,
      scope       VARCHAR(160),
      status_code INT,
      response    MEDIUMTEXT,
      created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // TTL sweep for idempotency keys (only useful for minutes): once at boot,
  // then every 6h — a long-lived instance otherwise grows the table forever.
  // unref() so the timer never keeps the process (or the test runner) alive.
  const sweepIdempotencyKeys = () =>
    pool.query('DELETE FROM idempotency_keys WHERE created_at < (NOW() - INTERVAL 2 DAY)').catch(() => {});
  await sweepIdempotencyKeys();
  if (!sweepTimer) sweepTimer = setInterval(sweepIdempotencyKeys, 6 * 60 * 60 * 1000).unref();

  console.log('✅ MySQL connected and tables ready');
}

/** Create an index only if it is missing (MySQL has no CREATE INDEX IF NOT EXISTS). */
async function ensureIndex(table, indexName, columns) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName]
  );
  if (rows.length === 0) {
    await pool.query(`CREATE INDEX \`${indexName}\` ON \`${table}\` (${columns})`);
    console.log(`🔧 Index added: ${table}.${indexName}`);
  }
}

/** Create the cars FULLTEXT index if missing. Returns whether it's present
 *  afterwards (false if creation failed — caller falls back to LIKE). */
async function ensureFulltextIndex() {
  try {
    const [rows] = await pool.query(
      `SELECT 1 FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'cars' AND index_name = 'ft_cars_search'`
    );
    if (rows.length) return true;
    await pool.query('ALTER TABLE cars ADD FULLTEXT INDEX ft_cars_search (make, model, title, description)');
    console.log('🔧 FULLTEXT index added: cars.ft_cars_search');
    return true;
  } catch (err) {
    console.warn('FULLTEXT index unavailable — search uses LIKE fallback:', err.message);
    return false;
  }
}

/** Add a column only if it is missing — a tiny idempotent migration helper. */
async function ensureColumn(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  if (rows.length === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`🔧 Migrated: added ${table}.${column}`);
    return true; // column was newly added
  }
  return false;
}
