import request from 'supertest';
import app     from '../server.js';
import { pool, connectDB } from '../config/db.js';

let sellerToken, buyerToken, seller2Token;

// A fully valid listing payload that satisfies the upload validation rules.
const validCar = (over = {}) => ({
  title: '2020 Toyota Camry XSE',
  make: 'Toyota', model: 'Camry', year: 2020,
  mileage: 42000, price: 9500000, condition: 'good',
  vin: '1HGCM82633A004352',
  location: 'Atlanta, GA, USA', latitude: 33.749, longitude: -84.388,
  photos: [
    'https://example.com/front.jpg',
    'https://example.com/rear.jpg',
    'https://example.com/interior.jpg',
    'https://example.com/odometer.jpg',
    'https://example.com/engine.jpg',
  ],
  ...over,
});

beforeAll(async () => {
  await connectDB();
  const s = await request(app).post('/auth/signup')
    .send({ name:'Seller', email:'seller@test.com', password:'password123', role:'seller' });
  sellerToken = s.body.token;
  const s2 = await request(app).post('/auth/signup')
    .send({ name:'Seller Two', email:'seller2@test.com', password:'password123', role:'seller' });
  seller2Token = s2.body.token;
  const b = await request(app).post('/auth/signup')
    .send({ name:'Buyer', email:'buyer@test.com', password:'password123', role:'buyer' });
  buyerToken = b.body.token;
});

afterEach(async () => {
  // Delete in FK-safe order (children before parents)
  await pool.query('DELETE FROM transactions');
  await pool.query('DELETE FROM cars');
});

afterAll(async () => {
  await pool.query('DELETE FROM transactions');
  await pool.query('DELETE FROM cars');
  await pool.query('DELETE FROM users');
  await pool.end();
});

describe('GET /cars', () => {
  it('returns array', async () => {
    const res = await request(app).get('/cars');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /cars', () => {
  it('lets a seller create a valid listing', async () => {
    const res = await request(app).post('/cars')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(validCar());
    expect(res.status).toBe(201);
    expect(res.body.car.make).toBe('Toyota');
    expect(res.body.car.vin).toBe('1HGCM82633A004352');
  });

  it('rejects a listing missing VIN / photos', async () => {
    const res = await request(app).post('/cars')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ make:'Toyota', model:'Camry', year:2020, price:5000000, condition:'good' });
    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('rejects an invalid VIN', async () => {
    const res = await request(app).post('/cars')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(validCar({ vin: 'NOTAVIN' }));
    expect(res.status).toBe(400);
  });

  it('blocks buyers', async () => {
    const res = await request(app).post('/cars')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(validCar({ make:'Honda', model:'Civic' }));
    expect(res.status).toBe(403);
  });

  it('blocks unauthenticated', async () => {
    const res = await request(app).post('/cars').send(validCar());
    expect(res.status).toBe(401);
  });
});

describe('GET /cars/:id', () => {
  it('returns a car by id without leaking seller email', async () => {
    const create = await request(app).post('/cars')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(validCar({ make:'BMW', model:'X5', year:2018, vin:'WBADT43403G023549' }));
    const id = create.body.car.id;
    const res = await request(app).get(`/cars/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.seller).toBeDefined();
    expect(res.body.seller.email).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/cars/999999');
    expect(res.status).toBe(404);
  });
});

describe('GET /cars/:id/similar', () => {
  it('returns comparable listings, excluding the car itself', async () => {
    const a = await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`)
      .send(validCar({ make:'Toyota', model:'Camry', vin:'1HGCM82633A004352' }));
    await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`)
      .send(validCar({ make:'Toyota', model:'Camry', vin:'1HGCM82633A004353' }));

    const res = await request(app).get(`/cars/${a.body.car.id}/similar`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.every(c => c.id !== a.body.car.id)).toBe(true); // never itself
    expect(res.body[0].photos).toBeDefined();                       // thumbnail field present
  });

  it('returns 404 for an unknown car', async () => {
    const res = await request(app).get('/cars/999999/similar');
    expect(res.status).toBe(404);
  });
});

describe('PUT /cars/:id', () => {
  const makeCar = (over = {}) => request(app).post('/cars')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send(validCar(over));

  it('lets the owning seller update their listing', async () => {
    const id = (await makeCar()).body.car.id;
    const res = await request(app).put(`/cars/${id}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(validCar({ price: 12000000, mileage: 50000, title: '2020 Toyota Camry XSE (updated)' }));
    expect(res.status).toBe(200);
    expect(Number(res.body.car.price)).toBe(12000000);
    expect(res.body.car.mileage).toBe(50000);
    expect(res.body.car.id).toBe(id);
  });

  it('blocks a different seller from editing another seller’s listing', async () => {
    const id = (await makeCar()).body.car.id;
    const res = await request(app).put(`/cars/${id}`)
      .set('Authorization', `Bearer ${seller2Token}`)
      .send(validCar({ price: 1 }));
    expect(res.status).toBe(403);
  });

  it('blocks buyers', async () => {
    const id = (await makeCar()).body.car.id;
    const res = await request(app).put(`/cars/${id}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(validCar());
    expect(res.status).toBe(403);
  });

  it('blocks unauthenticated', async () => {
    const id = (await makeCar()).body.car.id;
    const res = await request(app).put(`/cars/${id}`).send(validCar());
    expect(res.status).toBe(401);
  });

  it('validates the payload (rejects a bad VIN)', async () => {
    const id = (await makeCar()).body.car.id;
    const res = await request(app).put(`/cars/${id}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(validCar({ vin: 'NOTAVIN' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown car', async () => {
    const res = await request(app).put('/cars/999999')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(validCar());
    expect(res.status).toBe(404);
  });
});

describe('GET /cars/:id/valuation', () => {
  // USD-priced so the verdict is independent of the live FX rate.
  const mk = (price, vin, over = {}) => request(app).post('/cars')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send(validCar({ make: 'Toyota', model: 'Camry', currency: 'USD', price, vin, ...over }));

  it('flags a clearly underpriced car as a great price', async () => {
    const a = await mk(5000,  '1HGCM82633A004352');
    await mk(9000,  '1HGCM82633A004353');
    await mk(10000, '1HGCM82633A004354');
    await mk(11000, '1HGCM82633A004355'); // comparables avg = 10000
    const res = await request(app).get(`/cars/${a.body.car.id}/valuation`);
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('great');   // 5000 vs 10000 = -50%
    expect(res.body.sampleSize).toBe(3);
  });

  it('returns no verdict when there are too few comparables', async () => {
    const u = await mk(3000000, '1HGCM82633A004399', { make: 'Koenigsegg', model: 'Jesko' });
    const res = await request(app).get(`/cars/${u.body.car.id}/valuation`);
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBeNull();
  });

  it('404s for an unknown car', async () => {
    const res = await request(app).get('/cars/999999/valuation');
    expect(res.status).toBe(404);
  });
});

describe('Extended vehicle specs', () => {
  it('round-trips the new spec fields on create', async () => {
    const res = await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`)
      .send(validCar({
        make: 'Ford', model: 'F-150', bodyType: 'Pickup', vin: '1FTFW1ET5DFC10001',
        extColor: 'Magnetic Grey', intColor: 'Black', engine: '3.5L V6 EcoBoost',
        transmission: 'Automatic', drivetrain: '4WD', mpg: '20 combined',
        horsepower: 400, seats: 5, towingCapacity: '5,000 kg',
        comfortFeatures: ['Heated seats', 'Apple CarPlay'], safetyFeatures: ['Blind-spot monitor'],
        modifications: ['Lift kit'],
      }));
    expect(res.status).toBe(201);
    const c = res.body.car;
    expect(c.engine).toBe('3.5L V6 EcoBoost');
    expect(c.transmission).toBe('Automatic');
    expect(c.drivetrain).toBe('4WD');
    expect(c.horsepower).toBe(400);
    expect(c.seats).toBe(5);
    expect(c.towing_capacity).toBe('5,000 kg');           // stored — it's a Pickup
    expect(c.comfort_features).toEqual(['Heated seats', 'Apple CarPlay']);
    expect(c.safety_features).toEqual(['Blind-spot monitor']);
  });

  it('rejects an invalid transmission', async () => {
    const res = await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`)
      .send(validCar({ vin: '1FTFW1ET5DFC10002', transmission: 'Warp drive' }));
    expect(res.status).toBe(400);
  });

  it('does not store towing capacity for non-trucks', async () => {
    const res = await request(app).post('/cars').set('Authorization', `Bearer ${sellerToken}`)
      .send(validCar({ make: 'Mazda', model: '3', bodyType: 'Sedan', vin: '1FTFW1ET5DFC10003', towingCapacity: '3000 kg' }));
    expect(res.status).toBe(201);
    expect(res.body.car.towing_capacity).toBeNull();      // not a Pickup → ignored
  });
});
