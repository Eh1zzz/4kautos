import request from 'supertest';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';

/* Public seller profile: safe projection only (no email/payout data),
   404 for non-sellers and unknown ids, live counts. */

let sellerToken, sellerId, buyerId;

const validCar = (over = {}) => ({
  title: '2020 Kia Sportage', make: 'Kia', model: 'Sportage', year: 2020,
  mileage: 41000, price: 7500000, condition: 'good',
  vin: '1HGCM82633A004411', location: 'Lagos, Nigeria',
  photos: ['https://x.example/1.jpg', 'https://x.example/2.jpg', 'https://x.example/3.jpg',
           'https://x.example/4.jpg', 'https://x.example/5.jpg'],
  ...over,
});

beforeAll(async () => {
  await connectDB();
  const s = await request(app).post('/auth/signup')
    .send({ name: 'Profile Seller', email: 'profile-seller@test.com', password: 'password123', role: 'seller' });
  sellerToken = s.body.token; sellerId = s.body.user.id;
  const b = await request(app).post('/auth/signup')
    .send({ name: 'Profile Buyer', email: 'profile-buyer@test.com', password: 'password123', role: 'buyer' });
  buyerId = b.body.user.id;
  await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`).send(validCar());
});

afterAll(async () => {
  await pool.query('DELETE FROM cars');
  await pool.query("DELETE FROM users WHERE email IN ('profile-seller@test.com','profile-buyer@test.com')");
  await pool.end();
});

describe('GET /sellers/:id', () => {
  it('returns the public profile with counts and no PII', async () => {
    const r = await request(app).get(`/sellers/${sellerId}`);
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('Profile Seller');
    expect(r.body.verified).toBe(false);
    expect(r.body.listings).toBe(1);
    expect(r.body.completedSales).toBe(0);
    expect(r.body.memberSince).toBeTruthy();
    expect(r.body.email).toBeUndefined();          // never leak PII
    expect(JSON.stringify(r.body)).not.toMatch(/password|account_number|payout/);
  });

  it('404s for a buyer id (profiles are sellers only)', async () => {
    const r = await request(app).get(`/sellers/${buyerId}`);
    expect(r.status).toBe(404);
  });

  it('404s for unknown and invalid ids', async () => {
    expect((await request(app).get('/sellers/999999')).status).toBe(404);
    expect((await request(app).get('/sellers/abc')).status).toBe(404);
  });
});
