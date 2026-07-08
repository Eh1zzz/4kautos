import request from 'supertest';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';
import { carMatchesFilters, notifySavedSearchMatches } from '../utils/searchAlerts.js';

/* Saved-search alert matcher: pure predicate + the create-listing integration.
   (Emails no-op without a driver; we assert on the match count, not delivery.) */

describe('carMatchesFilters (pure)', () => {
  const car = {
    make: 'Toyota', model: 'Camry', body_type: 'Sedan', year: 2020,
    price: 9000000, currency: 'NGN', mileage: 42000, condition: 'good',
    title: '2020 Toyota Camry XSE', description: 'Clean, one owner',
  };

  it('matches make/model/type substrings and exact year', () => {
    expect(carMatchesFilters(car, { make: 'toy', model: 'cam' })).toBe(true);
    expect(carMatchesFilters(car, { type: 'Sedan' })).toBe(true);
    expect(carMatchesFilters(car, { year: 2020 })).toBe(true);
    expect(carMatchesFilters(car, { make: 'Honda' })).toBe(false);
    expect(carMatchesFilters(car, { type: 'SUV' })).toBe(false);
    expect(carMatchesFilters(car, { year: 2019 })).toBe(false);
  });

  it('honours condition lists and native price/mileage bounds', () => {
    expect(carMatchesFilters(car, { condition: 'excellent,good' })).toBe(true);
    expect(carMatchesFilters(car, { condition: 'excellent,fair' })).toBe(false);
    expect(carMatchesFilters(car, { minPrice: 8000000, maxPrice: 10000000 })).toBe(true);
    expect(carMatchesFilters(car, { maxPrice: 5000000 })).toBe(false);
    expect(carMatchesFilters(car, { maxMileage: 50000 })).toBe(true);
    expect(carMatchesFilters(car, { minMileage: 50000 })).toBe(false);
  });

  it('applies USD budget bounds using the rate', () => {
    // 9,000,000 NGN ÷ 1500 = $6,000
    expect(carMatchesFilters(car, { maxUsd: 7000 }, 1500)).toBe(true);
    expect(carMatchesFilters(car, { maxUsd: 5000 }, 1500)).toBe(false);
    expect(carMatchesFilters(car, { minUsd: 5000 }, 1500)).toBe(true);
  });

  it('matches the free-text query across title/make/model/description', () => {
    expect(carMatchesFilters(car, { q: 'xse' })).toBe(true);
    expect(carMatchesFilters(car, { q: 'one owner' })).toBe(true);
    expect(carMatchesFilters(car, { q: 'diesel' })).toBe(false);
  });

  it('an empty filter set matches everything (a "saved everything" search)', () => {
    expect(carMatchesFilters(car, {})).toBe(true);
  });
});

describe('notifySavedSearchMatches (integration)', () => {
  let sellerToken, buyerAToken, buyerBToken;

  beforeAll(async () => {
    await connectDB();
    sellerToken = (await request(app).post('/auth/signup')
      .send({ name: 'Alert Seller', email: 'alert-seller@test.com', password: 'password123', role: 'seller' })).body.token;
    buyerAToken = (await request(app).post('/auth/signup')
      .send({ name: 'Alert Buyer A', email: 'alert-buyerA@test.com', password: 'password123', role: 'buyer' })).body.token;
    buyerBToken = (await request(app).post('/auth/signup')
      .send({ name: 'Alert Buyer B', email: 'alert-buyerB@test.com', password: 'password123', role: 'buyer' })).body.token;

    // Buyer A wants a Toyota SUV; Buyer B wants a Honda. Only A should match.
    await request(app).post('/saved-searches').set('Authorization', `Bearer ${buyerAToken}`)
      .send({ label: 'Toyota SUVs', filters: { make: 'Toyota', type: 'SUV' } });
    await request(app).post('/saved-searches').set('Authorization', `Bearer ${buyerBToken}`)
      .send({ label: 'Hondas', filters: { make: 'Honda' } });
  });

  afterAll(async () => {
    await pool.query('DELETE FROM saved_searches');
    await pool.query('DELETE FROM cars');
    await pool.query("DELETE FROM users WHERE email LIKE 'alert-%@test.com'");
    await pool.end();
  });

  it('matches exactly the buyers whose saved search fits the new car', async () => {
    const r = await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`).send({
      title: '2021 Toyota RAV4', make: 'Toyota', model: 'RAV4', year: 2021,
      mileage: 30000, price: 12000000, condition: 'excellent', bodyType: 'SUV',
      vin: '1HGCM82633A004488', location: 'Lagos, Nigeria',
      photos: ['https://x.example/1.jpg', 'https://x.example/2.jpg', 'https://x.example/3.jpg',
               'https://x.example/4.jpg', 'https://x.example/5.jpg'],
    });
    expect(r.status).toBe(201);
    const res = await notifySavedSearchMatches(r.body.car);
    expect(res.matched).toBe(1);   // Buyer A only; Buyer B (Honda) excluded
  });

  it('never alerts the seller about their own listing', async () => {
    // Give the seller a saved search that would match their own car.
    await request(app).post('/saved-searches').set('Authorization', `Bearer ${sellerToken}`)
      .send({ label: 'Any Toyota', filters: { make: 'Toyota' } });
    const [[car]] = await pool.query("SELECT * FROM cars WHERE vin = '1HGCM82633A004488'");
    const res = await notifySavedSearchMatches(car);
    expect(res.matched).toBe(1);   // still just Buyer A — seller filtered out
  });
});
