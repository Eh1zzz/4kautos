// Load .env first so DATABASE_URL_TEST is available, then point the app at the
// test database. dotenv does not override already-set vars, so the explicit
// assignment below wins when db.js later calls dotenv.config() again.
import dotenv from 'dotenv';
dotenv.config();

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
  || 'mysql://kautos_app:Kautos4DevLocalOnly@localhost:3306/4kautos_test';
process.env.JWT_SECRET = process.env.JWT_SECRET
  || 'test-secret-at-least-32-chars-long!!';
