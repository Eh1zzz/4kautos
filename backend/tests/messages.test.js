import request from 'supertest';
import app     from '../server.js';
import { pool, connectDB } from '../config/db.js';

let sellerToken, buyerToken, otherToken, buyerId, carId;
const validCar = {
  make: 'Toyota', model: 'Camry', year: 2020, mileage: 42000, price: 9500000,
  condition: 'good', vin: '1HGCM82633A004352', location: 'Atlanta, GA, USA',
  photos: ['a', 'b', 'c', 'd', 'e'],
};

beforeAll(async () => {
  await connectDB();
  const s = await request(app).post('/auth/signup').send({ name: 'Seller', email: 'mseller@test.com', password: 'password123', role: 'seller' });
  sellerToken = s.body.token;
  const b = await request(app).post('/auth/signup').send({ name: 'Buyer', email: 'mbuyer@test.com', password: 'password123', role: 'buyer' });
  buyerToken = b.body.token; buyerId = b.body.user.id;
  const o = await request(app).post('/auth/signup').send({ name: 'Other', email: 'mother@test.com', password: 'password123', role: 'buyer' });
  otherToken = o.body.token;
  const car = await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`).send(validCar);
  carId = car.body.car.id;
}, 30000); // DB setup + bcrypt can exceed the 5s default under load

afterAll(async () => {
  await pool.query('DELETE FROM messages');
  await pool.query('DELETE FROM cars');
  await pool.query('DELETE FROM users');
  await pool.end();
});

describe('Messages', () => {
  it('lets a buyer message the seller', async () => {
    const res = await request(app).post('/messages').set('Authorization', `Bearer ${buyerToken}`).send({ carId, body: 'Is it available?' });
    expect(res.status).toBe(201);
  });

  it('shows the seller a thread with an unread count', async () => {
    const res = await request(app).get('/messages/threads').set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(Number(res.body[0].unread)).toBe(1);
  });

  it('blocks a seller from messaging their own car (no buyer)', async () => {
    const res = await request(app).post('/messages').set('Authorization', `Bearer ${sellerToken}`).send({ carId, body: 'hi' });
    expect(res.status).toBe(400);
  });

  it('does NOT leak another buyer\'s thread to an outsider', async () => {
    // "other" passes the real buyerId, but is neither buyer nor seller — they get
    // their own (empty) thread, never the buyer's messages.
    const res = await request(app).get(`/messages?carId=${carId}&buyerId=${buyerId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(0);
  });

  it('lets the seller read + reply in the thread', async () => {
    const read = await request(app).get(`/messages?carId=${carId}&buyerId=${buyerId}`).set('Authorization', `Bearer ${sellerToken}`);
    expect(read.status).toBe(200);
    expect(read.body.messages.length).toBe(1);
    const reply = await request(app).post('/messages').set('Authorization', `Bearer ${sellerToken}`).send({ carId, buyerId, body: 'Yes!' });
    expect(reply.status).toBe(201);
  });

  it('marks the thread read on open — unread clears for the seller', async () => {
    // The previous test opened the thread (GET /messages → markRead).
    const unread = await request(app).get('/messages/unread').set('Authorization', `Bearer ${sellerToken}`);
    expect(Number(unread.body.count)).toBe(0);
    const threads = await request(app).get('/messages/threads').set('Authorization', `Bearer ${sellerToken}`);
    const thread = threads.body.find(t => Number(t.car_id) === Number(carId));
    expect(Number(thread.unread)).toBe(0);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/messages/threads');
    expect(res.status).toBe(401);
  });
});
