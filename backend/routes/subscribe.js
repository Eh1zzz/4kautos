import express from 'express';
import { pool } from '../config/db.js';
import { isValidEmail } from '../utils/validation.js';
import { sendWelcome } from '../utils/email.js';

const router = express.Router();

// POST /subscribe — capture a newsletter email (idempotent). Actual sending is
// wired separately once an email provider is configured.
router.post('/', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!isValidEmail(email))
      return res.status(400).json({ message: 'A valid email is required' });

    const [r] = await pool.query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [email]);
    if (r.affectedRows > 0) sendWelcome(email).catch(() => {}); // welcome only on first subscribe
    res.status(201).json({ message: 'Subscribed' });
  } catch (err) {
    console.error('Subscribe:', err.message);
    res.status(500).json({ message: 'Could not subscribe right now' });
  }
});

export default router;
