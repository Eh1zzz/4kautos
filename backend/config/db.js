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
      featured    BOOLEAN       NOT NULL DEFAULT FALSE,
      seller_id   INT           NOT NULL,
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (\`condition\` IN ('excellent','good','fair','poor')),
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

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
