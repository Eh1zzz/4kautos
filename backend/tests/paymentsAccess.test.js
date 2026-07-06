import request from 'supertest';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';

/* Access control on /payments/resolve-account: it proxies a paid Flutterwave
   lookup that maps bank account numbers to holder names, so it must be
   seller-only — not a PII probe open to any logged-in buyer. */

let buyerToken, sellerToken;

beforeAll(async () => {
  await connectDB();
  const b = await request(app).post('/auth/signup')
    .send({ name: 'Pay Buyer', email: 'pay-buyer@test.com', password: 'password123', role: 'buyer' });
  buyerToken = b.body.token;
  const s = await request(app).post('/auth/signup')
    .send({ name: 'Pay Seller', email: 'pay-seller@test.com', password: 'password123', role: 'seller' });
  sellerToken = s.body.token;
  // Deterministic regardless of suite order (--runInBand shares the process,
  // and flutterwave.test.js sets a fake key): run as NOT configured.
  delete process.env.FLW_SECRET_KEY;
});

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE email IN ('pay-buyer@test.com','pay-seller@test.com')");
  await pool.end();
});

describe('POST /payments/resolve-account access control', () => {
  const body = { accountNumber: '0690000031', bankCode: '044' };

  it('rejects anonymous callers (401)', async () => {
    const r = await request(app).post('/payments/resolve-account').send(body);
    expect(r.status).toBe(401);
  });

  it('rejects buyers (403) — seller-only', async () => {
    const r = await request(app).post('/payments/resolve-account')
      .set('Authorization', `Bearer ${buyerToken}`).send(body);
    expect(r.status).toBe(403);
  });

  it('lets a seller through the gate (503 here — Flutterwave unconfigured in test)', async () => {
    const r = await request(app).post('/payments/resolve-account')
      .set('Authorization', `Bearer ${sellerToken}`).send(body);
    expect(r.status).toBe(503); // past authz, stopped only by the missing FLW key
  });
});
