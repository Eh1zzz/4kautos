import express from 'express';
import { findAll as findAllUsers, verifyById } from '../models/User.js';
import { findAllAdmin, deleteById as deleteCarById } from '../models/Car.js';
import { findAll as findAllTx, setDisputed } from '../models/Transaction.js';
import { authenticate, authorize } from '../middleware/auth.js';

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
