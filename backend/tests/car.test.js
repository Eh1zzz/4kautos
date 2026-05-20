import request from "supertest";
import mongoose from "mongoose";
import app     from "../server.js";
import User    from "../models/User.js";
import Car     from "../models/Car.js";

const TEST_URI = process.env.MONGO_DB_URI_TEST || "mongodb://localhost:27017/4kautos_test";
let sellerToken, buyerToken;

beforeAll(async () => {
  await mongoose.connect(TEST_URI);
  const s = await request(app).post("/auth/signup").send({ name:"Seller", email:"seller@test.com", password:"password123", role:"seller" });
  sellerToken = s.body.token;
  const b = await request(app).post("/auth/signup").send({ name:"Buyer", email:"buyer@test.com", password:"password123", role:"buyer" });
  buyerToken = b.body.token;
});
afterEach(async () => { await Car.deleteMany({}); });
afterAll(async ()  => { await User.deleteMany({}); await mongoose.connection.close(); });

describe("GET /cars", () => {
  it("returns array", async () => {
    const res = await request(app).get("/cars");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /cars", () => {
  it("lets a seller create a listing", async () => {
    const res = await request(app).post("/cars").set("Authorization", `Bearer ${sellerToken}`).send({ make:"Toyota", model:"Camry", year:2020, price:5000000, condition:"good" });
    expect(res.status).toBe(201);
    expect(res.body.car.make).toBe("Toyota");
  });
  it("blocks buyers", async () => {
    const res = await request(app).post("/cars").set("Authorization", `Bearer ${buyerToken}`).send({ make:"Honda", model:"Civic", year:2019, price:3000000 });
    expect(res.status).toBe(403);
  });
  it("blocks unauthenticated", async () => {
    const res = await request(app).post("/cars").send({ make:"Ford", model:"Ranger", year:2021 });
    expect(res.status).toBe(401);
  });
});

describe("GET /cars/:id", () => {
  it("returns a car by id", async () => {
    const create = await request(app).post("/cars").set("Authorization", `Bearer ${sellerToken}`).send({ make:"BMW", model:"X5", year:2018, price:15000000 });
    const id = create.body.car._id;
    const res = await request(app).get(`/cars/${id}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(id);
  });
  it("returns 404 for unknown id", async () => {
    const res = await request(app).get("/cars/000000000000000000000000");
    expect(res.status).toBe(404);
  });
});
