import { pool } from '../config/db.js';

const SAFE_COLS = 'id, name, email, role, verified, created_at';

export async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );
  return rows[0] || null;
}

export async function findById(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const { rows } = await pool.query(
    `SELECT ${SAFE_COLS} FROM users WHERE id = $1`,
    [numId]
  );
  return rows[0] || null;
}

export async function create(name, email, hashedPassword, role) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SAFE_COLS}`,
    [name, email.toLowerCase().trim(), hashedPassword, role]
  );
  return rows[0];
}

export async function findAll() {
  const { rows } = await pool.query(
    `SELECT ${SAFE_COLS} FROM users ORDER BY created_at DESC`
  );
  return rows;
}

export async function verifyById(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const { rows } = await pool.query(
    `UPDATE users SET verified = true WHERE id = $1 RETURNING ${SAFE_COLS}`,
    [numId]
  );
  return rows[0] || null;
}
