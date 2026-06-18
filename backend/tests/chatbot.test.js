import request from 'supertest';
import app     from '../server.js';
import { pool, connectDB } from '../config/db.js';

// These tests assert the offline ("local") AutoBot answers, which are
// deterministic. Force the key off for the suite (and restore it after) so a
// developer/CI that *does* have ANTHROPIC_API_KEY set won't make real API calls.
let sellerToken, prevKey;
let vinSeq = 50;
const nextVin = () => '1HGCM82633A0043' + (++vinSeq); // 17 chars, valid charset

const photos = [
  'https://example.com/front.jpg', 'https://example.com/rear.jpg',
  'https://example.com/interior.jpg', 'https://example.com/odometer.jpg',
  'https://example.com/engine.jpg',
];

const carPayload = (over = {}) => ({
  title: 'Toyota Camry', make: 'Toyota', model: 'Camry', year: 2020,
  mileage: 42000, price: 14500, currency: 'USD', condition: 'good',
  bodyType: 'Sedan', location: 'Atlanta, GA, USA', latitude: 33.749, longitude: -84.388,
  photos, ...over, vin: over.vin || nextVin(),
});

async function createCar(over = {}) {
  const res = await request(app).post('/cars')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send(carPayload(over));
  return res.body.car;
}

beforeAll(async () => {
  prevKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = ''; // deterministic offline answers
  await connectDB();
  const s = await request(app).post('/auth/signup')
    .send({ name: 'ChatSeller', email: 'chatbot.seller@test.com', password: 'password123', role: 'seller' });
  sellerToken = s.body.token;
}, 30000);

afterAll(async () => {
  process.env.ANTHROPIC_API_KEY = prevKey;
  await pool.query('DELETE FROM transactions');
  await pool.query('DELETE FROM cars');
  await pool.query('DELETE FROM users');
  await pool.end();
});

describe('POST /chat (AutoBot)', () => {
  it('rejects an empty message', async () => {
    const res = await request(app).post('/chat').send({ message: '   ' });
    expect(res.status).toBe(400);
  });

  it('answers generically with no carId', async () => {
    const res = await request(app).post('/chat').send({ message: 'Tell me about this car' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/buying, selling, escrow/i);
  });

  it('degrades gracefully for an unknown carId', async () => {
    const res = await request(app).post('/chat').send({ message: 'Tell me about this car', carId: 999999 });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/buying, selling, escrow/i);
  });

  it("returns the listing's real details for a carId", async () => {
    const car = await createCar();
    const res = await request(app).post('/chat').send({ message: 'Tell me about this car', carId: car.id });
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('Toyota');     // real make from the DB
    expect(res.body.reply).toMatch(/listing's details/i);
    expect(res.body.reply).toMatch(/escrow/i);
  });

  it('still answers process questions (escrow) on a listing page', async () => {
    const car = await createCar();
    const res = await request(app).post('/chat').send({ message: 'How does escrow work?', carId: car.id });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/escrow system protects/i);
  });

  it('compares the price to similar listings using real inventory', async () => {
    const subject = await createCar({ price: 9000, currency: 'USD' });          // cheapest
    await createCar({ price: 14500, currency: 'USD', location: 'London, UK' });
    await createCar({ price: 19500, currency: 'USD', location: 'Munich, Germany' });

    const res = await request(app).post('/chat')
      .send({ message: 'How does the price compare?', carId: subject.id });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/comparable listing/i);
    expect(res.body.reply).toMatch(/Comparable listings:/);
    // the other Camrys (by location) should be listed as comparables
    expect(res.body.reply).toMatch(/London|Munich/);
    // subject is the cheapest, so it should read as below the average
    expect(res.body.reply).toMatch(/below the average|cheaper than/i);
  });
});
