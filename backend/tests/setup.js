// Set test database and JWT secret before any module is loaded
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || 'postgresql://postgres:password@localhost:5432/4kautos_test';
process.env.JWT_SECRET   = 'test-secret-at-least-32-chars-long!!';
