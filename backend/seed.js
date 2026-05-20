/**
 * 4Kautos — Seed Script
 * Populates the DB with demo data for development/testing.
 * Run: node backend/seed.js
 */
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User        from "./models/User.js";
import Car         from "./models/Car.js";
import Transaction from "./models/Transaction.js";

const CARS = [
  { title:"2020 Toyota Camry XSE", make:"Toyota",  model:"Camry",   year:2020, mileage:42000, price:9500000,  condition:"excellent", description:"Full service history. Accident-free. Leather seats, sunroof, push-start.", photos:["https://placehold.co/800x500/18181d/f59e0b?text=Toyota+Camry"],   featured:true },
  { title:"2019 Honda Accord Sport", make:"Honda",   model:"Accord",  year:2019, mileage:68000, price:7200000,  condition:"good",      description:"One owner. Regular maintenance at Honda dealership. Clean title.", photos:["https://placehold.co/800x500/18181d/f59e0b?text=Honda+Accord"] },
  { title:"2018 BMW 3 Series",        make:"BMW",     model:"3 Series",year:2018, mileage:55000, price:14500000, condition:"good",      description:"M Sport package. Heated seats, panoramic roof, adaptive cruise.", photos:["https://placehold.co/800x500/18181d/f59e0b?text=BMW+3+Series"], featured:true },
  { title:"2021 Ford Ranger XLT",     make:"Ford",    model:"Ranger",  year:2021, mileage:28000, price:11000000, condition:"excellent", description:"Almost new. Under warranty. 4WD, tow package, reverse camera.", photos:["https://placehold.co/800x500/18181d/f59e0b?text=Ford+Ranger"] },
  { title:"2017 Toyota Land Cruiser", make:"Toyota",  model:"Land Cruiser",year:2017,mileage:90000,price:28000000,condition:"good",   description:"Bulletproof reliability. V8, full options, third row seating.", photos:["https://placehold.co/800x500/18181d/f59e0b?text=Land+Cruiser"], featured:true },
  { title:"2020 Hyundai Elantra",     make:"Hyundai", model:"Elantra", year:2020, mileage:35000, price:6800000,  condition:"excellent", description:"Fuel efficient, very clean, Apple CarPlay.", photos:["https://placehold.co/800x500/18181d/f59e0b?text=Hyundai+Elantra"] },
  { title:"2019 Lexus RX 350",        make:"Lexus",   model:"RX 350",  year:2019, mileage:48000, price:22000000, condition:"excellent", description:"Premium SUV. Mark Levinson audio, panoramic roof, Lexus Safety+.", photos:["https://placehold.co/800x500/18181d/f59e0b?text=Lexus+RX350"], featured:true },
  { title:"2016 Volkswagen Passat",   make:"Volkswagen",model:"Passat",year:2016, mileage:95000, price:4500000,  condition:"fair",      description:"German engineering. Recently serviced. New tyres and brakes.", photos:["https://placehold.co/800x500/18181d/f59e0b?text=VW+Passat"] },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_DB_URI || "mongodb://localhost:27017/4kautos");
  console.log("Connected to MongoDB");

  // Clear existing
  await Promise.all([User.deleteMany({}), Car.deleteMany({}), Transaction.deleteMany({})]);
  console.log("Cleared existing data");

  // Create users
  const seller = await new User({ name:"Demo Seller", email:"seller@4kautos.com", password:"password123", role:"seller", verified:true }).save();
  const buyer  = await new User({ name:"Demo Buyer",  email:"buyer@4kautos.com",  password:"password123", role:"buyer",  verified:true }).save();
  const admin  = await new User({ name:"Admin",       email:"admin@4kautos.com",  password:"admin1234",   role:"admin",  verified:true }).save();
  console.log("Created users: seller, buyer, admin");

  // Create cars
  const cars = await Car.insertMany(CARS.map(c => ({ ...c, sellerId: seller._id })));
  console.log(`Created ${cars.length} car listings`);

  // Create a sample transaction
  await new Transaction({ buyerId: buyer._id, sellerId: seller._id, carId: cars[0]._id, status:"pending_inspection" }).save();
  console.log("Created sample transaction");

  console.log("\n✅ Seed complete!");
  console.log("  Seller: seller@4kautos.com / password123");
  console.log("  Buyer:  buyer@4kautos.com  / password123");
  console.log("  Admin:  admin@4kautos.com  / admin1234");
  process.exit(0);
}

seed().catch(e => { console.error(e.message); process.exit(1); });
