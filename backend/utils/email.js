import nodemailer from 'nodemailer';
import { pool } from '../config/db.js';

/* Email delivery, in priority order:
   1. Resend   — set RESEND_API_KEY (recommended for production deliverability).
   2. Gmail SMTP — set GMAIL_USER + GMAIL_APP_PASSWORD (a Google App Password).
   3. Neither   — email is silently skipped, so the app still works in dev.
   The "from" address is MAIL_FROM (falls back to your Gmail, then Resend's
   shared test sender which works with no domain setup). */

// Resend's onboarding@resend.dev works without verifying a domain — good for the
// first smoke test. Switch MAIL_FROM to your own verified domain for real sends.
// From address. When RESEND_API_KEY is set we default to Resend's shared test
// sender (a lingering GMAIL_USER must NOT become the Resend "from" — Resend
// rejects unverified addresses). Set MAIL_FROM to your verified domain for prod.
const MAIL_FROM = process.env.MAIL_FROM
  || (process.env.RESEND_API_KEY ? '4Kautos <onboarding@resend.dev>'
    : process.env.GMAIL_USER    ? `4Kautos <${process.env.GMAIL_USER}>`
    : '4Kautos <onboarding@resend.dev>');

let transporter; // undefined = not built yet, false = disabled
function getTransporter() {
  if (transporter !== undefined) return transporter;
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  // Force IPv4 (PaaS containers often have no IPv6 route → connect ENETUNREACH on
  // Gmail's IPv6 SMTP address) and cap the timeouts so a blocked SMTP port fails
  // fast instead of hanging. If SMTP is filtered outright, use RESEND_API_KEY.
  transporter = (user && pass)
    ? nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user, pass },
        family: 4,
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      })
    : false;
  return transporter;
}

// Resend HTTP API — no SDK needed (Node 18+ global fetch).
async function sendViaResend(to, subject, html) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to, subject, html }),
    });
    if (!res.ok) { console.error('Resend error:', res.status, await res.text().catch(() => '')); return false; }
    return true;
  } catch (e) { console.error('Resend send failed:', e.message); return false; }
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function shell(title, bodyHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2c">
    <div style="background:linear-gradient(135deg,#8b7cff,#22d3ee);padding:20px 24px;border-radius:12px 12px 0 0">
      <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:1px">4KAUTOS</span>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>
      ${bodyHtml}
      <p style="margin-top:24px;font-size:12px;color:#888">4Kautos — global preowned-car marketplace.</p>
    </div></div>`;
}

// True when a real delivery driver is configured. Callers use this to decide
// whether to enforce flows that depend on email actually being sent (e.g. the
// email-verification login wall) — when false we must not lock users out.
export function isEmailConfigured() {
  return !!(process.env.RESEND_API_KEY || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD));
}

export async function sendMail(to, subject, html) {
  if (process.env.RESEND_API_KEY) return sendViaResend(to, subject, html);
  const t = getTransporter();
  if (!t) { console.log(`[email skipped — set RESEND_API_KEY or GMAIL_USER/GMAIL_APP_PASSWORD] → ${to}: ${subject}`); return false; }
  try {
    await t.sendMail({ from: MAIL_FROM, to, subject, html });
    return true;
  } catch (e) { console.error('Email send failed:', e.message); return false; }
}

export async function sendWelcome(email) {
  return sendMail(email, 'Welcome to the 4Kautos weekly drop 🚗',
    shell('You’re in!',
      `<p>Thanks for subscribing. Each week we’ll send fresh arrivals, price moves and import tips straight to your inbox.</p>
       <p><a href="#" style="display:inline-block;background:#6d4dff;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700">Browse the latest cars</a></p>`));
}

// Notify the other party in a thread that they received a message.
export async function notifyNewMessage({ buyerId, sellerId, senderId, car }) {
  try {
    const recipientId = senderId === buyerId ? sellerId : buyerId;
    const [[recip]]  = await pool.query('SELECT name, email FROM users WHERE id = ?', [recipientId]);
    const [[sender]] = await pool.query('SELECT name FROM users WHERE id = ?', [senderId]);
    if (!recip?.email) return false;
    const carTitle = car?.title || 'your listing';
    return sendMail(recip.email, `New message about ${carTitle}`,
      shell('You have a new message',
        `<p>Hi ${esc(recip.name)},</p>
         <p><b>${esc(sender?.name || 'A 4Kautos user')}</b> sent you a message about <b>${esc(carTitle)}</b>.</p>
         <p>Open your dashboard → <b>Messages</b> to read and reply.</p>`));
  } catch (e) { console.error('notifyNewMessage:', e.message); return false; }
}

// Notify the support inbox that a contact-form message arrived. Recipient:
// CONTACT_EMAIL → ADMIN_EMAIL → GMAIL_USER (else skipped/logged in $0 mode).
export async function notifyContactMessage({ name, email, message }) {
  const to = process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
  if (!to) { console.log(`[contact email skipped — set CONTACT_EMAIL/ADMIN_EMAIL] from ${email}`); return false; }
  return sendMail(to, `New contact message from ${name}`,
    shell('New contact message',
      `<p><b>From:</b> ${esc(name)} &lt;${esc(email)}&gt;</p>
       <p><b>Message:</b></p>
       <p style="white-space:pre-wrap;background:#f6f6fb;padding:12px;border-radius:8px">${esc(message)}</p>`));
}

// Alert a buyer that a new listing matches one of their saved searches.
export async function notifySavedSearchMatch({ to, name, car }) {
  if (!to || !car) return false;
  const base = process.env.APP_BASE_URL || '';
  const title = car.title || [car.year, car.make, car.model].filter(Boolean).join(' ');
  const sym = (car.currency || 'NGN') === 'USD' ? '$' : '₦';
  const price = car.price != null ? `${sym}${Number(car.price).toLocaleString('en-US')}` : 'Price on request';
  const link = `${base}/detail.html?id=${car.id}`;
  const bits = [price, car.mileage != null ? `${Number(car.mileage).toLocaleString('en-US')} km` : null, car.location]
    .filter(Boolean).join(' · ');
  return sendMail(to, `New match for your search: ${title}`,
    shell('A car matching your search just landed',
      `<p>Hi ${esc(name || 'there')},</p>
       <p>A new listing matches one of your saved searches on 4Kautos:</p>
       <p style="font-size:16px;font-weight:700;margin:.4rem 0">${esc(title)}</p>
       <p style="color:#555">${esc(bits)}</p>
       <p><a href="${esc(link)}" style="display:inline-block;background:#6d4dff;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700">View the listing</a></p>
       <p style="font-size:12px;color:#888">You're getting this because you saved a search on 4Kautos. Manage your saved searches from your dashboard.</p>`));
}

// Email-verification link (expires in 24 hours).
export async function sendVerifyEmail(email, link) {
  return sendMail(email, 'Confirm your 4Kautos email',
    shell('Confirm your email',
      `<p>Welcome to 4Kautos! Please confirm this email address to activate your account. This link expires in 24 hours:</p>
       <p><a href="${esc(link)}" style="display:inline-block;background:#6d4dff;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700">Verify email</a></p>
       <p style="font-size:12px;color:#888">If you didn't create a 4Kautos account, you can safely ignore this email.</p>`));
}

// Password-reset link (expires in 1 hour).
export async function sendPasswordReset(email, link) {
  return sendMail(email, 'Reset your 4Kautos password',
    shell('Password reset',
      `<p>We received a request to reset your password. This link expires in 1 hour:</p>
       <p><a href="${esc(link)}" style="display:inline-block;background:#6d4dff;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700">Reset password</a></p>
       <p style="font-size:12px;color:#888">If you didn't request this, you can safely ignore this email.</p>`));
}
