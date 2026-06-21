import request from 'supertest';
import app     from '../server.js';
import { pool, connectDB } from '../config/db.js';

let sellerToken, buyerToken, otherToken, carId, txId;

const validCar = {
  make: 'Toyota', model: 'Camry', year: 2020, mileage: 42000, price: 9500000,
  condition: 'good', vin: '1HGCM82633A004352', location: 'Atlanta, GA, USA',
  photos: ['a', 'b', 'c', 'd', 'e'],
};

beforeAll(async () => {
  await connectDB();
  const s = await request(app).post('/auth/signup').send({ name: 'Seller', email: 'txseller@test.com', password: 'password123', role: 'seller' });
  sellerToken = s.body.token;
  const b = await request(app).post('/auth/signup').send({ name: 'Buyer', email: 'txbuyer@test.com', password: 'password123', role: 'buyer' });
  buyerToken = b.body.token;
  const o = await request(app).post('/auth/signup').send({ name: 'Other', email: 'txother@test.com', password: 'password123', role: 'buyer' });
  otherToken = o.body.token;
  const car = await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`).send(validCar);
  carId = car.body.car.id;
}, 30000); // DB setup + bcrypt can exceed the 5s default under load

afterAll(async () => {
  await pool.query('DELETE FROM transactions');
  await pool.query('DELETE FROM cars');
  await pool.query('DELETE FROM users');
  await pool.end();
});

describe('POST /transactions', () => {
  it('lets a buyer initiate (seller derived from the car)', async () => {
    const res = await request(app).post('/transactions').set('Authorization', `Bearer ${buyerToken}`).send({ carId });
    expect(res.status).toBe(201);
    txId = res.body.transaction.id;
  });
  it('blocks a duplicate active transaction (409)', async () => {
    const res = await request(app).post('/transactions').set('Authorization', `Bearer ${buyerToken}`).send({ carId });
    expect(res.status).toBe(409);
  });
  it('blocks a seller from initiating (403)', async () => {
    const res = await request(app).post('/transactions').set('Authorization', `Bearer ${sellerToken}`).send({ carId });
    expect(res.status).toBe(403);
  });
});

describe('GET /transactions/:id authorization (IDOR / PII)', () => {
  it('lets the buyer view it', async () => {
    const res = await request(app).get(`/transactions/${txId}`).set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
  });
  it('lets the seller view it', async () => {
    const res = await request(app).get(`/transactions/${txId}`).set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
  });
  it('blocks a non-participant (no PII leak by id)', async () => {
    const res = await request(app).get(`/transactions/${txId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /transactions/:id/status', () => {
  it('rejects an invalid status (400)', async () => {
    const res = await request(app).patch(`/transactions/${txId}/status`).set('Authorization', `Bearer ${buyerToken}`).send({ status: 'bogus' });
    expect(res.status).toBe(400);
  });
  it('blocks a non-participant (403)', async () => {
    const res = await request(app).patch(`/transactions/${txId}/status`).set('Authorization', `Bearer ${otherToken}`).send({ status: 'completed' });
    expect(res.status).toBe(403);
  });
  it('lets a participant update the status', async () => {
    const res = await request(app).patch(`/transactions/${txId}/status`).set('Authorization', `Bearer ${buyerToken}`).send({ status: 'pending_inspection' });
    expect(res.status).toBe(200);
  });
  it('forbids manually setting an escrow/money state (S4 payout-fraud guard)', async () => {
    for (const status of ['payment_in_escrow', 'completed']) {
      const res = await request(app).patch(`/transactions/${txId}/status`).set('Authorization', `Bearer ${buyerToken}`).send({ status });
      expect(res.status).toBe(400); // only the verified payment flow may reach these
    }
  });
});

describe('DELETE /transactions/:id (cancelled cleanup)', () => {
  let delTxId;
  beforeAll(async () => {
    // A second buyer opens a transaction on the same car, then cancels it.
    const r = await request(app).post('/transactions').set('Authorization', `Bearer ${otherToken}`).send({ carId });
    delTxId = r.body.transaction.id;
    await request(app).patch(`/transactions/${delTxId}/status`).set('Authorization', `Bearer ${otherToken}`).send({ status: 'cancelled' });
  });

  it('blocks a non-participant (403)', async () => {
    const res = await request(app).delete(`/transactions/${delTxId}`).set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(403);
  });

  it('refuses to delete a non-cancelled transaction (409)', async () => {
    const res = await request(app).delete(`/transactions/${txId}`).set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(409);
  });

  it('lets a participant delete a cancelled transaction, and it is gone', async () => {
    const res = await request(app).delete(`/transactions/${delTxId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(200);
    const after = await request(app).get(`/transactions/${delTxId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(after.status).toBe(404);
  });
});
