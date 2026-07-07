import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import request from 'supertest';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';
import { dumpDatabase, runBackup } from '../utils/backup.js';

let adminlessToken;

beforeAll(async () => {
  await connectDB();
  const b = await request(app).post('/auth/signup')
    .send({ name: 'Backup Buyer', email: 'backup-buyer@test.com', password: 'password123', role: 'buyer' });
  adminlessToken = b.body.token;
});

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE email = 'backup-buyer@test.com'");
  await pool.end();
});

describe('database backup', () => {
  it('dump contains schema + data and restores basic structure', async () => {
    const { sql, tables, rows } = await dumpDatabase();
    expect(tables).toBeGreaterThanOrEqual(5);          // users, cars, transactions, ...
    expect(rows).toBeGreaterThan(0);                    // at least the signup above
    expect(sql).toContain('CREATE TABLE `users`');
    expect(sql).toContain('CREATE TABLE `cars`');
    expect(sql).toMatch(/INSERT INTO `users`/);
    expect(sql).toContain('SET FOREIGN_KEY_CHECKS=0;');
    expect(sql).toContain('SET FOREIGN_KEY_CHECKS=1;');
  });

  it('runBackup writes a valid gzip (local mode without S3) and reports status', async () => {
    const r = await runBackup();
    expect(r.ok).toBe(true);
    expect(r.where).toBe('local');                      // S3_BUCKET unset in tests
    const file = path.join(process.cwd(), 'backups', r.key);
    const gz = fs.readFileSync(file);
    const sql = zlib.gunzipSync(gz).toString('utf8');
    expect(sql).toContain('CREATE TABLE `users`');
    fs.unlinkSync(file);                                // clean up the test artifact
  });

  it('backup endpoints are admin-only', async () => {
    const anon = await request(app).post('/admin/backup');
    expect(anon.status).toBe(401);
    const buyer = await request(app).post('/admin/backup')
      .set('Authorization', `Bearer ${adminlessToken}`);
    expect(buyer.status).toBe(403);
    const status = await request(app).get('/admin/backup/status')
      .set('Authorization', `Bearer ${adminlessToken}`);
    expect(status.status).toBe(403);
  });
});
