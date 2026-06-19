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

/* ── Payments / escrow ─────────────────────────────────────── */

// Snapshot the amount/currency and our payment reference when a buyer starts paying.
export async function setPaymentInit(id, { amount, currency, paymentRef }) {
  const numId = toId(id);
  if (!numId) return null;
  await pool.query(
    'UPDATE transactions SET amount = ?, currency = ?, payment_ref = ? WHERE id = ?',
    [amount, currency, paymentRef, numId]
  );
  const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [numId]);
  return rows[0] || null;
}

export async function findByPaymentRef(ref) {
  if (!ref) return null;
  const [rows] = await pool.query('SELECT * FROM transactions WHERE payment_ref = ?', [ref]);
  return rows[0] || null;
}

// Idempotently move a transaction into escrow once payment is verified. It only
// flips from a pre-payment state, so a duplicate webhook is a no-op (affectedRows
// 0 → returns null). Returns the updated row when it actually changed.
export async function markEscrowPaid(paymentRef, flwTxId) {
  const [result] = await pool.query(
    `UPDATE transactions
        SET status = 'payment_in_escrow', flw_tx_id = ?, paid_at = NOW()
      WHERE payment_ref = ?
        AND status IN ('initiated','pending_inspection')`,
    [String(flwTxId), paymentRef]
  );
  if (result.affectedRows === 0) return null;
  const [rows] = await pool.query('SELECT * FROM transactions WHERE payment_ref = ?', [paymentRef]);
  return rows[0] || null;
}

// Cancel an escrowed transaction after a refund. Idempotent — only flips from
// payment_in_escrow, so a repeat call is a no-op.
export async function markRefunded(id) {
  const numId = toId(id);
  if (!numId) return null;
  const [result] = await pool.query(
    "UPDATE transactions SET status = 'cancelled' WHERE id = ? AND status = 'payment_in_escrow'",
    [numId]
  );
  if (result.affectedRows === 0) return null;
  const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [numId]);
  return rows[0] || null;
}

// Release escrow → completed, recording the payout transfer reference. Idempotent
// (only from payment_in_escrow).
export async function markReleased(id, transferRef) {
  const numId = toId(id);
  if (!numId) return null;
  const [result] = await pool.query(
    "UPDATE transactions SET status = 'completed', transfer_ref = ? WHERE id = ? AND status = 'payment_in_escrow'",
    [transferRef != null ? String(transferRef) : null, numId]
  );
  if (result.affectedRows === 0) return null;
  const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [numId]);
  return rows[0] || null;
}

// Put funds back into escrow if the payout transfer ultimately fails (webhook).
export async function revertRelease(transferRef) {
  if (!transferRef) return null;
  const [result] = await pool.query(
    "UPDATE transactions SET status = 'payment_in_escrow' WHERE transfer_ref = ? AND status = 'completed'",
    [String(transferRef)]
  );
  if (result.affectedRows === 0) return null;
  const [rows] = await pool.query('SELECT * FROM transactions WHERE transfer_ref = ?', [String(transferRef)]);
  return rows[0] || null;
}
