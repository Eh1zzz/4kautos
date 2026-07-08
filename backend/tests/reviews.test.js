import request from 'supertest';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';

/* Post-purchase reviews: buyer-only, completed-only, one per transaction,
   rating bounds, and the public aggregates/lists on the seller profile. */

let sellerToken, buyerToken, sellerId, txDone, txOpen;

const validCar = (over = {}) => ({
  title: '2019 Toyota RAV4', make: 'Toyota', model: 'RAV4', year: 2019,
  mileage: 50000, price: 9000000, condition: 'good',
  vin: '1HGCM82633A004433', location: 'Ibadan, Nigeria',
  photos: ['https://x.example/1.jpg', 'https://x.example/2.jpg', 'https://x.example/3.jpg',
           'https://x.example/4.jpg', 'https://x.example/5.jpg'],
  ...over,
});

beforeAll(async () => {
  await connectDB();
  const s = await request(app).post('/auth/signup')
    .send({ name: 'Rev Seller', email: 'rev-seller@test.com', password: 'password123', role: 'seller' });
  sellerToken = s.body.token; sellerId = s.body.user.id;
  const b = await request(app).post('/auth/signup')
    .send({ name: 'Rev Buyer', email: 'rev-buyer@test.com', password: 'password123', role: 'buyer' });
  buyerToken = b.body.token;

  const car1 = (await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`).send(validCar())).body.car;
  const car2 = (await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`)
    .send(validCar({ vin: '1HGCM82633A004434', title: '2017 Toyota Corolla', model: 'Corolla' }))).body.car;

  txDone = (await request(app).post('/transactions').set('Authorization', `Bearer ${buyerToken}`)
    .send({ carId: car1.id })).body.transaction.id;
  txOpen = (await request(app).post('/transactions').set('Authorization', `Bearer ${buyerToken}`)
    .send({ carId: car2.id })).body.transaction.id;
  // Completed state is only reachable through the payment flow — set directly
  // for the test (the route trusts the DB status, which is the point).
  await pool.query("UPDATE transactions SET status = 'completed' WHERE id = ?", [txDone]);
});

afterAll(async () => {
  await pool.query('DELETE FROM reviews');
  await pool.query('DELETE FROM transactions');
  await pool.query('DELETE FROM cars');
  await pool.query("DELETE FROM users WHERE email IN ('rev-seller@test.com','rev-buyer@test.com')");
  await pool.end();
});

describe('POST /reviews', () => {
  const H = () => ({ Authorization: `Bearer ${buyerToken}` });

  it('rejects anonymous (401), the seller (403), bad ratings (400), open transactions (409)', async () => {
    expect((await request(app).post('/reviews').send({ transactionId: txDone, rating: 5 })).status).toBe(401);
    expect((await request(app).post('/reviews').set('Authorization', `Bearer ${sellerToken}`)
      .send({ transactionId: txDone, rating: 5 })).status).toBe(403);
    expect((await request(app).post('/reviews').set(H()).send({ transactionId: txDone, rating: 6 })).status).toBe(400);
    expect((await request(app).post('/reviews').set(H()).send({ transactionId: txDone, rating: 0 })).status).toBe(400);
    expect((await request(app).post('/reviews').set(H()).send({ transactionId: txOpen, rating: 5 })).status).toBe(409);
  });

  it('accepts the buyer of a completed transaction, exactly once', async () => {
    const r = await request(app).post('/reviews').set(H())
      .send({ transactionId: txDone, rating: 5, comment: 'Smooth deal, car exactly as described.' });
    expect(r.status).toBe(201);
    expect(r.body.review.rating).toBe(5);
    const dup = await request(app).post('/reviews').set(H()).send({ transactionId: txDone, rating: 1 });
    expect(dup.status).toBe(409);
  });

  it('surfaces on the seller profile: aggregate + public list, review_id on the transaction', async () => {
    const prof = await request(app).get(`/sellers/${sellerId}`);
    expect(prof.body.rating).toEqual({ avg: 5, count: 1 });

    const list = await request(app).get(`/sellers/${sellerId}/reviews`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].buyer_name).toBe('Rev Buyer');
    expect(list.body[0].comment).toMatch(/Smooth deal/);
    expect(list.body[0].car_title).toBe('2019 Toyota RAV4');
    expect(JSON.stringify(list.body)).not.toMatch(/email/);

    const mine = await request(app).get('/transactions').set(H());
    const done = mine.body.find(t => t.id === txDone);
    expect(done.review_id).toBeTruthy();   // dashboard hides the Rate button
  });
});
