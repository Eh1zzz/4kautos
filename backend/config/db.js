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

  console.log('✅ MySQL connected and tables ready');
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
