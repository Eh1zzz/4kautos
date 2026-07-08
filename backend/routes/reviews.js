import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { toId } from '../utils/validation.js';
import { findById as findTx } from '../models/Transaction.js';
import * as Reviews from '../models/Review.js';

const router = express.Router();

// POST /reviews { transactionId, rating, comment? } — the buyer of a COMPLETED
// transaction rates the seller. One review per transaction ("verified
// purchase" is structural, not an honor system).
router.post('/', authenticate, async (req, res) => {
  try {
    const txId = toId(req.body.transactionId);
    if (!txId) return res.status(400).json({ message: 'A valid transactionId is required' });

    const rating = Number.parseInt(req.body.rating, 10);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5' });

    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 600) : '';

    const tx = await findTx(txId);
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.buyer_id !== req.user.id)
      return res.status(403).json({ message: 'Only the buyer can review this transaction' });
    if (tx.status !== 'completed')
      return res.status(409).json({ message: 'You can review once the transaction is completed' });

    // Seller comes from the transaction record — never from the client.
    const review = await Reviews.create({
      transactionId: tx.id, buyerId: req.user.id, sellerId: tx.seller_id,
      rating, comment: comment || null,
    });
    res.status(201).json({ message: 'Thanks for the review', review });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ message: 'You have already reviewed this transaction' });
    console.error('POST /reviews:', err.message);
    res.status(500).json({ message: 'Failed to post the review' });
  }
});

export default router;
