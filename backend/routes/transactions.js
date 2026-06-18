import express from 'express';
import { create, findByUser, findById, updateStatus, findExisting, VALID_STATUSES } from '../models/Transaction.js';
import { findById as findCarById } from '../models/Car.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { toId } from '../utils/validation.js';

const router = express.Router();

// POST /transactions — buyer initiates
router.post('/', authenticate, authorize('buyer'), async (req, res) => {
  try {
    const carId = toId(req.body.carId);
    if (!carId)
      return res.status(400).json({ message: 'A valid carId is required' });

    const car = await findCarById(carId);
    if (!car)
      return res.status(404).json({ message: 'Car not found' });

    // Derive the seller from the car record — never trust a client-supplied
    // sellerId (a buyer could otherwise open a transaction against any user).
    const sellerId = car.seller_id;
    if (sellerId === req.user.id)
      return res.status(400).json({ message: 'You cannot purchase your own listing' });

    // Prevent duplicate active transactions on the same car
    const existing = await findExisting(req.user.id, carId);
    if (existing)
      return res.status(409).json({ message: 'You already have an active transaction for this car' });

    const transaction = await create(req.user.id, sellerId, carId);
    res.status(201).json({ message: 'Transaction initiated', transaction });
  } catch (err) {
    console.error('POST /transactions:', err.message);
    res.status(500).json({ message: 'Failed to initiate transaction' });
  }
});

// GET /transactions — current user's transactions
router.get('/', authenticate, async (req, res) => {
  try {
    const transactions = await findByUser(req.user.id);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
});

// GET /transactions/:id — single transaction (participants or admin only)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const t = await findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Transaction not found' });
    // This view includes counterparties' emails — only the buyer, seller, or an
    // admin may read it (otherwise any logged-in user could enumerate PII by id).
    if (req.user.role !== 'admin' && ![t.buyer_id, t.seller_id].includes(req.user.id))
      return res.status(403).json({ message: 'Not authorized' });
    res.json(t);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch transaction' });
  }
});

// PATCH /transactions/:id/status — buyer or seller updates status
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;

    // Validate status before touching the DB
    if (!VALID_STATUSES.includes(status))
      return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });

    const t = await findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Transaction not found' });

    if (![t.buyer_id, t.seller_id].includes(req.user.id))
      return res.status(403).json({ message: 'Not authorized' });

    const updated = await updateStatus(req.params.id, status);
    res.json({ message: 'Transaction updated', transaction: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update transaction' });
  }
});

export default router;
