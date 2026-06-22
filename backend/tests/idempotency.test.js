import request from 'supertest';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';

// POST /transactions is wrapped with the idempotency middleware and works without
// a payment gateway, so it exercises the replay-safety guarantee end-to-end.
let buyerToken, carId;

beforeAll(async () => {
  await connectDB();
  const s = await request(app).post('/auth/signup').send({ name: 'Idem Seller', email: 'idemseller@test.com', password: 'password123', role: 'seller' });
  const sToken = s.body.token;
  const b = await request(app).post('/auth/signup').send({ name: 'Idem Buyer', email: 'idembuyer@test.com', password: 'password123', role: 'buyer' });
  buyerToken = b.body.token;
  const car = await request(app).post('/cars').set('Authorization', `Bearer ${sToken}`).send({
    make: 'Toyota', model: 'Corolla', year: 2021, mileage: 20000, price: 8000000, condition: 'good',
    vin: '2T1BURHE0JC900001', location: 'Lagos, Nigeria',
    photos: ['https://x/a', 'https://x/b', 'https://x/c', 'https://x/d', 'https://x/e'],
  });
  carId = car.body.car.id;
}, 30000);

afterAll(async () => {
  await pool.query('DELETE FROM idempotency_keys');
  await pool.query('DELETE FROM transactions');
  await pool.query('DELETE FROM cars');
  await pool.query('DELETE FROM users');
  await pool.end();
});

describe('Idempotency keys', () => {
  it('replays the stored response for a repeated key (no double-create)', async () => {
    const key = 'test-idem-' + Date.now();
    const r1 = await request(app).post('/transactions').set('Authorization', `Bearer ${buyerToken}`).set('Idempotency-Key', key).send({ carId });
    expect(r1.status).toBe(201);
    const id1 = r1.body.transaction.id;

    const r2 = await request(app).post('/transactions').set('Authorization', `Bearer ${buyerToken}`).set('Idempotency-Key', key).send({ carId });
    expect(r2.status).toBe(201);                  // replayed, not a fresh execution
    expect(r2.body.transaction.id).toBe(id1);     // same transaction — nothing new created
  });

  it('without a key, a genuine duplicate is still caught by the business rule (409)', async () => {
    const r = await request(app).post('/transactions').set('Authorization', `Bearer ${buyerToken}`).send({ carId });
    expect(r.status).toBe(409);
  });
});
