import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';

let sellerToken, buyerToken;

beforeAll(async () => {
  await connectDB();
  const s = await request(app).post('/auth/signup').send({ name: 'Up Seller', email: 'upseller@test.com', password: 'password123', role: 'seller' });
  sellerToken = s.body.token;
  const b = await request(app).post('/auth/signup').send({ name: 'Up Buyer', email: 'upbuyer@test.com', password: 'password123', role: 'buyer' });
  buyerToken = b.body.token;
}, 30000);

afterAll(async () => { await pool.query('DELETE FROM users'); await pool.end(); });

describe('POST /uploads/doc', () => {
  it('blocks non-sellers (403)', async () => {
    const res = await request(app).post('/uploads/doc').set('Authorization', `Bearer ${buyerToken}`)
      .attach('document', Buffer.from('%PDF-1.4\ntest'), 'r.pdf');
    expect(res.status).toBe(403);
  });

  it('400 when no file is sent', async () => {
    const res = await request(app).post('/uploads/doc').set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(400);
  });

  it('415 for a buffer that is neither PDF nor image', async () => {
    const res = await request(app).post('/uploads/doc').set('Authorization', `Bearer ${sellerToken}`)
      .attach('document', Buffer.from('just plain text, not a real document'), 'x.txt');
    expect(res.status).toBe(415);
  });

  it('accepts a PDF and returns a .pdf url', async () => {
    const res = await request(app).post('/uploads/doc').set('Authorization', `Bearer ${sellerToken}`)
      .attach('document', Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj<<>>endobj\n'), 'report.pdf');
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/\.pdf$/);
    // In test mode putObject writes to local disk — clean up the artifact.
    if (res.body.url?.startsWith('/uploads/')) {
      try { fs.unlinkSync(path.join(process.cwd(), 'public', res.body.url)); } catch {}
    }
  });
});
