import request from 'supertest';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';

// Locks the cross-role / cross-user authorization boundaries so a future refactor
// can't silently open an IDOR or privilege hole.
let buyerA, buyerB;

beforeAll(async () => {
  await connectDB();
  const a = await request(app).post('/auth/signup').send({ name: 'IDOR A', email: 'idora@test.com', password: 'password123', role: 'buyer' });
  buyerA = a.body.token;
  const b = await request(app).post('/auth/signup').send({ name: 'IDOR B', email: 'idorb@test.com', password: 'password123', role: 'buyer' });
  buyerB = b.body.token;
}, 30000);

afterAll(async () => {
  await pool.query('DELETE FROM saved_searches');
  await pool.query('DELETE FROM users');
  await pool.end();
});

describe('IDOR / cross-role authorization', () => {
  it('a buyer cannot read seller-only payout details (403)', async () => {
    const r = await request(app).get('/payments/payout').set('Authorization', `Bearer ${buyerA}`);
    expect(r.status).toBe(403);
  });

  it('a buyer cannot read the admin pending-payouts ledger (403)', async () => {
    const r = await request(app).get('/payments/pending-payouts').set('Authorization', `Bearer ${buyerA}`);
    expect(r.status).toBe(403);
  });

  it("a user cannot delete another user's saved search", async () => {
    const created = await request(app).post('/saved-searches').set('Authorization', `Bearer ${buyerA}`).send({ label: 'mine', filters: { make: 'Toyota' } });
    const id = created.body.savedSearch.id;
    const del = await request(app).delete(`/saved-searches/${id}`).set('Authorization', `Bearer ${buyerB}`);
    expect([403, 404]).toContain(del.status);
    const list = await request(app).get('/saved-searches').set('Authorization', `Bearer ${buyerA}`);
    expect(list.body.some(s => s.id === id)).toBe(true); // A still owns it
  });

  it('unauthenticated requests to protected routes are rejected (401)', async () => {
    expect((await request(app).get('/payments/payout')).status).toBe(401);
    expect((await request(app).get('/saved-searches')).status).toBe(401);
    expect((await request(app).get('/transactions')).status).toBe(401);
  });
});
