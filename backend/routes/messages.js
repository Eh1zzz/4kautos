import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { toId } from '../utils/validation.js';
import { findById as findCarById } from '../models/Car.js';
import * as Messages from '../models/Message.js';
import { notifyNewMessage } from '../utils/email.js';

const router = express.Router();
router.use(authenticate);

// GET /messages/threads — the current user's conversations
router.get('/threads', async (req, res) => {
  try { res.json(await Messages.listThreads(req.user.id)); }
  catch (err) { console.error('threads:', err.message); res.status(500).json({ message: 'Failed to load conversations' }); }
});

// GET /messages/unread — count for a nav badge
router.get('/unread', async (req, res) => {
  try { res.json({ count: await Messages.unreadCount(req.user.id) }); }
  catch { res.status(500).json({ message: 'Failed' }); }
});

// Resolve a thread (carId [+ buyerId]) and authorise the current user.
async function resolveThread(req) {
  const carId = toId(req.query.carId ?? req.body.carId);
  if (!carId) return { error: [400, 'A valid carId is required'] };
  const car = await findCarById(carId);
  if (!car) return { error: [404, 'Car not found'] };
  const sellerId = car.seller_id;
  let buyerId;
  if (req.user.id === sellerId) {                       // seller side → buyer must be named
    buyerId = toId(req.query.buyerId ?? req.body.buyerId);
    if (!buyerId) return { error: [400, 'buyerId is required for the seller'] };
  } else {                                              // buyer side → their own thread
    buyerId = req.user.id;
  }
  if (req.user.id !== buyerId && req.user.id !== sellerId)
    return { error: [403, 'Not authorized for this conversation'] };
  return { carId, buyerId, sellerId, car };
}

// GET /messages?carId=&buyerId= — a thread's messages (also marks them read)
router.get('/', async (req, res) => {
  try {
    const t = await resolveThread(req);
    if (t.error) return res.status(t.error[0]).json({ message: t.error[1] });
    const messages = await Messages.listMessages(t.carId, t.buyerId);
    await Messages.markRead(t.carId, t.buyerId, req.user.id);
    res.json({ carId: t.carId, buyerId: t.buyerId, sellerId: t.sellerId, messages });
  } catch (err) { console.error('thread:', err.message); res.status(500).json({ message: 'Failed to load messages' }); }
});

// POST /messages { carId, body, buyerId? } — send a message
router.post('/', async (req, res) => {
  try {
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!body) return res.status(400).json({ message: 'Message body is required' });
    if (body.length > 2000) return res.status(400).json({ message: 'Message is too long (max 2000 chars)' });

    const t = await resolveThread(req);
    if (t.error) return res.status(t.error[0]).json({ message: t.error[1] });
    if (t.sellerId === req.user.id && t.buyerId === req.user.id)
      return res.status(400).json({ message: 'You cannot message yourself' });

    const msg = await Messages.create({ carId: t.carId, buyerId: t.buyerId, sellerId: t.sellerId, senderId: req.user.id, body });
    notifyNewMessage({ buyerId: t.buyerId, sellerId: t.sellerId, senderId: req.user.id, car: t.car }).catch(() => {});
    res.status(201).json(msg);
  } catch (err) { console.error('send message:', err.message); res.status(500).json({ message: 'Failed to send message' }); }
});

export default router;
