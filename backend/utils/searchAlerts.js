import { pool } from '../config/db.js';
import { usdOf } from './valuation.js';
import { notifySavedSearchMatch } from './email.js';
import { getRate } from '../routes/fx.js';

/* Saved-search alerts: when a new listing appears, email buyers whose saved
   search it satisfies. The matcher mirrors Car.findAll's filter semantics so a
   listing that WOULD show up under a search is exactly what triggers the alert.

   Emails only actually send once an email driver is configured (Resend/Gmail);
   until then sendMail no-ops, so this is safe to ship dark and lights up the
   day the env vars land. */

const like = (hay, needle) => String(hay || '').toLowerCase().includes(String(needle).toLowerCase());

/** Pure predicate: does `car` satisfy this saved-search `filters` object?
 *  `rate` (USD→NGN) is only needed for the minUsd/maxUsd budget filters. */
export function carMatchesFilters(car, filters = {}, rate = 1600) {
  if (!filters || typeof filters !== 'object') return false;
  const f = filters;

  if (f.make && !like(car.make, f.make)) return false;
  if (f.model && !like(car.model, f.model)) return false;
  if (f.type && car.body_type !== f.type) return false;
  if (f.year && Number(car.year) !== Number(f.year)) return false;

  if (f.condition) {
    const allowed = String(f.condition).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (allowed.length && !allowed.includes(String(car.condition || '').toLowerCase())) return false;
  }

  // Native-currency price bounds (mirrors the listings minPrice/maxPrice inputs).
  const price = car.price != null ? Number(car.price) : null;
  if (f.minPrice && !(price != null && price >= Number(f.minPrice))) return false;
  if (f.maxPrice && !(price != null && price <= Number(f.maxPrice))) return false;

  const mileage = car.mileage != null ? Number(car.mileage) : null;
  if (f.minMileage && !(mileage != null && mileage >= Number(f.minMileage))) return false;
  if (f.maxMileage && !(mileage != null && mileage <= Number(f.maxMileage))) return false;

  // USD-normalised budget bounds.
  if (f.minUsd || f.maxUsd) {
    const usd = usdOf(car.price, car.currency, rate);
    if (usd == null) return false;
    if (f.minUsd && usd < Number(f.minUsd)) return false;
    if (f.maxUsd && usd > Number(f.maxUsd)) return false;
  }

  // Free-text query — substring across the same columns the catalogue searches.
  if (f.q) {
    const hay = `${car.title || ''} ${car.make || ''} ${car.model || ''} ${car.description || ''}`.toLowerCase();
    if (!like(hay, f.q)) return false;
  }

  return true;
}

/** Find every buyer whose saved search matches the new car and email them once.
 *  Fire-and-forget: called after a listing is created; never blocks the response. */
export async function notifySavedSearchMatches(car) {
  try {
    if (!car || car.id == null) return { matched: 0 };
    let rate = 1600;
    try { rate = (await getRate()).usdToNgn || 1600; } catch { /* default is fine */ }

    // Bounded scan of saved searches + their owner's email. Fine at MVP scale;
    // revisit with a pre-filter/index if saved_searches grows large.
    const [rows] = await pool.query(
      `SELECT ss.filters, u.id AS user_id, u.name, u.email
       FROM saved_searches ss
       JOIN users u ON u.id = ss.user_id
       WHERE u.email IS NOT NULL AND u.id <> ?
       LIMIT 5000`,
      [car.seller_id ?? car.sellerId ?? 0]
    );

    const notified = new Set(); // one email per user even if several searches match
    let matched = 0;
    for (const r of rows) {
      if (notified.has(r.user_id)) continue;
      let filters = r.filters;
      if (typeof filters === 'string') { try { filters = JSON.parse(filters); } catch { continue; } }
      if (!carMatchesFilters(car, filters, rate)) continue;
      notified.add(r.user_id);
      matched++;
      notifySavedSearchMatch({ to: r.email, name: r.name, car }).catch(() => {});
    }
    if (matched) console.log(`🔔 saved-search alerts: car ${car.id} matched ${matched} buyer search(es)`);
    return { matched };
  } catch (err) {
    console.error('notifySavedSearchMatches:', err.message);
    return { matched: 0, error: err.message };
  }
}
