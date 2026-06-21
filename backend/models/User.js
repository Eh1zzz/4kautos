import { pool } from '../config/db.js';
import { toId } from '../utils/validation.js';

const SAFE_COLS = 'id, name, email, role, verified, email_verified, created_at';

export async function findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ?',
    [email.toLowerCase().trim()]
  );
  return rows[0] || null;
}

/* ── Password reset ── */
export async function setResetToken(userId, tokenHash, expires) {
  await pool.query(
    'UPDATE users SET reset_token_hash = ?, reset_expires = ? WHERE id = ?',
    [tokenHash, expires, userId]
  );
}

export async function findByResetToken(tokenHash) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE reset_token_hash = ? AND reset_expires > NOW()',
    [tokenHash]
  );
  return rows[0] || null;
}

export async function updatePassword(userId, hashedPassword) {
  await pool.query(
    'UPDATE users SET password = ?, reset_token_hash = NULL, reset_expires = NULL WHERE id = ?',
    [hashedPassword, userId]
  );
}

/* ── Email verification ── */
export async function setVerifyToken(userId, tokenHash, expires) {
  await pool.query(
    'UPDATE users SET verify_token_hash = ?, verify_expires = ? WHERE id = ?',
    [tokenHash, expires, userId]
  );
}

export async function findByVerifyToken(tokenHash) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE verify_token_hash = ? AND verify_expires > NOW()',
    [tokenHash]
  );
  return rows[0] || null;
}

export async function markEmailVerified(userId) {
  await pool.query(
    'UPDATE users SET email_verified = 1, verify_token_hash = NULL, verify_expires = NULL WHERE id = ?',
    [userId]
  );
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

/* ── Seller payout details (multi-rail: NG bank or international) ── */
export async function getPayout(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const [rows] = await pool.query(
    `SELECT payout_method, bank_code, account_number, account_name,
            payout_country, payout_currency, payout_details
     FROM users WHERE id = ?`,
    [numId]
  );
  const p = rows[0];
  if (!p) return null;
  // Back-compat: an NG bank saved before payout_method existed.
  if (!p.payout_method && p.bank_code) p.payout_method = 'ng_bank';
  return p;
}

export async function setPayout(id, p = {}) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  await pool.query(
    `UPDATE users SET payout_method = ?, bank_code = ?, account_number = ?, account_name = ?,
            payout_country = ?, payout_currency = ?, payout_details = ?
     WHERE id = ?`,
    [p.method || null, p.bankCode || null, p.accountNumber || null, p.accountName || null,
     p.country || null, p.currency || null, p.details || null, numId]
  );
  return getPayout(numId);
}
