import request from "supertest";
import mongoose from "mongoose";
import app     from "../server.js";
import User    from "../models/User.js";

const TEST_URI = process.env.MONGO_DB_URI_TEST || "mongodb://localhost:27017/4kautos_test";

beforeAll(async () => { await mongoose.connect(TEST_URI); });
afterEach(async () => { await User.deleteMany({}); });
afterAll(async ()  => { await mongoose.connection.close(); });

describe("POST /auth/signup", () => {
  it("creates a new user and returns token", async () => {
    const res = await request(app).post("/auth/signup").send({ name:"Test User", email:"test@example.com", password:"password123", role:"buyer" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe("test@example.com");
  });
  it("rejects short passwords", async () => {
    const res = await request(app).post("/auth/signup").send({ name:"Test", email:"t@t.com", password:"abc" });
    expect(res.status).toBe(400);
  });
  it("rejects duplicate emails", async () => {
    await request(app).post("/auth/signup").send({ name:"A", email:"dup@x.com", password:"pass123" });
    const res = await request(app).post("/auth/signup").send({ name:"B", email:"dup@x.com", password:"pass123" });
    expect(res.status).toBe(409);
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/auth/signup").send({ name:"Login Test", email:"login@test.com", password:"mypassword" });
  });
  it("returns token with valid credentials", async () => {
    const res = await request(app).post("/auth/login").send({ email:"login@test.com", password:"mypassword" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });
  it("rejects wrong password", async () => {
    const res = await request(app).post("/auth/login").send({ email:"login@test.com", password:"wrongpass" });
    expect(res.status).toBe(401);
  });
  it("rejects unknown email", async () => {
    const res = await request(app).post("/auth/login").send({ email:"nobody@test.com", password:"pass" });
    expect(res.status).toBe(401);
  });
});
