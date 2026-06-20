import express from 'express';
import rateLimit from 'express-rate-limit';
import { create } from '../models/ContactMessage.js';
import { notifyContactMessage } from '../utils/email.js';
import { isValidEmail } from '../utils/validation.js';

const router = express.Router();

// Tight limiter — this is a public, unauthenticated endpoint.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many messages — please try again later.' },
});

// POST /contact { name, email, message, website? } — public "Send us a message".
router.post('/', contactLimiter, async (req, res) => {
  try {
    // Honeypot: real users leave `website` empty; bots fill it. Silently accept + drop.
    if (req.body.website) return res.status(201).json({ message: 'Message received' });

    const name = String(req.body.name || '').trim().slice(0, 120);
    const email = String(req.body.email || '').trim().slice(0, 255);
    const message = String(req.body.message || '').trim().slice(0, 4000);
    if (!name || !message) return res.status(400).json({ message: 'Name and message are required' });
    if (!isValidEmail(email)) return res.status(400).json({ message: 'A valid email is required' });

    await create({ name, email, message });
    // Fire-and-forget — no-ops (logs) if no email provider is configured ($0 mode).
    notifyContactMessage({ name, email, message }).catch(() => {});
    res.status(201).json({ message: "Message received — we'll be in touch" });
  } catch (err) {
    console.error('POST /contact:', err.message);
    res.status(500).json({ message: 'Could not send your message' });
  }
});

export default router;
