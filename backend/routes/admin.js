import express from 'express';
import { findAll as findAllUsers, verifyById, deleteById as deleteUserById } from '../models/User.js';
import { findAllAdmin, deleteById as deleteCarById, setFeatured } from '../models/Car.js';
import { findAll as findAllTx, setDisputed } from '../models/Transaction.js';
import { findAll as findContactMessages, deleteById as deleteContactMessage } from '../models/ContactMessage.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { toId } from '../utils/validation.js';
import { runBackfill } from '../utils/backfillImages.js';
import { pool } from '../config/db.js';
import { getRate } from './fx.js';

const router = express.Router();
router.use(authenticate, authorize('admin'));

// GET /admin/stats — operational telemetry for the dashboard. All money figures
// are USD-normalised (amounts are snapshotted per-currency) via the live FX rate.
router.get('/stats', async (_req, res) => {
  try {
    const { usdToNgn } = await getRate();
    const usd = "SUM(CASE WHEN currency = 'USD' THEN amount ELSE amount / ? END)"; // NULL amounts ignored by SUM
    const [byStatus] = await pool.query(`SELECT status, COUNT(*) AS n, ${usd} AS usd FROM transactions GROUP BY status`, [usdToNgn]);
    const [[today]]  = await pool.query('SELECT COUNT(*) AS n FROM transactions WHERE created_at >= CURDATE()');
    const [[pend]]   = await pool.query(`SELECT COUNT(*) AS n, ${usd} AS usd FROM transactions WHERE payout_status = 'pending'`, [usdToNgn]);
    const [roles]    = await pool.query('SELECT role, COUNT(*) AS n FROM users GROUP BY role');
    const [[cars]]   = await pool.query('SELECT COUNT(*) AS n, SUM(featured) AS featured FROM cars');

    const S = Object.fromEntries(byStatus.map(r => [r.status, { count: Number(r.n), usd: Math.round(Number(r.usd) || 0) }]));
    const role = Object.fromEntries(roles.map(r => [r.role, Number(r.n)]));
    const at = k => S[k] || { count: 0, usd: 0 };

    res.json({
      fx: { usdToNgn },
      transactions: { total: byStatus.reduce((a, r) => a + Number(r.n), 0), today: Number(today.n), byStatus: S },
      escrow: {
        inEscrowUsd: at('payment_in_escrow').usd,
        completedUsd: at('completed').usd,
        pendingPayoutUsd: Math.round(Number(pend.usd) || 0),
        pendingPayoutCount: Number(pend.n),
      },
      funnel: { initiated: at('initiated').count, inEscrow: at('payment_in_escrow').count, completed: at('completed').count },
      counts: {
        users: Object.values(role).reduce((a, b) => a + b, 0),
        buyers: role.buyer || 0, sellers: role.seller || 0, admins: role.admin || 0,
        listings: Number(cars.n) || 0, featured: Number(cars.featured) || 0,
      },
    });
  } catch (err) {
    console.error('admin stats:', err.message);
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

// GET /admin/flags — risk & moderation signals derived from existing data
// (no ML): under-market listings, duplicate VINs, unverified sellers with live
// inventory, and buyers who keep opening transactions but never pay.
router.get('/flags', async (_req, res) => {
  try {
    const { usdToNgn } = await getRate();
    const carUsd = "(CASE WHEN c.currency = 'USD' THEN c.price ELSE c.price / ? END)";

    const [underpriced] = await pool.query(
      `WITH bench AS (
         SELECT make, model, AVG(CASE WHEN currency = 'USD' THEN price ELSE price / ? END) AS avg_usd, COUNT(*) AS n
         FROM cars WHERE price IS NOT NULL AND make IS NOT NULL AND model IS NOT NULL GROUP BY make, model
       )
       SELECT c.id, c.title, c.make, c.model, c.price, c.currency, c.seller_id, s.name AS seller_name,
              ROUND(${carUsd}) AS car_usd, ROUND(b.avg_usd) AS avg_usd, b.n AS comparables,
              ROUND(100 * (1 - ${carUsd} / b.avg_usd)) AS pct_below
       FROM cars c JOIN bench b ON b.make = c.make AND b.model = c.model JOIN users s ON s.id = c.seller_id
       WHERE b.n >= 4 AND ${carUsd} < 0.6 * b.avg_usd
       ORDER BY pct_below DESC LIMIT 50`,
      [usdToNgn, usdToNgn, usdToNgn, usdToNgn]
    );

    const [dupVins] = await pool.query(
      `SELECT vin, COUNT(*) AS n, GROUP_CONCAT(id ORDER BY id) AS car_ids
       FROM cars WHERE vin IS NOT NULL AND vin <> '' GROUP BY vin HAVING n > 1 ORDER BY n DESC LIMIT 50`
    );

    const [unverifiedSellers] = await pool.query(
      `SELECT s.id, s.name, s.email, COUNT(c.id) AS listings
       FROM users s JOIN cars c ON c.seller_id = s.id
       WHERE s.verified = 0 AND s.role = 'seller' GROUP BY s.id, s.name, s.email
       ORDER BY listings DESC LIMIT 50`
    );

    const [stalledBuyers] = await pool.query(
      `SELECT b.id, b.name, b.email, COUNT(*) AS open_unpaid
       FROM transactions t JOIN users b ON b.id = t.buyer_id
       WHERE t.status = 'initiated' GROUP BY b.id, b.name, b.email HAVING open_unpaid >= 3
       ORDER BY open_unpaid DESC LIMIT 50`
    );

    res.json({
      underpriced,
      duplicateVins: dupVins.map(r => ({ vin: r.vin, count: Number(r.n), carIds: String(r.car_ids).split(',').map(Number) })),
      unverifiedSellers,
      stalledBuyers,
      total: underpriced.length + dupVins.length + unverifiedSellers.length + stalledBuyers.length,
    });
  } catch (err) {
    console.error('admin flags:', err.message);
    res.status(500).json({ message: 'Failed to load risk flags' });
  }
});

// GET /admin/activity — a merged recent-activity feed across listings,
// transactions, contact messages and signups (newest first). Polled on the
// dashboard; a true live push is a future Socket.IO enhancement.
router.get('/activity', async (_req, res) => {
  try {
    const [cars] = await pool.query("SELECT id, COALESCE(NULLIF(title,''), CONCAT(make,' ',model)) AS label, created_at FROM cars ORDER BY created_at DESC LIMIT 8");
    const [txs]  = await pool.query("SELECT t.id, t.status, t.created_at, b.name AS buyer, COALESCE(c.title, CONCAT(c.make,' ',c.model)) AS car FROM transactions t JOIN users b ON b.id = t.buyer_id LEFT JOIN cars c ON c.id = t.car_id ORDER BY t.created_at DESC LIMIT 8");
    const [msgs] = await pool.query("SELECT id, name, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 5");
    const [users]= await pool.query("SELECT id, name, role, created_at FROM users ORDER BY created_at DESC LIMIT 5");

    const items = [
      ...cars.map(c  => ({ type: 'listing',     text: `New listing — ${c.label}`,                       at: c.created_at, link: `detail.html?id=${c.id}` })),
      ...txs.map(t   => ({ type: 'transaction', text: `${t.buyer} → ${t.car || 'listing'} (${String(t.status).replace(/_/g, ' ')})`, at: t.created_at })),
      ...msgs.map(m  => ({ type: 'contact',     text: `Contact message from ${m.name}`,                 at: m.created_at })),
      ...users.map(u => ({ type: 'user',        text: `New ${u.role} — ${u.name}`,                      at: u.created_at })),
    ].filter(x => x.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 20);

    res.json({ items });
  } catch (err) {
    console.error('admin activity:', err.message);
    res.status(500).json({ message: 'Failed to load activity' });
  }
});

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

router.get('/contact-messages', async (_req, res) => {
  try { res.json(await findContactMessages()); }
  catch { res.status(500).json({ message: 'Failed to fetch messages' }); }
});

router.delete('/contact-messages/:id', async (req, res) => {
  try {
    const deleted = await deleteContactMessage(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ message: 'Failed to delete message' }); }
});

// POST /admin/backfill-images?apply=1 — regenerate responsive variants for old
// uploads (runs inside the deployed app, so it has the live R2 + DB env). Dry-run
// by default; pass ?apply=1 to write. Idempotent + non-destructive.
router.post('/backfill-images', async (req, res) => {
  try {
    const apply = req.query.apply === '1' || req.body?.apply === true;
    const summary = await runBackfill({ apply });
    res.json({ message: apply ? 'Image backfill complete' : 'Dry run complete', ...summary });
  } catch (err) {
    console.error('admin backfill-images:', err.message);
    res.status(500).json({ message: err.message || 'Backfill failed' });
  }
});

export default router;
