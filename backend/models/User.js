import { pool } from '../config/db.js';
import { toId } from '../utils/validation.js';

const SAFE_COLS = 'id, name, email, role, verified, created_at';

export async function findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ?',
    [email.toLowerCase().trim()]
  );
  return rows[0] || null;
}

export async function findById(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const [rows] = await pool.query(
    `SELECT ${SAFE_COLS} FROM users WHERE id = ?`,
    [numId]
  );
  return rows[0] || null;
}

export async function create(name, email, hashedPassword, role) {
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [name, email.toLowerCase().trim(), hashedPassword, role]
  );
  return findById(result.insertId);
}

export async function findAll() {
  const [rows] = await pool.query(
    `SELECT ${SAFE_COLS} FROM users ORDER BY created_at DESC LIMIT 500`
  );
  return rows;
}

export async function verifyById(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const [result] = await pool.query(
    'UPDATE users SET verified = TRUE WHERE id = ?',
    [numId]
  );
  if (result.affectedRows === 0) return null;
  return findById(numId);
}

export async function deleteById(id) {
  const numId = toId(id);
  if (!numId) return null;
  // transactions have no ON DELETE CASCADE, so clear them first; the user's
  // cars and messages are removed automatically by their FK cascades.
  await pool.query('DELETE FROM transactions WHERE buyer_id = ? OR seller_id = ?', [numId, numId]);
  const [result] = await pool.query('DELETE FROM users WHERE id = ?', [numId]);
  return result.affectedRows > 0 ? { id: numId } : null;
}
