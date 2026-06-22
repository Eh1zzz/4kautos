import request from 'supertest';
import bcrypt  from 'bcrypt';
import app     from '../server.js';
import { pool, connectDB } from '../config/db.js';

let adminToken, adminId, buyerToken, buyerId;

beforeAll(async () => {
  await connectDB();
  // admin can't be created via signup, so insert one directly.
  const hash = await bcrypt.hash('admin1234', 12);
  await pool.query('INSERT INTO users (name, email, password, role, verified) VALUES (?,?,?,?,?)',
    ['Admin', 'adm@test.com', hash, 'admin', true]);
  const a = await request(app).post('/auth/login').send({ email: 'adm@test.com', password: 'admin1234' });
  adminToken = a.body.token; adminId = a.body.user.id;
  const b = await request(app).post('/auth/signup').send({ name: 'Victim', email: 'victim@test.com', password: 'password123', role: 'buyer' });
  buyerToken = b.body.token; buyerId = b.body.user.id;
}, 30000); // DB setup + bcrypt can exceed the 5s default under load

afterAll(async () => {
  await pool.query('DELETE FROM users');
  await pool.end();
});

describe('Admin authorization', () => {
  it('blocks non-admins from admin routes (403)', async () => {
    const res = await request(app).get('/admin/users').set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(403);
  });

  it('blocks unauthenticated access (401)', async () => {
    const res = await request(app).get('/admin/users');
    expect(res.status).toBe(401);
  });

  it('lets an admin list users', async () => {
    const res = await request(app).get('/admin/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // never leaks password hashes
    expect(res.body.every(u => u.password === undefined)).toBe(true);
  });

  it('lets an admin verify a user', async () => {
    const res = await request(app).patch(`/admin/users/${buyerId}/verify`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.verified).toBeTruthy();
  });

  it('refuses to let an admin delete their own account (400)', async () => {
    const res = await request(app).delete(`/admin/users/${adminId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('lets an admin delete another user (200)', async () => {
    const res = await request(app).delete(`/admin/users/${buyerId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const after = await request(app).get('/admin/users').set('Authorization', `Bearer ${adminToken}`);
    expect(after.body.find(u => u.id === buyerId)).toBeUndefined();
  });
});

describe('Hot Sales (featured)', () => {
  let sellerTok, carId;
  beforeAll(async () => {
    const s = await request(app).post('/auth/signup').send({ name: 'HS Seller', email: 'hsseller@test.com', password: 'password123', role: 'seller' });
    sellerTok = s.body.token;
    const car = await request(app).post('/cars').set('Authorization', `Bearer ${sellerTok}`).send({
      make: 'Toyota', model: 'Corolla', year: 2021, mileage: 20000, price: 8000000, condition: 'good',
      vin: '2T1BURHE0JC000001', location: 'Lagos, Nigeria', photos: ['a', 'b', 'c', 'd', 'e'],
    });
    carId = car.body.car.id;
  });

  it('blocks non-admins from featuring (403)', async () => {
    const r = await request(app).patch(`/admin/cars/${carId}/feature`).set('Authorization', `Bearer ${sellerTok}`).send({ featured: true });
    expect(r.status).toBe(403);
  });

  it('lets an admin feature a car, and it shows under ?featured=1', async () => {
    const r = await request(app).patch(`/admin/cars/${carId}/feature`).set('Authorization', `Bearer ${adminToken}`).send({ featured: true });
    expect(r.status).toBe(200);
    const feat = await request(app).get('/cars?featured=1');
    expect(feat.body.some(c => c.id === carId)).toBe(true);
  });

  it('unfeatures a car', async () => {
    const r = await request(app).patch(`/admin/cars/${carId}/feature`).set('Authorization', `Bearer ${adminToken}`).send({ featured: false });
    expect(r.status).toBe(200);
    const feat = await request(app).get('/cars?featured=1');
    expect(feat.body.some(c => c.id === carId)).toBe(false);
  });
});

describe('Admin image backfill', () => {
  it('blocks non-admins (403)', async () => {
    const r = await request(app).post('/admin/backfill-images').set('Authorization', `Bearer ${buyerToken}`);
    expect(r.status).toBe(403);
  });

  it('lets an admin run a dry-run and returns a summary (writes nothing)', async () => {
    const r = await request(app).post('/admin/backfill-images').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.mode).toBe('dry-run');
    expect(typeof r.body.scanned).toBe('number');
    expect(r.body).toHaveProperty('converted');
    expect(r.body).toHaveProperty('skipped');
  });
});

describe('Admin operations stats', () => {
  it('blocks non-admins (403)', async () => {
    const r = await request(app).get('/admin/stats').set('Authorization', `Bearer ${buyerToken}`);
    expect(r.status).toBe(403);
  });

  it('returns telemetry for an admin', async () => {
    const r = await request(app).get('/admin/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(typeof r.body.transactions.total).toBe('number');
    expect(r.body.escrow).toHaveProperty('inEscrowUsd');
    expect(r.body.funnel).toHaveProperty('completed');
    expect(r.body.counts).toHaveProperty('listings');
  });
});

describe('Admin risk flags', () => {
  it('blocks non-admins (403)', async () => {
    const r = await request(app).get('/admin/flags').set('Authorization', `Bearer ${buyerToken}`);
    expect(r.status).toBe(403);
  });

  it('returns the flag buckets for an admin', async () => {
    const r = await request(app).get('/admin/flags').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.underpriced)).toBe(true);
    expect(Array.isArray(r.body.duplicateVins)).toBe(true);
    expect(Array.isArray(r.body.unverifiedSellers)).toBe(true);
    expect(Array.isArray(r.body.stalledBuyers)).toBe(true);
    expect(typeof r.body.total).toBe('number');
  });
});

describe('Admin activity feed', () => {
  it('blocks non-admins (403)', async () => {
    const r = await request(app).get('/admin/activity').set('Authorization', `Bearer ${buyerToken}`);
    expect(r.status).toBe(403);
  });

  it('returns a merged activity list for an admin', async () => {
    const r = await request(app).get('/admin/activity').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.items)).toBe(true);
  });
});
