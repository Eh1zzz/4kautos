import express from 'express';
import { findAll as findAllUsers, verifyById, deleteById as deleteUserById } from '../models/User.js';
import { findAllAdmin, deleteById as deleteCarById, setFeatured } from '../models/Car.js';
import { findAll as findAllTx, setDisputed } from '../models/Transaction.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { toId } from '../utils/validation.js';

const router = express.Router();
router.use(authenticate, authorize('admin'));

router.get('/users', async (_req, res) => {
  try { res.json(await findAllUsers()); }
  catch { res.status(500).json({ message: 'Failed to fetch users' }); }
});

router.patch('/users/:id/verify', async (req, res) => {
  try {
    const user = await verifyById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Verified', user });
  } catch { res.status(500).json({ message: 'Failed to verify user' }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid user id' });
    if (id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own admin account' });
    const deleted = await deleteUserById(id);
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) { console.error('admin delete user:', err.message); res.status(500).json({ message: 'Failed to delete user' }); }
});

router.get('/cars', async (_req, res) => {
  try { res.json(await findAllAdmin()); }
  catch { res.status(500).json({ message: 'Failed to fetch cars' }); }
});

router.delete('/cars/:id', async (req, res) => {
  try {
    const deleted = await deleteCarById(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Car not found' });
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ message: 'Failed to delete car' }); }
});

// PATCH /admin/cars/:id/feature { featured } — toggle the Hot-Sales flag
router.patch('/cars/:id/feature', async (req, res) => {
  try {
    const updated = await setFeatured(req.params.id, !!req.body.featured);
    if (!updated) return res.status(404).json({ message: 'Car not found' });
    res.json({ message: req.body.featured ? 'Added to Hot Sales' : 'Removed from Hot Sales', car: updated });
  } catch (err) { console.error('admin feature:', err.message); res.status(500).json({ message: 'Failed to update' }); }
});

router.get('/transactions', async (_req, res) => {
  try { res.json(await findAllTx()); }
  catch { res.status(500).json({ message: 'Failed to fetch transactions' }); }
});

router.patch('/transactions/:id/dispute', async (req, res) => {
  try {
    const t = await setDisputed(req.params.id);
    if (!t) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ message: 'Disputed', transaction: t });
  } catch { res.status(500).json({ message: 'Failed to dispute transaction' }); }
});

export default router;
