import request from 'supertest';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';

/* Server-side Open Graph injection: /detail.html?id=<car> must carry the
   car's title/price/photo in meta tags (WhatsApp/social crawlers don't run
   JS), while missing/unknown ids serve the plain page unchanged. */

let sellerToken, carId;

beforeAll(async () => {
  await connectDB();
  const s = await request(app).post('/auth/signup')
    .send({ name: 'OG Seller', email: 'og-seller@test.com', password: 'password123', role: 'seller' });
  sellerToken = s.body.token;
  const r = await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`).send({
    title: '2021 Audi Q5 Premium', make: 'Audi', model: 'Q5', year: 2021,
    mileage: 30000, price: 25000, currency: 'USD', condition: 'excellent',
    vin: '1HGCM82633A004399', location: 'Bremen, Germany',
    photos: ['https://cdn.example.com/q5-front.jpg', 'https://cdn.example.com/q5-rear.jpg',
             'https://cdn.example.com/q5-int.jpg', 'https://cdn.example.com/q5-odo.jpg',
             'https://cdn.example.com/q5-eng.jpg'],
  });
  carId = r.body.car.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM cars');
  await pool.query("DELETE FROM users WHERE email = 'og-seller@test.com'");
  await pool.end();
});

describe('GET /detail.html Open Graph injection', () => {
  it('injects title, price, image and url for a real listing', async () => {
    const r = await request(app).get(`/detail.html?id=${carId}`);
    expect(r.status).toBe(200);
    expect(r.text).toContain('og:title');
    expect(r.text).toContain('2021 Audi Q5 Premium · $25,000');
    expect(r.text).toContain('<meta property="og:image" content="https://cdn.example.com/q5-front.jpg">');
    expect(r.text).toContain(`/detail.html?id=${carId}`);
    expect(r.text).toContain('<title>2021 Audi Q5 Premium | 4Kautos</title>');
    expect(r.text).toContain('summary_large_image');
  });

  it('serves the plain page when no id is given', async () => {
    const r = await request(app).get('/detail.html');
    expect(r.status).toBe(200);
    expect(r.text).toContain('<title>Car Details | 4Kautos</title>');
    expect(r.text).not.toContain('og:site_name');
  });

  it('serves the plain page for an unknown id', async () => {
    const r = await request(app).get('/detail.html?id=999999');
    expect(r.status).toBe(200);
    expect(r.text).not.toContain('og:site_name');
  });
});
