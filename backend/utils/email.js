import nodemailer from 'nodemailer';
import { pool } from '../config/db.js';

/* Gmail SMTP. Set GMAIL_USER + GMAIL_APP_PASSWORD (a Google App Password, not your
   normal password) in .env. If they're absent, email is silently skipped so the
   app still works in development. */
let transporter; // undefined = not built yet, false = disabled
function getTransporter() {
  if (transporter !== undefined) return transporter;
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  transporter = (user && pass)
    ? nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
    : false;
  return transporter;
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

export async function sendMail(to, subject, html) {
  const t = getTransporter();
  if (!t) { console.log(`[email skipped — set GMAIL_USER/GMAIL_APP_PASSWORD] → ${to}: ${subject}`); return false; }
  try {
    await t.sendMail({ from: `4Kautos <${process.env.GMAIL_USER}>`, to, subject, html });
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
