import { pool } from '../config/db.js';

export const VALID_STATUSES = [
  'initiated', 'pending_inspection', 'payment_in_escrow',
  'completed', 'cancelled', 'disputed',
];

const WITH_RELATIONS = `
  SELECT t.*,
    json_build_object('id', b.id, 'name', b.name) AS buyer,
    json_build_object('id', s.id, 'name', s.name) AS seller,
    CASE WHEN c.id IS NOT NULL
      THEN json_build_object('id', c.id, 'title', c.title, 'price', c.price)
      ELSE NULL
    END AS car
  FROM transactions t
  JOIN  users b ON b.id = t.buyer_id
  JOIN  users s ON s.id = t.seller_id
  LEFT JOIN cars c ON c.id = t.car_id
`;

const WITH_RELATIONS_EMAIL = `
  SELECT t.*,
    json_build_object('id', b.id, 'name', b.name, 'email', b.email) AS buyer,
    json_build_object('id', s.id, 'name', s.name, 'email', s.email) AS seller,
    CASE WHEN c.id IS NOT NULL
      THEN json_build_object('id', c.id, 'title', c.title, 'price', c.price)
      ELSE NULL
    END AS car
  FROM transactions t
  JOIN  users b ON b.id = t.buyer_id
  JOIN  users s ON s.id = t.seller_id
  LEFT JOIN cars c ON c.id = t.car_id
`;

export async function create(buyerId, sellerId, carId) {
  const { rows } = await pool.query(
    `INSERT INTO transactions (buyer_id, seller_id, car_id)
     VALUES ($1, $2, $3) RETURNING *`,
    [buyerId, parseInt(sellerId, 10), parseInt(carId, 10)]
  );
  return rows[0];
}

export async function findByUser(userId) {
  const { rows } = await pool.query(
    `${WITH_RELATIONS}
     WHERE t.buyer_id = $1 OR t.seller_id = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function findById(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const { rows } = await pool.query(
    `${WITH_RELATIONS_EMAIL} WHERE t.id = $1`,
    [numId]
  );
  return rows[0] || null;
}

export async function updateStatus(id, status) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const { rows } = await pool.query(
    `UPDATE transactions SET status = $1 WHERE id = $2 RETURNING *`,
    [status, numId]
  );
  return rows[0] || null;
}

export async function findExisting(buyerId, carId) {
  const { rows } = await pool.query(
    `SELECT id FROM transactions
     WHERE buyer_id = $1 AND car_id = $2
       AND status NOT IN ('cancelled','completed')`,
    [buyerId, parseInt(carId, 10)]
  );
  return rows[0] || null;
}

export async function findAll() {
  const { rows } = await pool.query(
    `${WITH_RELATIONS} ORDER BY t.created_at DESC`
  );
  return rows;
}

export async function setDisputed(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const { rows } = await pool.query(
    `UPDATE transactions SET status = 'disputed' WHERE id = $1 RETURNING *`,
    [numId]
  );
  return rows[0] || null;
}
