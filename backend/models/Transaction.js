import { pool } from '../config/db.js';
import { toId } from '../utils/validation.js';

export const VALID_STATUSES = [
  'initiated', 'pending_inspection', 'payment_in_escrow',
  'completed', 'cancelled', 'disputed',
];

// Build the relations SELECT. Counterparties' emails are only included for the
// single-transaction view (where both parties are entitled to make contact).
function withRelations(withEmail = false) {
  const person = alias => withEmail
    ? `JSON_OBJECT('id', ${alias}.id, 'name', ${alias}.name, 'email', ${alias}.email)`
    : `JSON_OBJECT('id', ${alias}.id, 'name', ${alias}.name)`;
  return `
    SELECT t.*,
      ${person('b')} AS buyer,
      ${person('s')} AS seller,
      CASE WHEN c.id IS NOT NULL
        THEN JSON_OBJECT('id', c.id, 'title', c.title, 'price', c.price, 'currency', c.currency)
        ELSE NULL
      END AS car
    FROM transactions t
    JOIN  users b ON b.id = t.buyer_id
    JOIN  users s ON s.id = t.seller_id
    LEFT JOIN cars c ON c.id = t.car_id
  `;
}

// mysql2 usually parses JSON, but normalize defensively.
function normalize(row) {
  if (!row) return row;
  for (const k of ['buyer', 'seller', 'car']) {
    if (typeof row[k] === 'string') {
      try { row[k] = JSON.parse(row[k]); } catch { /* leave as-is */ }
    }
  }
  return row;
}

export async function create(buyerId, sellerId, carId) {
  const [result] = await pool.query(
    'INSERT INTO transactions (buyer_id, seller_id, car_id) VALUES (?, ?, ?)',
    [buyerId, parseInt(sellerId, 10), parseInt(carId, 10)]
  );
  const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [result.insertId]);
  return rows[0];
}

export async function findByUser(userId) {
  const [rows] = await pool.query(
    `${withRelations()}
     WHERE t.buyer_id = ? OR t.seller_id = ?
     ORDER BY t.created_at DESC`,
    [userId, userId]
  );
  return rows.map(normalize);
}

export async function findById(id) {
  const numId = toId(id);
  if (!numId) return null;
  const [rows] = await pool.query(`${withRelations(true)} WHERE t.id = ?`, [numId]);
  return rows[0] ? normalize(rows[0]) : null;
}

export async function updateStatus(id, status) {
  const numId = toId(id);
  if (!numId) return null;
  const [result] = await pool.query(
    'UPDATE transactions SET status = ? WHERE id = ?',
    [status, numId]
  );
  if (result.affectedRows === 0) return null;
  const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [numId]);
  return rows[0] || null;
}

export async function findExisting(buyerId, carId) {
  const [rows] = await pool.query(
    `SELECT id FROM transactions
     WHERE buyer_id = ? AND car_id = ?
       AND status NOT IN ('cancelled','completed')`,
    [buyerId, parseInt(carId, 10)]
  );
  return rows[0] || null;
}

export async function findAll() {
  const [rows] = await pool.query(`${withRelations()} ORDER BY t.created_at DESC LIMIT 500`);
  return rows.map(normalize);
}

export async function setDisputed(id) {
  const numId = toId(id);
  if (!numId) return null;
  const [result] = await pool.query(
    "UPDATE transactions SET status = 'disputed' WHERE id = ?",
    [numId]
  );
  if (result.affectedRows === 0) return null;
  const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [numId]);
  return rows[0] || null;
}
