import { pool } from '../config/db.js';
import { toId } from '../utils/validation.js';

/* Post-purchase reviews (buyer → seller, one per completed transaction).
   Authorization (buyer-of-this-transaction, status = completed) lives in the
   route; the UNIQUE key on transaction_id makes repeats impossible. */

export async function create({ transactionId, buyerId, sellerId, rating, comment }) {
  const [r] = await pool.query(
    'INSERT INTO reviews (transaction_id, buyer_id, seller_id, rating, comment) VALUES (?,?,?,?,?)',
    [transactionId, buyerId, sellerId, rating, comment || null]);
  const [[row]] = await pool.query('SELECT * FROM reviews WHERE id = ?', [r.insertId]);
  return row;
}

// Public list for the seller profile: rating/comment/date + the buyer's name
// and which car the deal was for. Never emails.
export async function listBySeller(sellerId, limit = 50) {
  const sId = toId(sellerId);
  if (!sId) return [];
  const [rows] = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.created_at,
            b.name AS buyer_name,
            COALESCE(NULLIF(c.title,''), CONCAT_WS(' ', c.year, c.make, c.model)) AS car_title
     FROM reviews r
     JOIN users b ON b.id = r.buyer_id
     LEFT JOIN transactions t ON t.id = r.transaction_id
     LEFT JOIN cars c ON c.id = t.car_id
     WHERE r.seller_id = ?
     ORDER BY r.created_at DESC
     LIMIT ?`, [sId, Math.min(Math.max(limit, 1), 100)]);
  return rows;
}

/** { avg: 4.7|null, count: n } for a seller. */
export async function aggregateForSeller(sellerId) {
  const [[row]] = await pool.query(
    'SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE seller_id = ?', [sellerId]);
  const count = Number(row.n);
  return { avg: count ? Math.round(Number(row.avg) * 10) / 10 : null, count };
}
