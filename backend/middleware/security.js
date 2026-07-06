import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedis } from '../config/redis.js';

/**
 * Shared rate-limit store. Returns a Redis-backed store when REDIS_URL is set
 * (so limits are GLOBAL across replicas — a per-instance MemoryStore would let
 * N replicas each grant the full quota, multiplying the real limit by N).
 * Returns undefined otherwise, so express-rate-limit uses its in-memory default.
 */
export function rateLimitStore(prefix) {
  const client = getRedis();
  if (!client) return undefined;
  return new RedisStore({ prefix, sendCommand: (...args) => client.call(...args) });
}

/**
 * Minimal security headers — equivalent to the most important bits of Helmet,
 * implemented inline so we don't add a dependency. Safe for an API + static
 * frontend served from the same origin.
 */
// Content-Security-Policy — allowlists exactly the external origins the frontend
// uses (Leaflet from unpkg, the anime.js animation engine from esm.sh, Google
// Fonts, OpenStreetMap tiles + nominatim geocode, placeholder/brand-icon CDNs,
// R2 images). 'unsafe-inline' is required by the
// current inline-handler/inline-style markup; migrating those to listeners is the
// follow-up that lets script-src drop to 'self' for true inline-XSS protection.
const cspWith = scriptSrc => [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const CSP = cspWith("'self' 'unsafe-inline' https://unpkg.com https://cdn.socket.io https://esm.sh");

// Strict policy, currently report-only alongside the enforcing one. The page
// scripts are externalized (frontend/js/pages/*) and every inline handler is a
// data-act attribute now; the only inline script left is the theme bootstrap in
// each <head> (kept inline to avoid a theme flash) — allowed by its hash. The
// hash stays OUT of the enforcing policy above: a hash's presence makes
// browsers ignore 'unsafe-inline', which would be the flip itself. Once
// /csp-report stays quiet in production, promote this string to the enforcing
// header. NOTE: editing the theme snippet in any page invalidates the hash —
// keep the snippet byte-identical across pages and recompute if it changes.
const THEME_BOOTSTRAP_HASH = "'sha256-TjJO5PLtGmDgl9ifTd5Zc2pWS5VoHbSfwr4zmApKyi0='";
const CSP_REPORT_ONLY =
  cspWith(`'self' ${THEME_BOOTSTRAP_HASH} https://unpkg.com https://cdn.socket.io https://esm.sh`) +
  '; report-uri /csp-report';

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0'); // modern browsers: rely on CSP, disable legacy auditor
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Content-Security-Policy-Report-Only', CSP_REPORT_ONLY);
  if (process.env.NODE_ENV === 'production')
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
}

/**
 * Stricter limiter for auth endpoints to slow credential-stuffing / brute force.
 * Skipped under tests so the suite isn't throttled.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore('rl:auth:'),
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

// Tighter limiter for write-heavy / abusable endpoints (listing creation, uploads),
// layered under the global limiter so a single client can't flood them.
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore('rl:write:'),
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many requests — please slow down and try again shortly.' },
});
