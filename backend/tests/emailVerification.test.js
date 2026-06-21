import { jest } from '@jest/globals';

// Mock the email driver so the wall logic is exercised with no network calls and
// a togglable "configured" state. Must be registered before importing the app.
let emailOn = false;
const sendVerifyEmail = jest.fn(async () => true);
jest.unstable_mockModule('../utils/email.js', () => ({
  isEmailConfigured: () => emailOn,
  sendVerifyEmail,
  sendPasswordReset: jest.fn(async () => true),
  sendWelcome:       jest.fn(async () => true),
  notifyNewMessage:  jest.fn(async () => true),
  notifyContactMessage: jest.fn(async () => true),
  sendMail:          jest.fn(async () => true),
}));

const request = (await import('supertest')).default;
const app = (await import('../server.js')).default;
const { pool, connectDB } = await import('../config/db.js');

beforeAll(async () => { await connectDB(); });
afterEach(async () => { await pool.query('DELETE FROM users'); sendVerifyEmail.mockClear(); });
afterAll(async () => { await pool.end(); });

describe('email verification wall', () => {
  it('auto-verifies and returns a token when no email driver is configured', async () => {
    emailOn = false;
    const res = await request(app).post('/auth/signup')
      .send({ name: 'No Mail', email: 'nomail@x.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.verifyRequired).toBeUndefined();
    expect(sendVerifyEmail).not.toHaveBeenCalled();
  });

  it('walls signup (no token) and blocks login until verified when email is on', async () => {
    emailOn = true;
    const signup = await request(app).post('/auth/signup')
      .send({ name: 'Mail On', email: 'mailon@x.com', password: 'password123' });
    expect(signup.status).toBe(201);
    expect(signup.body.verifyRequired).toBe(true);
    expect(signup.body.token).toBeUndefined();
    expect(sendVerifyEmail).toHaveBeenCalledTimes(1);

    const login = await request(app).post('/auth/login')
      .send({ email: 'mailon@x.com', password: 'password123' });
    expect(login.status).toBe(403);
    expect(login.body.verifyRequired).toBe(true);
  });

  it('verifies via the emailed token, after which login succeeds', async () => {
    emailOn = true;
    await request(app).post('/auth/signup')
      .send({ name: 'Verify Me', email: 'verifyme@x.com', password: 'password123' });
    // The link passed to the (mocked) emailer carries the raw token.
    const link = sendVerifyEmail.mock.calls[0][1];
    const token = new URL(link).searchParams.get('token');
    expect(token).toBeTruthy();

    const verify = await request(app).get(`/auth/verify?token=${token}`);
    expect(verify.status).toBe(200);

    const login = await request(app).post('/auth/login')
      .send({ email: 'verifyme@x.com', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body).toHaveProperty('token');
  });

  it('rejects an invalid verification token', async () => {
    const res = await request(app).get('/auth/verify?token=deadbeef');
    expect(res.status).toBe(400);
  });
});
