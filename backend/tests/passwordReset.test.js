import request from 'supertest';
import crypto  from 'crypto';
import app     from '../server.js';
import { pool, connectDB } from '../config/db.js';

const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const email = 'pwreset@test.com';

beforeAll(async () => {
  await connectDB();
  await pool.query('DELETE FROM users WHERE email = ?', [email]);
  await request(app).post('/auth/signup').send({ name: 'PW User', email, password: 'oldpass123', role: 'buyer' });
}, 30000);

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ?', [email]);
  await pool.end();
});

describe('Password reset', () => {
  it('forgot returns 200 for an existing email (no enumeration)', async () => {
    const r = await request(app).post('/auth/forgot').send({ email });
    expect(r.status).toBe(200);
  });

  it('forgot returns 200 for a non-existent email (no enumeration)', async () => {
    const r = await request(app).post('/auth/forgot').send({ email: 'nobody@nowhere.test' });
    expect(r.status).toBe(200);
  });

  it('reset rejects an invalid token (400)', async () => {
    const r = await request(app).post('/auth/reset').send({ token: 'bogus-token', password: 'newpass123' });
    expect(r.status).toBe(400);
  });

  it('reset rejects a weak password (400)', async () => {
    const r = await request(app).post('/auth/reset').send({ token: 'anything', password: '123' });
    expect(r.status).toBe(400);
  });

  it('consumes a valid token, changes the password, and is single-use', async () => {
    const token = 'known-test-token-abc123';
    await pool.query('UPDATE users SET reset_token_hash = ?, reset_expires = ? WHERE email = ?',
      [hashToken(token), new Date(Date.now() + 3600000), email]);

    const reset = await request(app).post('/auth/reset').send({ token, password: 'brandnew123' });
    expect(reset.status).toBe(200);

    const login = await request(app).post('/auth/login').send({ email, password: 'brandnew123' });
    expect(login.status).toBe(200);

    const reuse = await request(app).post('/auth/reset').send({ token, password: 'another123' });
    expect(reuse.status).toBe(400); // token already consumed
  });

  it('rejects an expired token (400)', async () => {
    const token = 'expired-token-xyz';
    await pool.query('UPDATE users SET reset_token_hash = ?, reset_expires = ? WHERE email = ?',
      [hashToken(token), new Date(Date.now() - 1000), email]);
    const r = await request(app).post('/auth/reset').send({ token, password: 'whatever123' });
    expect(r.status).toBe(400);
  });
});
