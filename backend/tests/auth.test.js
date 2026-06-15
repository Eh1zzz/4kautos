import request from 'supertest';
import app     from '../server.js';
import { pool, connectDB } from '../config/db.js';

beforeAll(async () => { await connectDB(); });
afterEach(async () => {
  await pool.query('TRUNCATE transactions, cars, users RESTART IDENTITY CASCADE');
});
afterAll(async () => { await pool.end(); });

describe('POST /auth/signup', () => {
  it('creates a new user and returns token', async () => {
    const res = await request(app).post('/auth/signup')
      .send({ name:'Test User', email:'test@example.com', password:'password123', role:'buyer' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('rejects short passwords', async () => {
    const res = await request(app).post('/auth/signup')
      .send({ name:'Test', email:'t@t.com', password:'abc' });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate emails', async () => {
    await request(app).post('/auth/signup').send({ name:'A', email:'dup@x.com', password:'pass123' });
    const res = await request(app).post('/auth/signup').send({ name:'B', email:'dup@x.com', password:'pass123' });
    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/signup')
      .send({ name:'Login Test', email:'login@test.com', password:'mypassword' });
  });

  it('returns token with valid credentials', async () => {
    const res = await request(app).post('/auth/login')
      .send({ email:'login@test.com', password:'mypassword' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/auth/login')
      .send({ email:'login@test.com', password:'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('rejects unknown email', async () => {
    const res = await request(app).post('/auth/login')
      .send({ email:'nobody@test.com', password:'pass' });
    expect(res.status).toBe(401);
  });
});
