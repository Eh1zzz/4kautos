/* ── Shared validation & helpers ─────────────────────────────
   Pure functions (no DB / no Express) so they are easy to unit-test
   and reuse across routes and models. */

export const CONDITIONS = ['excellent', 'good', 'fair', 'poor'];
export const CURRENCIES = ['NGN', 'USD'];

// Minimum photos a listing must include. The seller UI maps these to the
// required angles: front, rear, interior, dashboard/odometer, engine bay.
export const MIN_PHOTOS = 5;

const YEAR_MIN = 1980;
const YEAR_MAX = new Date().getFullYear() + 1; // allow next-model-year cars
const MILEAGE_MAX = 2_000_000;
const PRICE_MAX = 1_000_000_000_000; // 1e12 — guards against overflow/garbage

/** Parse a value into a positive integer DB id, or null if invalid. */
export function toId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Basic, permissive email shape check (full RFC validation is overkill). */
export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate a VIN: 17 characters, digits + uppercase letters excluding I, O, Q
 * (per ISO 3779). Returns the normalised (uppercased) VIN or null.
 */
export function normalizeVIN(vin) {
  if (typeof vin !== 'string') return null;
  const v = vin.trim().toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(v) ? v : null;
}

/**
 * Validate and normalise a car listing payload.
 * @returns {{ errors: string[], value: object }}
 */
export function validateCarInput(body = {}) {
  const errors = [];
  const value = {};

  const make = typeof body.make === 'string' ? body.make.trim() : '';
  if (!make) errors.push('Make is required');
  else if (make.length > 100) errors.push('Make is too long');
  value.make = make;

  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!model) errors.push('Model is required');
  else if (model.length > 100) errors.push('Model is too long');
  value.model = model;

  const year = Number.parseInt(body.year, 10);
  if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX)
    errors.push(`Year must be between ${YEAR_MIN} and ${YEAR_MAX}`);
  value.year = Number.isInteger(year) ? year : null;

  const mileage = Number.parseInt(body.mileage, 10);
  if (!Number.isInteger(mileage) || mileage < 0 || mileage > MILEAGE_MAX)
    errors.push('Mileage is required and must be between 0 and 2,000,000 km');
  value.mileage = Number.isInteger(mileage) ? mileage : null;

  const vin = normalizeVIN(body.vin);
  if (!vin) errors.push('A valid 17-character VIN is required (letters I, O, Q are not allowed)');
  value.vin = vin;

  const price = Number.parseFloat(body.price);
  if (!Number.isFinite(price) || price <= 0 || price > PRICE_MAX)
    errors.push('Price is required and must be greater than 0');
  value.price = Number.isFinite(price) ? price : null;

  const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : 'NGN';
  if (!CURRENCIES.includes(currency)) errors.push(`Currency must be one of: ${CURRENCIES.join(', ')}`);
  value.currency = CURRENCIES.includes(currency) ? currency : 'NGN';

  const condition = typeof body.condition === 'string' ? body.condition.toLowerCase() : 'good';
  if (!CONDITIONS.includes(condition)) errors.push(`Condition must be one of: ${CONDITIONS.join(', ')}`);
  value.condition = CONDITIONS.includes(condition) ? condition : 'good';

  // Photos: array of non-empty URL/path strings, at least MIN_PHOTOS.
  const photos = Array.isArray(body.photos)
    ? body.photos.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim())
    : [];
  if (photos.length < MIN_PHOTOS)
    errors.push(`At least ${MIN_PHOTOS} photos are required (front, rear, interior, odometer, engine bay)`);
  value.photos = photos;

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length > 5000) errors.push('Description is too long (max 5000 characters)');
  value.description = description || null;

  // Location: a human label (e.g. "Atlanta, GA, USA") is required so buyers know
  // where the car ships from. Coordinates are optional (geocoded client-side).
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  if (!location) errors.push('Location is required (city, country)');
  else if (location.length > 160) errors.push('Location is too long');
  value.location = location || null;

  const lat = body.latitude != null && body.latitude !== '' ? Number(body.latitude) : null;
  const lng = body.longitude != null && body.longitude !== '' ? Number(body.longitude) : null;
  if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) errors.push('Invalid latitude');
  if (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) errors.push('Invalid longitude');
  value.latitude  = Number.isFinite(lat) ? lat : null;
  value.longitude = Number.isFinite(lng) ? lng : null;

  // Title is optional — derive a sensible one when omitted.
  const title = typeof body.title === 'string' && body.title.trim()
    ? body.title.trim()
    : [value.year, value.make, value.model].filter(Boolean).join(' ');
  value.title = title || null;

  return { errors, value };
}
