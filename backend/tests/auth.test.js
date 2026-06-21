import request from 'supertest';
import app     from '../server.js';
import { pool, connectDB } from '../config/db.js';

beforeAll(async () => { await connectDB(); });
afterEach(async () => {
  // Delete in FK-safe order (children before parents)
  await pool.query('DELETE FROM transactions');
  await pool.query('DELETE FROM cars');
  await pool.query('DELETE FROM users');
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

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/auth/signup')
      .send({ name:'Bad', email:'not-an-email', password:'password123' });
    expect(res.status).toBe(400);
  });

  it('never grants admin via the signup body (privilege escalation)', async () => {
    const res = await request(app).post('/auth/signup')
      .send({ name:'Sneaky', email:'sneaky@x.com', password:'password123', role:'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('buyer');
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

describe('GET/PATCH /auth/me', () => {
  it('requires authentication (401)', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('saves and returns the buyer location', async () => {
    const s = await request(app).post('/auth/signup')
      .send({ name:'Loc User', email:'loc@test.com', password:'password123', role:'buyer' });
    const tok = s.body.token;
    const upd = await request(app).patch('/auth/me').set('Authorization', `Bearer ${tok}`).send({ location:'Accra, Ghana' });
    expect(upd.status).toBe(200);
    expect(upd.body.user.location).toBe('Accra, Ghana');
    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${tok}`);
    expect(me.status).toBe(200);
    expect(me.body.user.location).toBe('Accra, Ghana');
    expect(me.body.user.password).toBeUndefined();   // never leaks the hash
  });
});
