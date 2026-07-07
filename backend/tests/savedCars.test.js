import request from 'supertest';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';

/* Server-synced saved cars: auth required, idempotent save/unsave,
   ids + full=1 shapes, 404 for a car that doesn't exist. */

let buyerToken, sellerToken, carId;

const validCar = () => ({
  title: '2018 Honda CR-V', make: 'Honda', model: 'CR-V', year: 2018,
  mileage: 62000, price: 6200000, condition: 'good',
  vin: '1HGCM82633A004422', location: 'Abuja, Nigeria',
  photos: ['https://x.example/1.jpg', 'https://x.example/2.jpg', 'https://x.example/3.jpg',
           'https://x.example/4.jpg', 'https://x.example/5.jpg'],
});

beforeAll(async () => {
  await connectDB();
  const s = await request(app).post('/auth/signup')
    .send({ name: 'SC Seller', email: 'sc-seller@test.com', password: 'password123', role: 'seller' });
  sellerToken = s.body.token;
  const b = await request(app).post('/auth/signup')
    .send({ name: 'SC Buyer', email: 'sc-buyer@test.com', password: 'password123', role: 'buyer' });
  buyerToken = b.body.token;
  const r = await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`).send(validCar());
  carId = r.body.car.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM saved_cars');
  await pool.query('DELETE FROM cars');
  await pool.query("DELETE FROM users WHERE email IN ('sc-seller@test.com','sc-buyer@test.com')");
  await pool.end();
});

describe('/saved-cars', () => {
  it('requires auth', async () => {
    expect((await request(app).get('/saved-cars')).status).toBe(401);
    expect((await request(app).put(`/saved-cars/${carId}`)).status).toBe(401);
  });

  it('save → list → full → unsave round-trip (idempotent both ways)', async () => {
    const H = { Authorization: `Bearer ${buyerToken}` };
    expect((await request(app).put(`/saved-cars/${carId}`).set(H)).status).toBe(200);
    expect((await request(app).put(`/saved-cars/${carId}`).set(H)).status).toBe(200); // repeat = fine

    const list = await request(app).get('/saved-cars').set(H);
    expect(list.body.ids).toEqual([String(carId)]);

    const full = await request(app).get('/saved-cars?full=1').set(H);
    expect(full.body).toHaveLength(1);
    expect(full.body[0].make).toBe('Honda');
    expect(full.body[0].seller?.name).toBe('SC Seller');
    expect(full.body[0].seller?.email).toBeUndefined();   // public projection only

    expect((await request(app).delete(`/saved-cars/${carId}`).set(H)).status).toBe(200);
    expect((await request(app).delete(`/saved-cars/${carId}`).set(H)).status).toBe(200); // repeat = fine
    expect((await request(app).get('/saved-cars').set(H)).body.ids).toEqual([]);
  });

  it('404s when saving a car that does not exist', async () => {
    const r = await request(app).put('/saved-cars/999999')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(r.status).toBe(404);
  });
});
