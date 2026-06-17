import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import { pool, connectDB } from './config/db.js';

const CARS = [
  { title:'2020 Toyota Camry XSE',   make:'Toyota',     model:'Camry',       year:2020, mileage:42000, price:14500, currency:'USD', location:'Atlanta, GA, USA',     latitude:33.7490,  longitude:-84.3880, condition:'excellent', description:'Full service history. Accident-free. Leather seats, sunroof, push-start.', photos:['https://placehold.co/800x500/12121f/8b7cff?text=Toyota+Camry'],   featured:true  },
  { title:'2019 Honda Accord Sport',  make:'Honda',      model:'Accord',      year:2019, mileage:68000, price:11000, currency:'USD', location:'London, UK',           latitude:51.5074,  longitude:-0.1278,  condition:'good',      description:'One owner. Regular maintenance at Honda dealership. Clean title.', photos:['https://placehold.co/800x500/12121f/8b7cff?text=Honda+Accord'],   featured:false },
  { title:'2018 BMW 3 Series',        make:'BMW',        model:'3 Series',    year:2018, mileage:55000, price:19500, currency:'USD', location:'Munich, Germany',      latitude:48.1351,  longitude:11.5820,  condition:'good',      description:'M Sport package. Heated seats, panoramic roof, adaptive cruise.', photos:['https://placehold.co/800x500/12121f/8b7cff?text=BMW+3+Series'],   featured:true  },
  { title:'2021 Ford Ranger XLT',     make:'Ford',       model:'Ranger',      year:2021, mileage:28000, price:17000, currency:'USD', location:'Houston, TX, USA',     latitude:29.7604,  longitude:-95.3698, condition:'excellent', description:'Almost new. Under warranty. 4WD, tow package, reverse camera.', photos:['https://placehold.co/800x500/12121f/8b7cff?text=Ford+Ranger'],    featured:false },
  { title:'2017 Toyota Land Cruiser', make:'Toyota',     model:'Land Cruiser',year:2017, mileage:90000, price:42000, currency:'USD', location:'Dubai, UAE',           latitude:25.2048,  longitude:55.2708,  condition:'good',      description:'Bulletproof reliability. V8, full options, third row seating.', photos:['https://placehold.co/800x500/12121f/8b7cff?text=Land+Cruiser'],   featured:true  },
  { title:'2020 Hyundai Elantra',     make:'Hyundai',    model:'Elantra',     year:2020, mileage:35000, price:6800000, currency:'NGN', location:'Lagos, Nigeria',      latitude:6.5244,   longitude:3.3792,   condition:'excellent', description:'Fuel efficient, very clean, Apple CarPlay. Already in-country.', photos:['https://placehold.co/800x500/12121f/8b7cff?text=Hyundai+Elantra'],featured:false },
  { title:'2019 Lexus RX 350',        make:'Lexus',      model:'RX 350',      year:2019, mileage:48000, price:28000, currency:'USD', location:'Yokohama, Japan',      latitude:35.4437,  longitude:139.6380, condition:'excellent', description:'Premium SUV. Mark Levinson audio, panoramic roof, Lexus Safety+.', photos:['https://placehold.co/800x500/12121f/8b7cff?text=Lexus+RX350'],    featured:true  },
  { title:'2016 Volkswagen Passat',   make:'Volkswagen', model:'Passat',      year:2016, mileage:95000, price:4500000, currency:'NGN', location:'Abuja, Nigeria',      latitude:9.0765,   longitude:7.3986,   condition:'fair',      description:'German engineering. Recently serviced. New tyres and brakes. In-country.', photos:['https://placehold.co/800x500/12121f/8b7cff?text=VW+Passat'],      featured:false },
];

async function seed() {
  await connectDB();
  console.log('Connected to MySQL');

  // Clear all data and reset AUTO_INCREMENT counters
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query('TRUNCATE TABLE transactions');
  await pool.query('TRUNCATE TABLE cars');
  await pool.query('TRUNCATE TABLE users');
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('Cleared existing data');

  const hash = p => bcrypt.hash(p, 12);

  const [sellerRes] = await pool.query(
    'INSERT INTO users (name, email, password, role, verified) VALUES (?,?,?,?,?)',
    ['Demo Seller', 'seller@4kautos.com', await hash('password123'), 'seller', true]
  );
  const sellerId = sellerRes.insertId;

  const [buyerRes] = await pool.query(
    'INSERT INTO users (name, email, password, role, verified) VALUES (?,?,?,?,?)',
    ['Demo Buyer', 'buyer@4kautos.com', await hash('password123'), 'buyer', true]
  );
  const buyerId = buyerRes.insertId;

  await pool.query(
    'INSERT INTO users (name, email, password, role, verified) VALUES (?,?,?,?,?)',
    ['Admin', 'admin@4kautos.com', await hash('admin1234'), 'admin', true]
  );
  console.log('Created users: seller, buyer, admin');

  let firstCarId;
  for (const c of CARS) {
    const [carRes] = await pool.query(
      'INSERT INTO cars (title, make, model, year, mileage, price, currency, location, latitude, longitude, `condition`, description, photos, featured, seller_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [c.title, c.make, c.model, c.year, c.mileage, c.price, c.currency, c.location, c.latitude, c.longitude, c.condition, c.description, JSON.stringify(c.photos), c.featured, sellerId]
    );
    if (!firstCarId) firstCarId = carRes.insertId;
  }
  console.log(`Created ${CARS.length} car listings`);

  await pool.query(
    'INSERT INTO transactions (buyer_id, seller_id, car_id, status) VALUES (?,?,?,?)',
    [buyerId, sellerId, firstCarId, 'pending_inspection']
  );
  console.log('Created sample transaction');

  console.log('\n✅ Seed complete!');
  console.log('  Seller: seller@4kautos.com / password123');
  console.log('  Buyer:  buyer@4kautos.com  / password123');
  console.log('  Admin:  admin@4kautos.com  / admin1234');

  await pool.end();
  process.exit(0);
}

seed().catch(e => { console.error(e.message); process.exit(1); });
