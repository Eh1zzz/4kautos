import express from 'express';
import { pool } from '../config/db.js';
import { toId } from '../utils/validation.js';
import { listBySeller, aggregateForSeller } from '../models/Review.js';

const router = express.Router();

// GET /sellers/:id — public seller profile. Deliberately a minimal projection:
// name, verified status, tenure and trade counts. Never email or payout data.
// The seller's inventory itself comes from the existing GET /cars?sellerId=.
router.get('/:id', async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ message: 'Seller not found' });

    const [[seller]] = await pool.query(
      "SELECT id, name, verified, created_at FROM users WHERE id = ? AND role = 'seller'", [id]);
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    const [[{ listings }]]  = await pool.query('SELECT COUNT(*) AS listings FROM cars WHERE seller_id = ?', [id]);
    const [[{ completed }]] = await pool.query(
      "SELECT COUNT(*) AS completed FROM transactions WHERE seller_id = ? AND status = 'completed'", [id]);
    const rating = await aggregateForSeller(id);

    res.json({
      id: seller.id,
      name: seller.name,
      verified: !!seller.verified,
      memberSince: seller.created_at,
      listings: Number(listings),
      completedSales: Number(completed),
      rating, // { avg, count }
    });
  } catch (err) {
    console.error('GET /sellers/:id:', err.message);
    res.status(500).json({ message: 'Failed to load seller profile' });
  }
});

// GET /sellers/:id/reviews — public review list (buyer name + car, no PII).
router.get('/:id/reviews', async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(404).json({ message: 'Seller not found' });
    res.json(await listBySeller(id));
  } catch (err) {
    console.error('GET /sellers/:id/reviews:', err.message);
    res.status(500).json({ message: 'Failed to load reviews' });
  }
});

export default router;
