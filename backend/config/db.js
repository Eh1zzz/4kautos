import mysql  from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export const pool = mysql.createPool(
  process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/4kautos'
);

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

  // Indexes for the columns we filter/sort on (seller_id is already indexed by its FK).
  await ensureIndex('cars', 'idx_cars_created',   'created_at');
  await ensureIndex('cars', 'idx_cars_body_type', 'body_type');
  await ensureIndex('cars', 'idx_cars_price',     'price');
  await ensureIndex('cars', 'idx_cars_mileage',   'mileage');
  await ensureIndex('cars', 'idx_cars_condition', '`condition`');
  await ensureIndex('messages', 'idx_msg_thread', 'car_id, buyer_id');

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
  await ensureColumn('transactions', 'payout_status', 'VARCHAR(20)');

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
  }
}
