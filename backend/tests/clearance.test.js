import request from 'supertest';
import app from '../server.js';
import { pool, connectDB } from '../config/db.js';

beforeAll(async () => { await connectDB(); });
afterAll(async () => { await pool.end(); });

describe('POST /clearance/estimate', () => {
  it('defaults to Nigeria with a detailed duty breakdown + agents', async () => {
    const r = await request(app).post('/clearance/estimate').send({ cifValueUsd: 10000 });
    expect(r.status).toBe(200);
    expect(r.body.destination.country).toBe('Nigeria');
    expect(r.body.government.estimate).toBe(false);
    expect(r.body.government.importDuty).toBeGreaterThan(0);
    expect(r.body.agents.length).toBeGreaterThan(0);
  });

  it('returns a labeled estimate + contact (no agents) for a neighbour', async () => {
    const r = await request(app).post('/clearance/estimate').send({ cifValueUsd: 10000, destinationLocale: 'Accra, Ghana' });
    expect(r.status).toBe(200);
    expect(r.body.destination.country).toBe('Ghana');
    expect(r.body.government.estimate).toBe(true);
    expect(r.body.government.total).toBeGreaterThan(0);
    expect(r.body.agents.length).toBe(0);
    expect(r.body.destination.contact.protocol).toBeTruthy();
  });

  it('rejects a missing/invalid value (400)', async () => {
    const r = await request(app).post('/clearance/estimate').send({});
    expect(r.status).toBe(400);
  });
});
