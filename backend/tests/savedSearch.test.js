import request from 'supertest';
import app     from '../server.js';
import { pool, connectDB } from '../config/db.js';

let token, otherToken, id;

beforeAll(async () => {
  await connectDB();
  const a = await request(app).post('/auth/signup').send({ name: 'SS User', email: 'ssuser@test.com', password: 'password123', role: 'buyer' });
  token = a.body.token;
  const b = await request(app).post('/auth/signup').send({ name: 'SS Other', email: 'ssother@test.com', password: 'password123', role: 'buyer' });
  otherToken = b.body.token;
}, 30000);

afterAll(async () => {
  await pool.query('DELETE FROM saved_searches');
  await pool.query('DELETE FROM users');
  await pool.end();
});

describe('Saved searches', () => {
  it('requires auth to list', async () => {
    const r = await request(app).get('/saved-searches');
    expect(r.status).toBe(401);
  });

  it('saves a search and keeps the filters object', async () => {
    const r = await request(app).post('/saved-searches').set('Authorization', `Bearer ${token}`)
      .send({ label: 'Toyota SUVs', filters: { make: 'Toyota', type: 'SUV' } });
    expect(r.status).toBe(201);
    id = r.body.savedSearch.id;
    expect(r.body.savedSearch.filters.make).toBe('Toyota');
    expect(r.body.savedSearch.filters.type).toBe('SUV');
  });

  it('rejects an empty label', async () => {
    const r = await request(app).post('/saved-searches').set('Authorization', `Bearer ${token}`)
      .send({ filters: { make: 'Honda' } });
    expect(r.status).toBe(400);
  });

  it('lists only the requester’s own searches', async () => {
    const mine = await request(app).get('/saved-searches').set('Authorization', `Bearer ${token}`);
    expect(mine.body.length).toBe(1);
    const theirs = await request(app).get('/saved-searches').set('Authorization', `Bearer ${otherToken}`);
    expect(theirs.body.length).toBe(0);
  });

  it('blocks deleting someone else’s search (404)', async () => {
    const r = await request(app).delete(`/saved-searches/${id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(r.status).toBe(404);
  });

  it('deletes your own search', async () => {
    const r = await request(app).delete(`/saved-searches/${id}`).set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    const after = await request(app).get('/saved-searches').set('Authorization', `Bearer ${token}`);
    expect(after.body.length).toBe(0);
  });
});
