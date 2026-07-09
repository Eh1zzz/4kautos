// Load .env first so DATABASE_URL_TEST is available, then point the app at the
// test database. dotenv does not override already-set vars, so the explicit
// assignment below wins when db.js later calls dotenv.config() again.
import dotenv from 'dotenv';
dotenv.config();

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
  || 'mysql://kautos_app:Kautos4DevLocalOnly@localhost:3306/4kautos_test';
process.env.JWT_SECRET = process.env.JWT_SECRET
  || 'test-secret-at-least-32-chars-long!!';
process.env.NODE_ENV = 'test';

// SAFETY NET: the suite truncates users/cars/transactions in teardown, so it
// must NEVER point at a real database. Hard-fail unless the target DB name looks
// like a test DB. (This file must be wired via jest "setupFiles" so it runs
// before db.js creates its pool — otherwise the pool would bind to the dev/prod
// DATABASE_URL and the tests would wipe it.)
const dbName = (() => { try { return new URL(process.env.DATABASE_URL).pathname.replace(/^\//, ''); } catch { return ''; } })();
if (!/test/i.test(dbName)) {
  throw new Error(
    `Refusing to run the test suite against database "${dbName}" — its name must contain "test". ` +
    `Set DATABASE_URL_TEST to a dedicated test database.`);
}
