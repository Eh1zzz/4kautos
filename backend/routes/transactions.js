import express from 'express';
import { create, findByUser, findById, updateStatus, findExisting, deleteById } from '../models/Transaction.js';
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

// PATCH /transactions/:id/status — participant-driven status changes.
// SECURITY: limited to the pre-payment coordination states. The money states
// (payment_in_escrow, completed) are reachable ONLY through the verified payment
// flow — the webhook funds escrow, release completes it. Allowing a participant
// to set those here would fake an escrow-funded deal and let /payments/release
// pay the seller for funds that were never collected. 'disputed' is admin-only.
const MANUAL_STATUSES = ['pending_inspection', 'cancelled'];
const MANUAL_CHANGEABLE_FROM = ['initiated', 'pending_inspection'];

router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    // Authorize against the resource before validating input (don't reveal
    // validation behaviour to non-participants).
    const t = await findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Transaction not found' });
    if (![t.buyer_id, t.seller_id].includes(req.user.id))
      return res.status(403).json({ message: 'Not authorized' });

    const { status } = req.body;
    if (!MANUAL_STATUSES.includes(status))
      return res.status(400).json({ message: `Status must be one of: ${MANUAL_STATUSES.join(', ')}. Escrow states are set by the payment flow.` });
    if (!MANUAL_CHANGEABLE_FROM.includes(t.status))
      return res.status(409).json({ message: `A ${t.status} transaction can't be changed here` });

    const updated = await updateStatus(req.params.id, status);
    res.json({ message: 'Transaction updated', transaction: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update transaction' });
  }
});

// DELETE /transactions/:id — remove a CANCELLED transaction (history cleanup).
// Either participant or an admin may delete; only cancelled transactions qualify.
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const t = await findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Transaction not found' });
    if (req.user.role !== 'admin' && ![t.buyer_id, t.seller_id].includes(req.user.id))
      return res.status(403).json({ message: 'Not authorized' });
    if (t.status !== 'cancelled')
      return res.status(409).json({ message: 'Only cancelled transactions can be deleted' });

    await deleteById(req.params.id);
    res.json({ message: 'Transaction removed' });
  } catch (err) {
    console.error('DELETE /transactions/:id:', err.message);
    res.status(500).json({ message: 'Failed to delete transaction' });
  }
});

export default router;
