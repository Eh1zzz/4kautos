import express from 'express';
import { findAll, findById, create, deleteById, deleteByIdAndSeller, addPhotos } from '../models/Car.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// GET /cars — search/filter
router.get('/', async (req, res) => {
  try {
    const cars = await findAll(req.query);
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

// POST /cars — create listing (sellers only)
router.post('/', authenticate, authorize('seller'), async (req, res) => {
  try {
    const { title, make, model, year, mileage, vin, condition, description, photos, price } = req.body;
    const car = await create({ title, make, model, year, mileage, vin, condition, description, photos: photos || [], price, sellerId: req.user.id });
    res.status(201).json({ message: 'Car added successfully', car });
  } catch (err) {
    console.error('POST /cars:', err.message);
    res.status(500).json({ message: 'Failed to add car' });
  }
});

// POST /cars/:id/photos — upload images (seller owns the car)
router.post('/:id/photos', authenticate, authorize('seller'), upload.array('photos', 10), async (req, res) => {
  try {
    const urls = req.files.map(f => `/uploads/${f.filename}`);
    const car  = await addPhotos(req.params.id, req.user.id, urls);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    res.json({ message: 'Photos uploaded', photos: car.photos });
  } catch (err) {
    res.status(500).json({ message: 'Failed to upload photos' });
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
