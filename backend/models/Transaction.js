import { pool } from '../config/db.js';

export const VALID_STATUSES = [
  'initiated', 'pending_inspection', 'payment_in_escrow',
  'completed', 'cancelled', 'disputed',
];

const WITH_RELATIONS = `
  SELECT t.*,
    JSON_OBJECT('id', b.id, 'name', b.name) AS buyer,
    JSON_OBJECT('id', s.id, 'name', s.name) AS seller,
    CASE WHEN c.id IS NOT NULL
      THEN JSON_OBJECT('id', c.id, 'title', c.title, 'price', c.price)
      ELSE NULL
    END AS car
  FROM transactions t
  JOIN  users b ON b.id = t.buyer_id
  JOIN  users s ON s.id = t.seller_id
  LEFT JOIN cars c ON c.id = t.car_id
`;

const WITH_RELATIONS_EMAIL = `
  SELECT t.*,
    JSON_OBJECT('id', b.id, 'name', b.name, 'email', b.email) AS buyer,
    JSON_OBJECT('id', s.id, 'name', s.name, 'email', s.email) AS seller,
    CASE WHEN c.id IS NOT NULL
      THEN JSON_OBJECT('id', c.id, 'title', c.title, 'price', c.price)
      ELSE NULL
    END AS car
  FROM transactions t
  JOIN  users b ON b.id = t.buyer_id
  JOIN  users s ON s.id = t.seller_id
  LEFT JOIN cars c ON c.id = t.car_id
`;

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
    `${WITH_RELATIONS}
     WHERE t.buyer_id = ? OR t.seller_id = ?
     ORDER BY t.created_at DESC`,
    [userId, userId]
  );
  return rows.map(normalize);
}

export async function findById(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const [rows] = await pool.query(`${WITH_RELATIONS_EMAIL} WHERE t.id = ?`, [numId]);
  return rows[0] ? normalize(rows[0]) : null;
}

export async function updateStatus(id, status) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
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
  const [rows] = await pool.query(`${WITH_RELATIONS} ORDER BY t.created_at DESC`);
  return rows.map(normalize);
}

export async function setDisputed(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const [result] = await pool.query(
    "UPDATE transactions SET status = 'disputed' WHERE id = ?",
    [numId]
  );
  if (result.affectedRows === 0) return null;
  const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [numId]);
  return rows[0] || null;
}
