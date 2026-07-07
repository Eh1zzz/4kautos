import { pool } from '../config/db.js';
import { toId } from '../utils/validation.js';
import { SELLER_JSON, normalize } from './Car.js';

/* Server-synced saved cars ("hearts"). localStorage remains the anonymous
   store; these rows make saves follow the account across devices. */

export async function idsByUser(userId) {
  const [rows] = await pool.query(
    'SELECT car_id FROM saved_cars WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  return rows.map(r => String(r.car_id));
}

// Full car rows (same shape as GET /cars) for a future dashboard tab.
export async function carsByUser(userId) {
  const [rows] = await pool.query(
    `SELECT c.*, ${SELLER_JSON}
     FROM saved_cars s
     JOIN cars c  ON c.id = s.car_id
     JOIN users u ON u.id = c.seller_id
     WHERE s.user_id = ?
     ORDER BY s.created_at DESC`, [userId]);
  return rows.map(normalize);
}

export async function countByUser(userId) {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM saved_cars WHERE user_id = ?', [userId]);
  return Number(n);
}

/** Save a car. Returns true on success, false when the car doesn't exist. */
export async function add(userId, carId) {
  const cId = toId(carId);
  if (!cId) return false;
  try {
    // ODKU (not INSERT IGNORE): re-saving stays a quiet no-op, but a missing
    // car still raises the FK error (IGNORE would swallow that too).
    await pool.query(
      'INSERT INTO saved_cars (user_id, car_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE car_id = car_id',
      [userId, cId]);
    return true;
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') return false;
    throw err;
  }
}

export async function remove(userId, carId) {
  const cId = toId(carId);
  if (!cId) return;
  await pool.query('DELETE FROM saved_cars WHERE user_id = ? AND car_id = ?', [userId, cId]);
}
