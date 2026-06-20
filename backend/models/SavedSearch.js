import { pool } from '../config/db.js';
import { toId } from '../utils/validation.js';

function normalize(row) {
  if (row && typeof row.filters === 'string') {
    try { row.filters = JSON.parse(row.filters); } catch { row.filters = {}; }
  }
  if (row && row.filters == null) row.filters = {};
  return row;
}

export async function create(userId, label, filters) {
  const [r] = await pool.query(
    'INSERT INTO saved_searches (user_id, label, filters) VALUES (?,?,?)',
    [userId, label, JSON.stringify(filters || {})]
  );
  const [rows] = await pool.query('SELECT * FROM saved_searches WHERE id = ?', [r.insertId]);
  return normalize(rows[0]);
}

export async function findByUser(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
    [userId]
  );
  return rows.map(normalize);
}

export async function countByUser(userId) {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM saved_searches WHERE user_id = ?', [userId]);
  return Number(n);
}

export async function deleteByIdAndUser(id, userId) {
  const numId = toId(id);
  if (!numId) return null;
  const [r] = await pool.query('DELETE FROM saved_searches WHERE id = ? AND user_id = ?', [numId, userId]);
  return r.affectedRows > 0 ? { id: numId } : null;
}
