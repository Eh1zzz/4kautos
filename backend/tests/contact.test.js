import request from 'supertest';
import bcrypt  from 'bcrypt';
import app     from '../server.js';
import { pool, connectDB } from '../config/db.js';

let adminToken, userToken;

beforeAll(async () => {
  await connectDB();
  await pool.query('DELETE FROM contact_messages');
  const hash = await bcrypt.hash('admin1234', 12);
  await pool.query('INSERT INTO users (name, email, password, role, verified) VALUES (?,?,?,?,?)',
    ['Admin', 'ctadmin@test.com', hash, 'admin', true]);
  const a = await request(app).post('/auth/login').send({ email: 'ctadmin@test.com', password: 'admin1234' });
  adminToken = a.body.token;
  const u = await request(app).post('/auth/signup').send({ name: 'U', email: 'ctuser@test.com', password: 'password123', role: 'buyer' });
  userToken = u.body.token;
}, 30000);

afterAll(async () => {
  await pool.query('DELETE FROM contact_messages');
  await pool.query('DELETE FROM users');
  await pool.end();
});

describe('Contact form', () => {
  it('accepts a valid message from the public (201)', async () => {
    const r = await request(app).post('/contact').send({ name: 'Jane', email: 'jane@example.com', message: 'Is this car still available?' });
    expect(r.status).toBe(201);
  });

  it('rejects a missing message (400)', async () => {
    const r = await request(app).post('/contact').send({ name: 'Jane', email: 'jane@example.com' });
    expect(r.status).toBe(400);
  });

  it('rejects a bad email (400)', async () => {
    const r = await request(app).post('/contact').send({ name: 'Jane', email: 'not-an-email', message: 'hello there' });
    expect(r.status).toBe(400);
  });

  it('silently drops honeypot submissions (201, not stored)', async () => {
    const before = (await request(app).get('/admin/contact-messages').set('Authorization', `Bearer ${adminToken}`)).body.length;
    const r = await request(app).post('/contact').send({ name: 'Bot', email: 'bot@spam.com', message: 'spam', website: 'http://spam.example' });
    expect(r.status).toBe(201);
    const after = (await request(app).get('/admin/contact-messages').set('Authorization', `Bearer ${adminToken}`)).body.length;
    expect(after).toBe(before);
  });

  it('lets an admin list messages but blocks non-admins (403)', async () => {
    const adminList = await request(app).get('/admin/contact-messages').set('Authorization', `Bearer ${adminToken}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body.length).toBeGreaterThanOrEqual(1);
    const userList = await request(app).get('/admin/contact-messages').set('Authorization', `Bearer ${userToken}`);
    expect(userList.status).toBe(403);
  });

  it('lets an admin delete a message', async () => {
    const list = await request(app).get('/admin/contact-messages').set('Authorization', `Bearer ${adminToken}`);
    const r = await request(app).delete(`/admin/contact-messages/${list.body[0].id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
  });
});
