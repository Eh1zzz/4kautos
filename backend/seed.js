import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import { pool, connectDB } from './config/db.js';

// Admin credentials are env-driven so the public default never reaches production.
// Local dev falls back to the demo password; for prod run:
//   ADMIN_PASSWORD="a-strong-password" node backend/seed.js
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@4kautos.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

// Every listing needs ≥ MIN_PHOTOS (5) photos for the required angles
// (front, rear, interior, dashboard, engine). These placeholders keep the seed
// self-contained; real sellers upload their own to Cloudflare R2.
const shots = text => ['Front', 'Rear', 'Interior', 'Dashboard', 'Engine']
  .map(angle => `https://placehold.co/800x600/12121f/8b7cff?text=${text}+${angle}`);

// VINs are unique, format-valid (17 chars, no I/O/Q) so seed cars meet the same
// listing standards as new listings and can be opened in the edit form as-is.
const CARS = [
  { title:'2020 Toyota Camry XSE', make:'Toyota', model:'Camry', year:2020, mileage:42000, vin:'4T1BZ1HK5LU045221', price:14500, currency:'USD', bodyType:'Sedan', location:'Atlanta, GA, USA', latitude:33.7490, longitude:-84.3880, condition:'excellent', description:'Full service history. Accident-free. Leather seats, sunroof, push-start.', photos:shots('Toyota+Camry'), featured:true,
    extColor:'Pearl White', intColor:'Black leather', engine:'2.5L I4', transmission:'Automatic', drivetrain:'FWD', mpg:'32 combined', horsepower:203, seats:5, comfortFeatures:['Heated seats','Sunroof','Apple CarPlay'], safetyFeatures:['Blind-spot monitor','Lane-keep assist'], modifications:[] },
  { title:'2019 Honda Accord Sport', make:'Honda', model:'Accord', year:2019, mileage:68000, vin:'1HGCV1F31KA012345', price:11000, currency:'USD', bodyType:'Sedan', location:'London, UK', latitude:51.5074, longitude:-0.1278, condition:'good', description:'One owner. Regular maintenance at Honda dealership. Clean title.', photos:shots('Honda+Accord'), featured:false,
    extColor:'Modern Steel', intColor:'Black', engine:'1.5L Turbo I4', transmission:'CVT', drivetrain:'FWD', mpg:'33 combined', horsepower:192, seats:5, comfortFeatures:['Apple CarPlay','Dual-zone climate'], safetyFeatures:['Honda Sensing','Adaptive cruise'], modifications:[] },
  { title:'2018 BMW 3 Series', make:'BMW', model:'3 Series', year:2018, mileage:55000, vin:'WBA8E9G50JNU56789', price:19500, currency:'USD', bodyType:'Sedan', location:'Munich, Germany', latitude:48.1351, longitude:11.5820, condition:'good', description:'M Sport package. Heated seats, panoramic roof, adaptive cruise.', photos:shots('BMW+3+Series'), featured:true,
    extColor:'Jet Black', intColor:'Tan leather', engine:'2.0L Turbo I4', transmission:'Automatic', drivetrain:'RWD', mpg:'30 combined', horsepower:248, seats:5, comfortFeatures:['Panoramic roof','Heated seats','Harman Kardon audio'], safetyFeatures:['Adaptive cruise','Parking sensors'], modifications:['M Sport package'] },
  { title:'2021 Ford Ranger XLT', make:'Ford', model:'Ranger', year:2021, mileage:28000, vin:'1FTER4FH5MLD33445', price:17000, currency:'USD', bodyType:'Pickup', location:'Houston, TX, USA', latitude:29.7604, longitude:-95.3698, condition:'excellent', description:'Almost new. Under warranty. 4WD, tow package, reverse camera.', photos:shots('Ford+Ranger'), featured:false,
    extColor:'Lightning Blue', intColor:'Ebony', engine:'2.3L EcoBoost I4', transmission:'Automatic', drivetrain:'4WD', mpg:'22 combined', horsepower:270, seats:5, towingCapacity:'3,500 kg', comfortFeatures:['Reverse camera','Apple CarPlay'], safetyFeatures:['Lane-keep assist','Tow package'], modifications:[] },
  { title:'2017 Toyota Land Cruiser', make:'Toyota', model:'Land Cruiser', year:2017, mileage:90000, vin:'JTMHY7AJ5H4078812', price:42000, currency:'USD', bodyType:'SUV', location:'Dubai, UAE', latitude:25.2048, longitude:55.2708, condition:'good', description:'Bulletproof reliability. V8, full options, third row seating.', photos:shots('Land+Cruiser'), featured:true,
    extColor:'Silver Pearl', intColor:'Beige leather', engine:'5.7L V8', transmission:'Automatic', drivetrain:'4WD', mpg:'17 combined', horsepower:381, seats:7, comfortFeatures:['Third-row seating','Sunroof','Premium audio'], safetyFeatures:['Multi-terrain monitor','360° camera'], modifications:[] },
  { title:'2020 Hyundai Elantra', make:'Hyundai', model:'Elantra', year:2020, mileage:35000, vin:'KMHD84LF5LU998877', price:6800000, currency:'NGN', bodyType:'Sedan', location:'Lagos, Nigeria', latitude:6.5244, longitude:3.3792, condition:'excellent', description:'Fuel efficient, very clean, Apple CarPlay. Already in-country.', photos:shots('Hyundai+Elantra'), featured:false,
    extColor:'Phantom Black', intColor:'Grey', engine:'2.0L I4', transmission:'Automatic', drivetrain:'FWD', mpg:'35 combined', horsepower:147, seats:5, comfortFeatures:['Apple CarPlay','Bluetooth'], safetyFeatures:['Blind-spot monitor','Lane-keep assist'], modifications:[] },
  { title:'2019 Lexus RX 350', make:'Lexus', model:'RX 350', year:2019, mileage:48000, vin:'JTJBARBZ5K2156473', price:28000, currency:'USD', bodyType:'SUV', location:'Yokohama, Japan', latitude:35.4437, longitude:139.6380, condition:'excellent', description:'Premium SUV. Mark Levinson audio, panoramic roof, Lexus Safety+.', photos:shots('Lexus+RX350'), featured:true,
    extColor:'Eminent White Pearl', intColor:'Black leather', engine:'3.5L V6', transmission:'Automatic', drivetrain:'AWD', mpg:'23 combined', horsepower:295, seats:5, comfortFeatures:['Mark Levinson audio','Panoramic roof','Heated & cooled seats'], safetyFeatures:['Lexus Safety System+','Adaptive cruise'], modifications:[] },
  { title:'2016 Volkswagen Passat', make:'Volkswagen', model:'Passat', year:2016, mileage:95000, vin:'WVWAB7A35GC047281', price:4500000, currency:'NGN', bodyType:'Sedan', location:'Abuja, Nigeria', latitude:9.0765, longitude:7.3986, condition:'fair', description:'German engineering. Recently serviced. New tyres and brakes. In-country.', photos:shots('VW+Passat'), featured:false,
    extColor:'Platinum Grey', intColor:'Black', engine:'1.8L Turbo I4', transmission:'Automatic', drivetrain:'FWD', mpg:'28 combined', horsepower:170, seats:5, comfortFeatures:['Bluetooth','Cruise control'], safetyFeatures:['Parking sensors'], modifications:['New tyres','New brakes'] },
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
    ['Admin', ADMIN_EMAIL, await hash(ADMIN_PASSWORD), 'admin', true]
  );
  console.log('Created users: seller, buyer, admin');

  let firstCarId;
  for (const c of CARS) {
    const [carRes] = await pool.query(
      'INSERT INTO cars (title, make, model, year, mileage, vin, price, currency, body_type, location, latitude, longitude, `condition`, description, photos, featured, ext_color, int_color, engine, transmission, drivetrain, mpg, horsepower, seats, towing_capacity, comfort_features, safety_features, modifications, seller_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [c.title, c.make, c.model, c.year, c.mileage, c.vin, c.price, c.currency, c.bodyType, c.location, c.latitude, c.longitude, c.condition, c.description, JSON.stringify(c.photos), c.featured,
       c.extColor, c.intColor, c.engine, c.transmission, c.drivetrain, c.mpg, c.horsepower, c.seats, c.towingCapacity || null,
       JSON.stringify(c.comfortFeatures || []), JSON.stringify(c.safetyFeatures || []), JSON.stringify(c.modifications || []), sellerId]
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
  console.log(`  Admin:  ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD === 'admin1234' ? 'admin1234   ⚠️  CHANGE FOR PRODUCTION' : '(the ADMIN_PASSWORD you set)'}`);

  await pool.end();
  process.exit(0);
}

seed().catch(e => { console.error(e.message); process.exit(1); });
