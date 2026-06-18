import express from 'express';
import { findAll, findById, findSimilar, create, deleteById, deleteByIdAndSeller } from '../models/Car.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateCarInput } from '../utils/validation.js';
import { getRate } from './fx.js';

const router = express.Router();

// GET /cars — search/filter/sort/paginate. Body stays an array (back-compat);
// the total is returned via headers for the pagination UI.
router.get('/', async (req, res) => {
  try {
    // Only the FX rate matters for USD budget filters / price sorting — skip the
    // (cached) FX lookup entirely otherwise.
    const needsRate = req.query.minUsd || req.query.maxUsd || req.query.sort === 'price' || req.query.sort === '-price';
    const rate = needsRate ? (await getRate()).usdToNgn : undefined;
    const { cars, total, limit } = await findAll({ ...req.query, rate });
    res.set('X-Total-Count', String(Number(total)));
    res.set('X-Total-Pages', String(Math.max(1, Math.ceil(Number(total) / limit))));
    res.json(cars);
  } catch (err) {
    console.error('GET /cars:', err.message);
    res.status(500).json({ message: 'Failed to fetch cars' });
  }
});

// GET /cars/:id — details
router.get('/:id', async (req, res) => {
  try {
    const car = await findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    res.json(car);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch car' });
  }
});

// GET /cars/:id/similar — comparable listings (same make+model, then body type)
router.get('/:id/similar', async (req, res) => {
  try {
    const car = await findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 4, 1), 12);
    const similar = await findSimilar(car, limit);
    res.json(similar);
  } catch (err) {
    console.error('GET /cars/:id/similar:', err.message);
    res.status(500).json({ message: 'Failed to fetch similar cars' });
  }
});

// POST /cars — create listing (sellers only)
router.post('/', authenticate, authorize('seller'), async (req, res) => {
  try {
    const { errors, value } = validateCarInput(req.body);
    if (errors.length)
      return res.status(400).json({ message: errors[0], errors });

    const car = await create({ ...value, sellerId: req.user.id });
    res.status(201).json({ message: 'Car added successfully', car });
  } catch (err) {
    console.error('POST /cars:', err.message);
    res.status(500).json({ message: 'Failed to add car' });
  }
});

// DELETE /cars/:id — admin deletes any car; seller deletes their own
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    let deleted;

    if (role === 'admin') {
      deleted = await deleteById(req.params.id);
    } else if (role === 'seller') {
      deleted = await deleteByIdAndSeller(req.params.id, userId);
    } else {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (!deleted) return res.status(404).json({ message: 'Car not found' });
    res.json({ message: 'Car deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete car' });
  }
});

export default router;
