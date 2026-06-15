import { pool } from '../config/db.js';

const SELLER_JSON =
  `JSON_OBJECT('id', u.id, 'name', u.name, 'verified', u.verified) AS seller`;

const SELLER_JSON_EMAIL =
  `JSON_OBJECT('id', u.id, 'name', u.name, 'email', u.email, 'verified', u.verified) AS seller`;

// mysql2 usually parses JSON columns automatically, but normalize defensively
// so the API always returns photos as an array and seller as an object.
function normalize(row) {
  if (!row) return row;
  if (typeof row.photos === 'string') {
    try { row.photos = JSON.parse(row.photos); } catch { row.photos = []; }
  }
  if (row.photos == null) row.photos = [];
  if (typeof row.seller === 'string') {
    try { row.seller = JSON.parse(row.seller); } catch { /* leave as-is */ }
  }
  // Frontend reads `createdAt`; expose an alias for the snake_case column.
  if (row.created_at != null) row.createdAt = row.created_at;
  return row;
}

export async function findAll({ q, make, model, year, minPrice, maxPrice, condition, sellerId } = {}) {
  const conds = [];
  const vals  = [];

  if (q) {
    conds.push('(c.title LIKE ? OR c.make LIKE ? OR c.model LIKE ? OR c.description LIKE ?)');
    const like = `%${q}%`;
    vals.push(like, like, like, like);
  }
  if (make)     { conds.push('c.make LIKE ?');  vals.push(`%${make}%`); }
  if (model)    { conds.push('c.model LIKE ?'); vals.push(`%${model}%`); }
  if (year)     { conds.push('c.year = ?');     vals.push(parseInt(year, 10)); }
  if (minPrice) { conds.push('c.price >= ?');   vals.push(parseFloat(minPrice)); }
  if (maxPrice) { conds.push('c.price <= ?');   vals.push(parseFloat(maxPrice)); }
  if (sellerId) {
    const sid = parseInt(sellerId, 10);
    if (!isNaN(sid)) { conds.push('c.seller_id = ?'); vals.push(sid); }
  }
  if (condition) {
    const list = condition.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length) { conds.push('c.`condition` IN (?)'); vals.push(list); }
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT c.*, ${SELLER_JSON}
     FROM cars c JOIN users u ON u.id = c.seller_id
     ${where}
     ORDER BY c.created_at DESC LIMIT 100`,
    vals
  );
  return rows.map(normalize);
}

export async function findById(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const [rows] = await pool.query(
    `SELECT c.*, ${SELLER_JSON_EMAIL}
     FROM cars c JOIN users u ON u.id = c.seller_id
     WHERE c.id = ?`,
    [numId]
  );
  return rows[0] ? normalize(rows[0]) : null;
}

export async function create({ title, make, model, year, mileage, vin, condition, description, photos, price, sellerId }) {
  const [result] = await pool.query(
    'INSERT INTO cars (title, make, model, year, mileage, vin, `condition`, description, photos, price, seller_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [
      title || null,
      make  || null,
      model || null,
      year    ? parseInt(year, 10)    : null,
      mileage ? parseInt(mileage, 10) : null,
      vin   || null,
      condition || 'good',
      description || null,
      JSON.stringify(photos || []),
      price ? parseFloat(price) : null,
      sellerId,
    ]
  );
  return findById(result.insertId);
}

export async function deleteById(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const [result] = await pool.query('DELETE FROM cars WHERE id = ?', [numId]);
  return result.affectedRows > 0 ? { id: numId } : null;
}

export async function deleteByIdAndSeller(id, sellerId) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const [result] = await pool.query(
    'DELETE FROM cars WHERE id = ? AND seller_id = ?',
    [numId, sellerId]
  );
  return result.affectedRows > 0 ? { id: numId } : null;
}

export async function addPhotos(id, sellerId, urls) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;
  const [result] = await pool.query(
    `UPDATE cars
     SET photos = JSON_MERGE_PRESERVE(COALESCE(photos, JSON_ARRAY()), CAST(? AS JSON))
     WHERE id = ? AND seller_id = ?`,
    [JSON.stringify(urls), numId, sellerId]
  );
  if (result.affectedRows === 0) return null;
  return findById(numId);
}

export async function findAllAdmin() {
  const [rows] = await pool.query(
    `SELECT c.*,
       JSON_OBJECT('id', u.id, 'name', u.name, 'email', u.email) AS seller
     FROM cars c JOIN users u ON u.id = c.seller_id
     ORDER BY c.created_at DESC`
  );
  return rows.map(normalize);
}
