import bcrypt from 'bcrypt';
import { pool, connectDB } from '../config/db.js';
import { claimRelease, unclaimRelease } from '../models/Transaction.js';

// Proves the release single-flight lock: two concurrent claims on the same
// escrowed transaction can't both win (which would mean a double payout).
let txId, buyerId, sellerId, carId;

beforeAll(async () => {
  await connectDB();
  const hash = await bcrypt.hash('x', 4);
  const [b] = await pool.query("INSERT INTO users (name,email,password,role) VALUES ('CB','claimb@test.com',?,'buyer')", [hash]); buyerId = b.insertId;
  const [s] = await pool.query("INSERT INTO users (name,email,password,role) VALUES ('CS','claims@test.com',?,'seller')", [hash]); sellerId = s.insertId;
  const [c] = await pool.query("INSERT INTO cars (make,model,seller_id) VALUES ('T','C',?)", [sellerId]); carId = c.insertId;
  const [t] = await pool.query(
    "INSERT INTO transactions (buyer_id,seller_id,car_id,status,amount,currency) VALUES (?,?,?,'payment_in_escrow',1000,'NGN')",
    [buyerId, sellerId, carId]); txId = t.insertId;
}, 30000);

afterAll(async () => {
  await pool.query('DELETE FROM transactions WHERE id = ?', [txId]);
  await pool.query('DELETE FROM cars WHERE id = ?', [carId]);
  await pool.query('DELETE FROM users WHERE id IN (?,?)', [buyerId, sellerId]);
  await pool.end();
});

describe('release single-flight claim (double-payout guard)', () => {
  it('only one of two concurrent claims wins', async () => {
    const results = await Promise.all([claimRelease(txId), claimRelease(txId)]);
    expect(results.filter(Boolean).length).toBe(1);
  });

  it('unclaim allows a fresh claim (retry after a failed payout)', async () => {
    await unclaimRelease(txId);
    expect(await claimRelease(txId)).toBe(true);
    expect(await claimRelease(txId)).toBe(false); // still single-flight
  });
});
