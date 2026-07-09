import request from 'supertest';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';
import { generateSecret, verifyCode, base32Decode, base32Encode } from '../utils/totp.js';
import crypto from 'crypto';

// Compute the current code the same way an authenticator app would, so we can
// drive the real login/enable flow without a phone.
function currentCode(secret, offsetSteps = 0) {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30) + offsetSteps;
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

describe('TOTP util', () => {
  it('base32 round-trips', () => {
    const b = crypto.randomBytes(20);
    expect(base32Decode(base32Encode(b)).equals(b)).toBe(true);
  });
  it('accepts a correct code and rejects a wrong one, honouring ±1 step drift', () => {
    const s = generateSecret();
    expect(verifyCode(s, currentCode(s))).toBe(true);
    expect(verifyCode(s, currentCode(s, -1))).toBe(true);  // clock skew
    expect(verifyCode(s, currentCode(s, +1))).toBe(true);
    expect(verifyCode(s, currentCode(s, +5))).toBe(false); // too far
    expect(verifyCode(s, '000000')).toBe(false);
    expect(verifyCode(s, 'abc')).toBe(false);
  });
});

describe('admin 2FA login flow', () => {
  let adminToken, adminEmail = 'totp-admin@test.com', secret;

  beforeAll(async () => {
    await connectDB();
    await request(app).post('/auth/signup')
      .send({ name: 'TOTP Admin', email: adminEmail, password: 'password123', role: 'buyer' });
    await pool.query("UPDATE users SET role = 'admin' WHERE email = ?", [adminEmail]);
    adminToken = (await request(app).post('/auth/login')
      .send({ email: adminEmail, password: 'password123' })).body.token;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = ?", [adminEmail]);
    await pool.end();
  });

  it('setup → enable requires a valid code, then login demands the code', async () => {
    // Setup returns a secret + otpauth URI, not yet enabled.
    const setup = await request(app).post('/auth/2fa/setup').set('Authorization', `Bearer ${adminToken}`);
    expect(setup.status).toBe(200);
    expect(setup.body.otpauth).toMatch(/^otpauth:\/\/totp\//);
    secret = setup.body.secret;

    // A wrong code can't enable it.
    expect((await request(app).post('/auth/2fa/enable').set('Authorization', `Bearer ${adminToken}`)
      .send({ code: '000000' })).status).toBe(400);

    // The right code enables it.
    expect((await request(app).post('/auth/2fa/enable').set('Authorization', `Bearer ${adminToken}`)
      .send({ code: currentCode(secret) })).status).toBe(200);

    // Password alone now returns totpRequired (no token).
    const step1 = await request(app).post('/auth/login').send({ email: adminEmail, password: 'password123' });
    expect(step1.status).toBe(200);
    expect(step1.body.totpRequired).toBe(true);
    expect(step1.body.token).toBeUndefined();

    // A wrong code is rejected.
    expect((await request(app).post('/auth/login')
      .send({ email: adminEmail, password: 'password123', totp: '000000' })).status).toBe(401);

    // Password + correct code completes the login.
    const step2 = await request(app).post('/auth/login')
      .send({ email: adminEmail, password: 'password123', totp: currentCode(secret) });
    expect(step2.status).toBe(200);
    expect(step2.body.token).toBeTruthy();
  });

  it('disable requires a current code and restores single-factor login', async () => {
    const tok = (await request(app).post('/auth/login')
      .send({ email: adminEmail, password: 'password123', totp: currentCode(secret) })).body.token;
    expect((await request(app).post('/auth/2fa/disable').set('Authorization', `Bearer ${tok}`)
      .send({ code: '000000' })).status).toBe(400);
    expect((await request(app).post('/auth/2fa/disable').set('Authorization', `Bearer ${tok}`)
      .send({ code: currentCode(secret) })).status).toBe(200);
    // Login is single-factor again.
    const after = await request(app).post('/auth/login').send({ email: adminEmail, password: 'password123' });
    expect(after.body.token).toBeTruthy();
    expect(after.body.totpRequired).toBeUndefined();
  });
});
