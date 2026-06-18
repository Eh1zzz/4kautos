/* Flutterwave client — thin wrapper over the v3 REST API (uses global fetch, no
   SDK). Gated on FLW_SECRET_KEY: when it's unset the payment routes report 503
   "not configured", so the app runs fine in dev/test without keys.
   Test keys (FLWSECK_TEST-…) and live keys use the same endpoints. */
const FLW_BASE = 'https://api.flutterwave.com/v3';

const secret = () => process.env.FLW_SECRET_KEY || '';
export const isConfigured = () => !!secret();

// Create a hosted-checkout payment link. Returns the URL to send the buyer to.
export async function initiatePayment({ tx_ref, amount, currency, redirect_url, customer, meta }) {
  const res = await fetch(`${FLW_BASE}/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tx_ref, amount, currency, redirect_url, customer, meta, payment_options: 'card,banktransfer,ussd' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success' || !data.data?.link)
    throw new Error(data.message || 'Flutterwave could not start the payment');
  return data.data.link;
}

// Verify a transaction by Flutterwave's numeric id. NEVER trust the webhook's
// amount/status alone — always re-verify server-side before releasing escrow.
// Returns the verified data object, or null if it can't be confirmed.
export async function verifyTransaction(flwId) {
  const res = await fetch(`${FLW_BASE}/transactions/${flwId}/verify`, {
    headers: { Authorization: `Bearer ${secret()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') return null;
  return data.data; // { id, tx_ref, status, amount, currency, customer, ... }
}
