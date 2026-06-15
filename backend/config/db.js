import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes('localhost') &&
    !process.env.DATABASE_URL.includes('127.0.0.1')
      ? { rejectUnauthorized: false }
      : false,
});

export async function connectDB() {
  await pool.query('SELECT 1'); // verify connection

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255)  NOT NULL,
      email       VARCHAR(255)  UNIQUE NOT NULL,
      password    VARCHAR(255)  NOT NULL,
      role        VARCHAR(20)   NOT NULL DEFAULT 'buyer'
                  CHECK (role IN ('buyer','seller','admin')),
      verified    BOOLEAN       NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cars (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(255),
      make        VARCHAR(100),
      model       VARCHAR(100),
      year        INTEGER       CHECK (year >= 1900),
      mileage     INTEGER       CHECK (mileage >= 0),
      vin         VARCHAR(100),
      condition   VARCHAR(20)   NOT NULL DEFAULT 'good'
                  CHECK (condition IN ('excellent','good','fair','poor')),
      description TEXT,
      photos      TEXT[]        NOT NULL DEFAULT '{}',
      price       NUMERIC(15,2) CHECK (price >= 0),
      featured    BOOLEAN       NOT NULL DEFAULT false,
      seller_id   INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          SERIAL PRIMARY KEY,
      buyer_id    INTEGER       NOT NULL REFERENCES users(id),
      seller_id   INTEGER       NOT NULL REFERENCES users(id),
      car_id      INTEGER       REFERENCES cars(id) ON DELETE SET NULL,
      status      VARCHAR(30)   NOT NULL DEFAULT 'initiated'
                  CHECK (status IN ('initiated','pending_inspection','payment_in_escrow','completed','cancelled','disputed')),
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
  `);

  console.log('✅ PostgreSQL connected and tables ready');
}
