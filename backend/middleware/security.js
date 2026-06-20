import rateLimit from 'express-rate-limit';

/**
 * Minimal security headers — equivalent to the most important bits of Helmet,
 * implemented inline so we don't add a dependency. Safe for an API + static
 * frontend served from the same origin.
 */
export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0'); // modern browsers: rely on CSP, disable legacy auditor
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
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
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many requests — please slow down and try again shortly.' },
});
