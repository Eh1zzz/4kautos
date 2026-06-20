import express from 'express';
import crypto from 'crypto';
import jwt    from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { findByEmail, create, setResetToken, findByResetToken, updatePassword } from '../models/User.js';
import { isValidEmail } from '../utils/validation.js';
import { authLimiter } from '../middleware/security.js';
import { sendPasswordReset } from '../utils/email.js';

const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');

const router = express.Router();

// Roles a user is allowed to self-assign at signup. 'admin' must NEVER be
// grantable from the request body — that was a privilege-escalation hole.
const SELF_SIGNUP_ROLES = ['buyer', 'seller'];

// POST /auth/signup
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name?.trim() || !email?.trim() || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });
    if (!isValidEmail(email))
      return res.status(400).json({ message: 'Please enter a valid email address' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (password.length > 200)
      return res.status(400).json({ message: 'Password is too long' });

    if (await findByEmail(email))
      return res.status(409).json({ message: 'An account with this email already exists' });

    const safeRole = SELF_SIGNUP_ROLES.includes(role) ? role : 'buyer';
    const hashed = await bcrypt.hash(password, 12);
    const user   = await create(name.trim(), email, hashed, safeRole);

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      message: 'Account created',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Signup:', err.message);
    res.status(500).json({ message: 'Signup failed' });
  }
});

// POST /auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await findByEmail(email);
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login:', err.message);
    res.status(500).json({ message: 'Login failed' });
  }
});

// POST /auth/forgot { email } — always 200 (never reveal whether an account exists).
router.post('/forgot', authLimiter, async (req, res) => {
  const ok = { message: 'If that email has an account, a reset link is on its way.' };
  try {
    const email = String(req.body.email || '').trim();
    if (isValidEmail(email)) {
      const user = await findByEmail(email);
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await setResetToken(user.id, hashToken(token), expires);
        let base = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
        try { base = new URL(base).origin; } catch { base = `${req.protocol}://${req.get('host')}`; }
        sendPasswordReset(user.email, `${base}/reset.html?token=${token}`).catch(() => {}); // no-ops at $0
      }
    }
    res.json(ok);
  } catch (err) {
    console.error('forgot:', err.message);
    res.json(ok); // still don't leak anything
  }
});

// POST /auth/reset { token, password } — consume a valid token and set the new password.
router.post('/reset', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and new password are required' });
    if (password.length < 6)  return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (password.length > 200) return res.status(400).json({ message: 'Password is too long' });

    const user = await findByResetToken(hashToken(token));
    if (!user) return res.status(400).json({ message: 'This reset link is invalid or has expired' });

    await updatePassword(user.id, await bcrypt.hash(password, 12));
    res.json({ message: 'Password updated — you can now sign in' });
  } catch (err) {
    console.error('reset:', err.message);
    res.status(500).json({ message: 'Could not reset password' });
  }
});

export default router;
