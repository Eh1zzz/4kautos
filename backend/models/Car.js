import { pool } from '../config/db.js';

const SELLER_JSON =
  `json_build_object('id', u.id, 'name', u.name, 'verified', u.verified) AS seller`;

const SELLER_JSON_EMAIL =
  `json_build_object('id', u.id, 'name', u.name, 'email', u.email, 'verified', u.verified) AS seller`;

export async function findAll({ q, make, model, year, minPrice, maxPrice, condition, sellerId } = {}) {
  const conds = [];
  const vals  = [];
  let   idx   = 1;

  if (q) {
    conds.push(`(c.title ILIKE $${idx} OR c.make ILIKE $${idx} OR c.model ILIKE $${idx} OR c.description ILIKE $${idx})`);
    vals.push(`%${q}%`); idx++;
  }
  if (make)     { conds.push(`c.make ILIKE $${idx}`);      vals.push(`%${make}%`);           idx++; }
  if (model)    { conds.push(`c.model ILIKE $${idx}`);     vals.push(`%${model}%`);          idx++; }
  if (year)     { conds.push(`c.year = $${idx}`);          vals.push(parseInt(year, 10));    idx++; }
  if (minPrice) { conds.push(`c.price >= $${idx}`);        vals.push(parseFloat(minPrice));  idx++; }
  if (maxPrice) { conds.push(`c.price <= $${idx}`);        vals.push(parseFloat(maxPrice));  idx++; }
  if (sellerId) {
    const sid = parseInt(sellerId, 10);
    if (!isNaN(sid)) { conds.push(`c.seller_id = $${idx}`); vals.push(sid); idx++; }
  }
  if (condition) {
    const list = condition.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length) { conds.push(`c.condition = ANY($${idx}::text[])`); vals.push(list); idx++; }
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT c.*, ${SELLER_JSON}
     FROM cars c JOIN users u ON u.id = c.seller_id
     ${where}
     ORDER BY c.created_at DESC LIMIT 100`,
    vals
  );
  return rows;
}

export async function findById(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const { rows } = await pool.query(
    `SELECT c.*, ${SELLER_JSON_EMAIL}
     FROM cars c JOIN users u ON u.id = c.seller_id
     WHERE c.id = $1`,
    [numId]
  );
  return rows[0] || null;
}

export async function create({ title, make, model, year, mileage, vin, condition, description, photos, price, sellerId }) {
  const { rows } = await pool.query(
    `INSERT INTO cars (title, make, model, year, mileage, vin, condition, description, photos, price, seller_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      title || null,
      make  || null,
      model || null,
      year  ? parseInt(year, 10) : null,
      mileage ? parseInt(mileage, 10) : null,
      vin   || null,
      condition || 'good',
      description || null,
      photos || [],
      price ? parseFloat(price) : null,
      sellerId,
    ]
  );
  return rows[0];
}

export async function deleteById(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const { rows } = await pool.query(
    'DELETE FROM cars WHERE id = $1 RETURNING id',
    [numId]
  );
  return rows[0] || null;
}

export async function deleteByIdAndSeller(id, sellerId) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const { rows } = await pool.query(
    'DELETE FROM cars WHERE id = $1 AND seller_id = $2 RETURNING id',
    [numId, sellerId]
  );
  return rows[0] || null;
}

export async function addPhotos(id, sellerId, urls) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const { rows } = await pool.query(
    `UPDATE cars SET photos = photos || $1::text[]
     WHERE id = $2 AND seller_id = $3
     RETURNING *`,
    [urls, numId, sellerId]
  );
  return rows[0] || null;
}

export async function findAllAdmin() {
  const { rows } = await pool.query(
    `SELECT c.*,
       json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS seller
     FROM cars c JOIN users u ON u.id = c.seller_id
     ORDER BY c.created_at DESC`
  );
  return rows;
}
