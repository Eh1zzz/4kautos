import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as SavedCars from '../models/SavedCar.js';

const router = express.Router();
router.use(authenticate);
const MAX_PER_USER = 200;

// GET /saved-cars — the user's saved car ids (?full=1 → full car rows).
router.get('/', async (req, res) => {
  try {
    if (req.query.full === '1') return res.json(await SavedCars.carsByUser(req.user.id));
    res.json({ ids: await SavedCars.idsByUser(req.user.id) });
  } catch (err) {
    console.error('GET /saved-cars:', err.message);
    res.status(500).json({ message: 'Failed to load saved cars' });
  }
});

// PUT /saved-cars/:carId — save (idempotent).
router.put('/:carId', async (req, res) => {
  try {
    if (await SavedCars.countByUser(req.user.id) >= MAX_PER_USER)
      return res.status(409).json({ message: `You can save up to ${MAX_PER_USER} cars` });
    const ok = await SavedCars.add(req.user.id, req.params.carId);
    if (!ok) return res.status(404).json({ message: 'Car not found' });
    res.json({ message: 'Saved' });
  } catch (err) {
    console.error('PUT /saved-cars:', err.message);
    res.status(500).json({ message: 'Failed to save' });
  }
});

// DELETE /saved-cars/:carId — unsave (idempotent).
router.delete('/:carId', async (req, res) => {
  try {
    await SavedCars.remove(req.user.id, req.params.carId);
    res.json({ message: 'Removed' });
  } catch (err) {
    console.error('DELETE /saved-cars:', err.message);
    res.status(500).json({ message: 'Failed to remove' });
  }
});

export default router;
