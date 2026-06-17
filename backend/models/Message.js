import { pool } from '../config/db.js';

// A thread is identified by (car_id, buyer_id); the seller is the car's owner.
export async function create({ carId, buyerId, sellerId, senderId, body }) {
  const [r] = await pool.query(
    'INSERT INTO messages (car_id, buyer_id, seller_id, sender_id, body) VALUES (?,?,?,?,?)',
    [carId || null, buyerId, sellerId, senderId, body]
  );
  const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [r.insertId]);
  return rows[0];
}

// Every thread the user is part of, with the latest message + unread count.
export async function listThreads(userId) {
  const [rows] = await pool.query(
    `SELECT t.car_id, t.buyer_id, t.seller_id, t.unread,
            lm.body AS last_body, lm.created_at AS last_at, lm.sender_id AS last_sender,
            b.name AS buyer_name, s.name AS seller_name, c.title AS car_title
     FROM (
       SELECT car_id, buyer_id, seller_id, MAX(id) AS last_id,
              SUM(CASE WHEN sender_id <> ? AND read_at IS NULL THEN 1 ELSE 0 END) AS unread
       FROM messages
       WHERE buyer_id = ? OR seller_id = ?
       GROUP BY car_id, buyer_id, seller_id
     ) t
     JOIN messages lm ON lm.id = t.last_id
     JOIN users b ON b.id = t.buyer_id
     JOIN users s ON s.id = t.seller_id
     LEFT JOIN cars c ON c.id = t.car_id
     ORDER BY lm.created_at DESC`,
    [userId, userId, userId]
  );
  return rows;
}

export async function listMessages(carId, buyerId) {
  const [rows] = await pool.query(
    `SELECT m.id, m.sender_id, m.body, m.created_at, u.name AS sender_name
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.car_id <=> ? AND m.buyer_id = ?
     ORDER BY m.id ASC`,
    [carId, buyerId]
  );
  return rows;
}

// Mark the counterpart's messages in this thread as read.
export async function markRead(carId, buyerId, readerId) {
  await pool.query(
    'UPDATE messages SET read_at = NOW() WHERE car_id <=> ? AND buyer_id = ? AND sender_id <> ? AND read_at IS NULL',
    [carId, buyerId, readerId]
  );
}

export async function unreadCount(userId) {
  const [[row]] = await pool.query(
    'SELECT COUNT(*) AS n FROM messages WHERE (buyer_id = ? OR seller_id = ?) AND sender_id <> ? AND read_at IS NULL',
    [userId, userId, userId]
  );
  return row.n;
}
