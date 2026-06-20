import { pool } from '../config/db.js';
import { toId } from '../utils/validation.js';

export async function create({ name, email, message }) {
  const [r] = await pool.query(
    'INSERT INTO contact_messages (name, email, message) VALUES (?,?,?)',
    [name, email, message]
  );
  const [rows] = await pool.query('SELECT * FROM contact_messages WHERE id = ?', [r.insertId]);
  return rows[0];
}

export async function findAll() {
  const [rows] = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 500');
  return rows;
}

export async function deleteById(id) {
  const numId = toId(id);
  if (!numId) return null;
  const [r] = await pool.query('DELETE FROM contact_messages WHERE id = ?', [numId]);
  return r.affectedRows > 0 ? { id: numId } : null;
}
