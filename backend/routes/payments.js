import express from 'express';
import crypto from 'crypto';
import { authenticate, authorize } from '../middleware/auth.js';
import { toId } from '../utils/validation.js';
import { findById as findTx, setPaymentInit, findByPaymentRef, markEscrowPaid } from '../models/Transaction.js';
import { findById as findCar } from '../models/Car.js';
import * as FLW from '../utils/flutterwave.js';

const router = express.Router();

// POST /payments/initiate { transactionId } — buyer starts paying into escrow.
// Returns a Flutterwave hosted-checkout link to redirect the buyer to.
router.post('/initiate', authenticate, authorize('buyer'), async (req, res) => {
  try {
    if (!FLW.isConfigured())
      return res.status(503).json({ message: 'Payments are not configured yet' });

    const txId = toId(req.body.transactionId);
    if (!txId) return res.status(400).json({ message: 'A valid transactionId is required' });

    const tx = await findTx(txId);
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.buyer_id !== req.user.id) return res.status(403).json({ message: 'Not your transaction' });
    if (!['initiated', 'pending_inspection'].includes(tx.status))
      return res.status(409).json({ message: `This transaction can't be paid (status: ${tx.status})` });

    // Price snapshot comes from the CAR (authoritative) — never a client amount.
    const car = tx.car_id ? await findCar(tx.car_id) : null;
    if (!car || car.price == null)
      return res.status(400).json({ message: 'This listing has no price to charge' });
    const amount = Number(car.price);
    const currency = car.currency || 'NGN';

    const paymentRef = `4kautos-${tx.id}-${crypto.randomBytes(6).toString('hex')}`;
    await setPaymentInit(tx.id, { amount, currency, paymentRef });

    const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const link = await FLW.initiatePayment({
      tx_ref: paymentRef,
      amount,
      currency,
      redirect_url: `${base}/payment-complete.html`,
      customer: { email: tx.buyer?.email, name: tx.buyer?.name },
      meta: { transactionId: tx.id },
    });
    res.json({ link });
  } catch (err) {
    console.error('payment initiate:', err.message);
    res.status(502).json({ message: 'Could not start the payment' });
  }
});

// POST /payments/webhook — Flutterwave calls this on payment events.
// Auth = the shared "secret hash" you set in the FLW dashboard (the verif-hash header).
router.post('/webhook', async (req, res) => {
  const sig = req.headers['verif-hash'];
  if (!process.env.FLW_WEBHOOK_HASH || sig !== process.env.FLW_WEBHOOK_HASH)
    return res.status(401).end();

  // Acknowledge immediately so Flutterwave doesn't retry on our processing latency,
  // then do the work. (Webhook delivery is at-least-once → our update is idempotent.)
  res.status(200).end();

  try {
    const data = (req.body && req.body.data) || {};
    if (!data.id) return;

    // Re-verify server-side — never trust the webhook's amount/status by itself.
    const verified = await FLW.verifyTransaction(data.id);
    if (!verified || verified.status !== 'successful') return;

    const tx = await findByPaymentRef(verified.tx_ref);
    if (!tx) return;

    // The paid amount/currency must match what we asked to charge.
    if (Number(verified.amount) < Number(tx.amount) || verified.currency !== tx.currency) {
      console.error(`payment mismatch ${verified.tx_ref}: got ${verified.amount} ${verified.currency}, expected ${tx.amount} ${tx.currency}`);
      return;
    }

    const updated = await markEscrowPaid(verified.tx_ref, verified.id);
    if (updated) console.log(`✅ escrow funded: transaction ${tx.id} (${verified.tx_ref})`);
  } catch (err) {
    console.error('payment webhook:', err.message);
  }
});

export default router;
