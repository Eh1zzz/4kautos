import request from 'supertest';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';
import { governmentCharges } from '../utils/customs.js';

let sellerToken;

const validCar = (over = {}) => ({
  title: '2020 Toyota Camry XSE',
  make: 'Toyota', model: 'Camry', year: 2020,
  mileage: 42000, price: 9500000, condition: 'good',
  vin: '1HGCM82633A004352',
  location: 'Atlanta, GA, USA', latitude: 33.749, longitude: -84.388,
  photos: [
    'https://example.com/front.jpg',
    'https://example.com/rear.jpg',
    'https://example.com/interior.jpg',
    'https://example.com/odometer.jpg',
    'https://example.com/engine.jpg',
  ],
  ...over,
});

const createCar = async (over) => {
  const r = await request(app).post('/cars')
    .set('Authorization', `Bearer ${sellerToken}`).send(validCar(over));
  expect(r.status).toBe(201);
  return r.body.car;
};

beforeAll(async () => {
  await connectDB();
  const s = await request(app).post('/auth/signup')
    .send({ name: 'Customs Seller', email: 'customs-seller@test.com', password: 'password123', role: 'seller' });
  sellerToken = s.body.token;
});

afterAll(async () => {
  await pool.query('DELETE FROM cars');
  await pool.query("DELETE FROM users WHERE email = 'customs-seller@test.com'");
  await pool.end();
});

describe('customs engine (unit)', () => {
  it('line items sum to the total and effectivePct matches', () => {
    const g = governmentCharges(10000);
    const sum = g.lineItems.reduce((a, li) => a + li.amountUsd, 0);
    expect(Math.abs(sum - g.total)).toBeLessThan(0.05);          // rounding only
    expect(g.effectivePct).toBeCloseTo((g.total / 10000) * 100, 1);
    expect(g.importDuty).toBeCloseTo(2000, 2);                    // 20% of CIF
    expect(g.vat).toBeCloseTo((10000 + 2000 + 1500 + 50 + 100 + 140) * 0.075, 2);
  });
});

describe('GET /cars/:id/customs', () => {
  it('returns the full per-listing breakdown with rates + effective percentage', async () => {
    const car = await createCar();
    const r = await request(app).get(`/cars/${car.id}/customs`);
    expect(r.status).toBe(200);
    expect(r.body.available).toBe(true);
    expect(r.body.inCountry).toBe(false);
    expect(r.body.destination.country).toBe('Nigeria');
    expect(r.body.charges.estimate).toBe(false);
    // 6 Nigerian line items, each carrying its rate percentage
    expect(r.body.charges.lineItems).toHaveLength(6);
    for (const li of r.body.charges.lineItems) {
      expect(li.ratePct).toBeGreaterThan(0);
      expect(li.amountUsd).toBeGreaterThan(0);
      expect(li.amountNgn).toBeGreaterThan(li.amountUsd); // NGN rate > 1
    }
    // Effective percentage ≈ 48% under the current rate structure
    expect(r.body.charges.effectivePct).toBeGreaterThan(45);
    expect(r.body.charges.effectivePct).toBeLessThan(52);
    // Totals consistent with the car's own price converted at the reported FX rate
    expect(r.body.input.cifValueUsd).toBeCloseTo(9500000 / r.body.fx.usdToNgn, 0);
    expect(r.body.disclaimer).toMatch(/Nigeria Customs Service/);
  });

  it('marks an in-country car as duty-free', async () => {
    const car = await createCar({ location: 'Lagos, Nigeria', vin: '1HGCM82633A004353' });
    const r = await request(app).get(`/cars/${car.id}/customs`);
    expect(r.status).toBe(200);
    expect(r.body.inCountry).toBe(true);
    expect(r.body.charges.totalUsd).toBe(0);
    expect(r.body.charges.effectivePct).toBe(0);
  });

  it('supports a non-Nigeria destination as a labeled single-rate estimate', async () => {
    const car = await createCar({ vin: '1HGCM82633A004354' });
    const r = await request(app).get(`/cars/${car.id}/customs?destination=Accra, Ghana`);
    expect(r.status).toBe(200);
    expect(r.body.destination.country).toBe('Ghana');
    expect(r.body.charges.estimate).toBe(true);
    expect(r.body.charges.effectivePct).toBe(35);
    expect(r.body.charges.lineItems).toHaveLength(1);
  });

  it('flags vehicles older than 12 years in the notes', async () => {
    const car = await createCar({ year: 2008, vin: '1HGCM82633A004355', title: '2008 Toyota Camry' });
    const r = await request(app).get(`/cars/${car.id}/customs`);
    expect(r.status).toBe(200);
    expect(r.body.notes.join(' ')).toMatch(/age levies|import restrictions/);
  });

  it('404s for an unknown car', async () => {
    const r = await request(app).get('/cars/999999/customs');
    expect(r.status).toBe(404);
  });
});
