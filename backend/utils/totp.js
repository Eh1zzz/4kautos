import crypto from 'crypto';

/* RFC 6238 TOTP (6 digits, 30s period, SHA-1) implemented on Node's crypto so
   we add no dependency. Used to two-factor the admin login. Compatible with
   Google Authenticator, Authy, 1Password, etc. */

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Base32 (RFC 4648, no padding) — authenticator apps expect the secret in base32.
export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

/** A fresh random base32 TOTP secret (160-bit, per RFC recommendation). */
export function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

/** The otpauth:// URI an authenticator app imports (QR or manual entry). */
export function otpauthURL(secret, account, issuer = '4Kautos') {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// HOTP for a specific counter → zero-padded 6-digit string.
function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

/**
 * Verify a user-supplied code against the secret. Accepts a ±`window` step drift
 * (default ±1 = 30s each way) for clock skew, and compares in constant time.
 */
export function verifyCode(secret, code, window = 1) {
  const token = String(code || '').replace(/\D/g, '');
  if (token.length !== 6 || !secret) return false;
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const supplied = Buffer.from(token);
  for (let i = -window; i <= window; i++) {
    const expected = Buffer.from(hotp(key, counter + i));
    if (expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied)) return true;
  }
  return false;
}
