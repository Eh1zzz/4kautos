import express from 'express';
import crypto from 'crypto';
import { authenticate, authorize } from '../middleware/auth.js';
import { toId } from '../utils/validation.js';
import { findById as findTx, setPaymentInit, findByPaymentRef, markEscrowPaid, markRefunded, markReleased, revertRelease, pendingPayouts, markPayoutPaid } from '../models/Transaction.js';
import { findById as findCar } from '../models/Car.js';
import { getPayout, setPayout } from '../models/User.js';
import { payOutToSeller } from '../utils/payout.js';
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

    // Use only the ORIGIN for the redirect — so a misconfigured APP_BASE_URL that
    // includes a path (e.g. the webhook URL) can't break the return link.
    let base = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    try { base = new URL(base).origin; } catch { base = `${req.protocol}://${req.get('host')}`; }
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

// POST /payments/refund { transactionId } — buyer (own) or admin reverses an
// escrowed payment; the buyer is credited and the transaction is cancelled.
router.post('/refund', authenticate, async (req, res) => {
  try {
    if (!FLW.isConfigured())
      return res.status(503).json({ message: 'Payments are not configured yet' });

    const txId = toId(req.body.transactionId);
    if (!txId) return res.status(400).json({ message: 'A valid transactionId is required' });

    const tx = await findTx(txId);
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (req.user.role !== 'admin' && req.user.id !== tx.buyer_id)
      return res.status(403).json({ message: 'Not authorized to refund this transaction' });
    if (tx.status !== 'payment_in_escrow')
      return res.status(409).json({ message: 'Only an escrowed payment can be refunded' });
    if (!tx.flw_tx_id)
      return res.status(400).json({ message: 'No payment on record to refund' });

    const ok = await FLW.refundTransaction(tx.flw_tx_id, tx.amount);
    if (!ok) return res.status(502).json({ message: 'Refund could not be processed' });

    const updated = await markRefunded(tx.id);
    res.json({ message: 'Refund issued — the buyer will be credited', transaction: updated });
  } catch (err) {
    console.error('payment refund:', err.message);
    res.status(502).json({ message: 'Could not process the refund' });
  }
});

// GET /payments/banks — bank list for the seller's payout dropdown.
router.get('/banks', authenticate, async (_req, res) => {
  if (!FLW.isConfigured()) return res.status(503).json({ message: 'Payments are not configured yet' });
  try { res.json(await FLW.getBanks('NG')); }
  catch { res.status(502).json({ message: 'Could not load banks' }); }
});

// POST /payments/resolve-account { accountNumber, bankCode } — confirm the name.
router.post('/resolve-account', authenticate, async (req, res) => {
  if (!FLW.isConfigured()) return res.status(503).json({ message: 'Payments are not configured yet' });
  const { accountNumber, bankCode } = req.body;
  if (!accountNumber || !bankCode) return res.status(400).json({ message: 'accountNumber and bankCode are required' });
  const name = await FLW.resolveAccount(String(accountNumber).trim(), String(bankCode).trim());
  if (!name) return res.status(422).json({ message: 'Could not verify that account — check the number and bank' });
  res.json({ accountName: name });
});

// GET /payments/payout — the seller's saved payout details.
router.get('/payout', authenticate, authorize('seller'), async (req, res) => {
  res.json((await getPayout(req.user.id)) || {});
});

// POST /payments/payout — seller saves payout details (NG bank or international).
//   ng_bank:      { method:'ng_bank', bankCode, accountNumber }   (verified via FLW)
//   international: { method:'international', accountName, country, currency?, details }
router.post('/payout', authenticate, authorize('seller'), async (req, res) => {
  try {
    const method = req.body.method === 'international' ? 'international' : 'ng_bank';

    if (method === 'ng_bank') {
      if (!FLW.isConfigured()) return res.status(503).json({ message: 'Payments are not configured yet' });
      const { bankCode, accountNumber } = req.body;
      if (!bankCode || !accountNumber) return res.status(400).json({ message: 'bankCode and accountNumber are required' });
      const accountName = await FLW.resolveAccount(String(accountNumber).trim(), String(bankCode).trim());
      if (!accountName) return res.status(422).json({ message: 'Could not verify that account — check the number and bank' });
      const saved = await setPayout(req.user.id, { method: 'ng_bank', bankCode: String(bankCode).trim(), accountNumber: String(accountNumber).trim(), accountName });
      return res.json({ message: 'Payout details saved', payout: saved });
    }

    // international — stored for manual/Wise settlement (no Flutterwave verification).
    const accountName = String(req.body.accountName || '').trim();
    const country = String(req.body.country || '').trim();
    const details = String(req.body.details || '').trim();
    const currency = String(req.body.currency || '').trim().toUpperCase() || null;
    if (!accountName || !country || !details)
      return res.status(400).json({ message: 'Account holder name, country and bank details are required' });
    const saved = await setPayout(req.user.id, { method: 'international', accountName, country, currency, details });
    res.json({ message: 'International payout details saved', payout: saved });
  } catch (err) {
    console.error('save payout:', err.message);
    res.status(502).json({ message: 'Could not save payout details' });
  }
});

// POST /payments/release { transactionId } — buyer (own) or admin confirms receipt;
// pays the seller via their chosen rail (Flutterwave for NG, manual/Wise for
// international) and completes the transaction.
router.post('/release', authenticate, async (req, res) => {
  try {
    const txId = toId(req.body.transactionId);
    if (!txId) return res.status(400).json({ message: 'A valid transactionId is required' });

    const tx = await findTx(txId);
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (req.user.role !== 'admin' && req.user.id !== tx.buyer_id)
      return res.status(403).json({ message: 'Only the buyer can release the funds' });
    if (tx.status !== 'payment_in_escrow')
      return res.status(409).json({ message: 'Funds can only be released from escrow' });

    const payout = await getPayout(tx.seller_id);
    if (!payout?.payout_method)
      return res.status(409).json({ message: 'The seller has not added payout details yet' });
    if (payout.payout_method === 'ng_bank') {
      if (!payout.bank_code || !payout.account_number)
        return res.status(409).json({ message: 'The seller has not added payout details yet' });
      if (!FLW.isConfigured())
        return res.status(503).json({ message: 'Payments are not configured yet' });
    }

    let result;
    try {
      result = await payOutToSeller(payout, { amount: Number(tx.amount), currency: tx.currency || 'NGN', txId: tx.id });
    } catch (e) {
      return res.status(502).json({ message: e.message || 'Payout could not be initiated' });
    }

    const updated = await markReleased(tx.id, result.transferRef, result.status);
    res.json({
      message: result.status === 'pending'
        ? 'Released — the international payout is queued for settlement'
        : 'Funds released to the seller',
      transaction: updated,
    });
  } catch (err) {
    console.error('payment release:', err.message);
    res.status(502).json({ message: 'Could not release the funds' });
  }
});

// GET /payments/pending-payouts — admin: international releases awaiting manual settlement.
router.get('/pending-payouts', authenticate, authorize('admin'), async (_req, res) => {
  try { res.json(await pendingPayouts()); }
  catch (err) { console.error('pending payouts:', err.message); res.status(500).json({ message: 'Failed to load pending payouts' }); }
});

// POST /payments/mark-payout-paid { transactionId } — admin marks an international payout settled.
router.post('/mark-payout-paid', authenticate, authorize('admin'), async (req, res) => {
  try {
    const txId = toId(req.body.transactionId);
    if (!txId) return res.status(400).json({ message: 'A valid transactionId is required' });
    const updated = await markPayoutPaid(txId);
    if (!updated) return res.status(409).json({ message: 'No pending payout for that transaction' });
    res.json({ message: 'Marked as paid', transaction: updated });
  } catch (err) { console.error('mark payout paid:', err.message); res.status(500).json({ message: 'Failed to update' }); }
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
    const evt = req.body || {};
    const data = evt.data || {};

    // Payout (transfer) events — reconcile a release. If a payout ultimately fails,
    // put the funds back into escrow so it can be retried.
    if (evt.event === 'transfer.completed' || (data.reference && String(data.reference).startsWith('4kautos-payout-'))) {
      if (String(data.status).toUpperCase() === 'FAILED') {
        const reverted = await revertRelease(data.reference);
        if (reverted) console.error(`⚠️ payout failed → reverted to escrow: ${data.reference}`);
      } else {
        console.log(`✅ payout settled: ${data.reference}`);
      }
      return;
    }

    // Charge (collection) events — fund escrow.
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
