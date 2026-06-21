import express from 'express';
import crypto from 'crypto';
import jwt    from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { findByEmail, create, setResetToken, findByResetToken, updatePassword,
         setVerifyToken, findByVerifyToken, markEmailVerified, findById as findUserById, setLocation } from '../models/User.js';
import { isValidEmail } from '../utils/validation.js';
import { authLimiter } from '../middleware/security.js';
import { authenticate } from '../middleware/auth.js';
import { sendPasswordReset, sendVerifyEmail, isEmailConfigured } from '../utils/email.js';
import { baseUrl } from '../utils/url.js';

const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');

async function issueVerify(req, user) {
  const token = crypto.randomBytes(32).toString('hex');
  await setVerifyToken(user.id, hashToken(token), new Date(Date.now() + 24 * 60 * 60 * 1000));
  sendVerifyEmail(user.email, `${baseUrl(req)}/auth/verify?token=${token}`).catch(() => {});
}

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

    // Verification wall — only meaningful when we can actually send the email.
    if (isEmailConfigured()) {
      await issueVerify(req, user);
      return res.status(201).json({
        message: 'Account created — check your email to verify your address before signing in.',
        verifyRequired: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, location: user.location ?? null },
      });
    }

    // $0 / no-email mode: auto-verify and sign in immediately (no regression).
    await markEmailVerified(user.id);
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      message: 'Account created',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, location: user.location ?? null },
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

    // Email-verification wall — enforced only when an email driver is configured
    // (otherwise we'd lock everyone out, since no verification link can be sent).
    if (isEmailConfigured() && !user.email_verified) {
      return res.status(403).json({
        message: 'Please verify your email first — check your inbox for the link.',
        verifyRequired: true,
      });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, location: user.location ?? null },
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
        sendPasswordReset(user.email, `${baseUrl(req)}/reset.html?token=${token}`).catch(() => {}); // no-ops at $0
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

// GET /auth/verify?token=… — landing page for the emailed verification link.
// Returns a small self-contained HTML page (it's opened directly in a browser).
router.get('/verify', async (req, res) => {
  const page = (title, body) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${title} · 4Kautos</title></head>
     <body style="font-family:system-ui,Segoe UI,Arial,sans-serif;background:#0c0c14;color:#e8e8f0;display:grid;place-items:center;min-height:100vh;margin:0">
       <div style="max-width:420px;text-align:center;padding:2rem">
         <div style="font-weight:800;letter-spacing:2px;color:#8b7cff;margin-bottom:1rem">4KAUTOS</div>
         <h1 style="font-size:1.3rem;margin:.2rem 0">${title}</h1>
         <p style="color:#a8a8c0;line-height:1.5">${body}</p>
         <a href="/" style="display:inline-block;margin-top:1.2rem;background:#6d4dff;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:700">Go to 4Kautos</a>
       </div></body></html>`;
  try {
    const token = String(req.query.token || '');
    if (!token) return res.status(400).send(page('Invalid link', 'This verification link is missing its token.'));
    const user = await findByVerifyToken(hashToken(token));
    if (!user) return res.status(400).send(page('Link expired', 'This verification link is invalid or has expired. Sign in to request a new one.'));
    await markEmailVerified(user.id);
    res.send(page('Email verified ✓', 'Your email is confirmed. You can now sign in to your account.'));
  } catch (err) {
    console.error('verify:', err.message);
    res.status(500).send(page('Something went wrong', 'Please try the link again in a moment.'));
  }
});

// POST /auth/resend { email } — re-send a verification link (always 200; no leak).
router.post('/resend', authLimiter, async (req, res) => {
  const ok = { message: 'If that account exists and still needs verifying, a new link is on its way.' };
  try {
    if (!isEmailConfigured()) return res.json({ message: 'Email verification is not required right now.' });
    const email = String(req.body.email || '').trim();
    if (isValidEmail(email)) {
      const user = await findByEmail(email);
      if (user && !user.email_verified) await issueVerify(req, user);
    }
    res.json(ok);
  } catch (err) {
    console.error('resend:', err.message);
    res.json(ok);
  }
});

// GET /auth/me — the signed-in user's own safe profile (incl. saved location).
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('auth/me:', err.message);
    res.status(500).json({ message: 'Could not load profile' });
  }
});

// PATCH /auth/me { location } — update the user's saved location/locale.
router.patch('/me', authenticate, async (req, res) => {
  try {
    const location = typeof req.body.location === 'string' ? req.body.location.trim().slice(0, 160) : '';
    const user = await setLocation(req.user.id, location || null);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Saved', user });
  } catch (err) {
    console.error('auth/me update:', err.message);
    res.status(500).json({ message: 'Could not save your location' });
  }
});

export default router;
