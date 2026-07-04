/* Flutterwave client — thin wrapper over the v3 REST API (uses global fetch, no
   SDK). Gated on FLW_SECRET_KEY: when it's unset the payment routes report 503
   "not configured", so the app runs fine in dev/test without keys.
   Test keys (FLWSECK_TEST-…) and live keys use the same endpoints. */
const FLW_BASE = 'https://api.flutterwave.com/v3';

// Hard timeout on every outbound call. Node's global fetch (undici) has NO
// default timeout, so without this a hung gateway pins the request handler open
// indefinitely — under load those pile up and exhaust the event loop / DB pool,
// and money endpoints leave their idempotency row stuck "in progress". Tunable.
const FLW_TIMEOUT_MS = Number(process.env.FLW_TIMEOUT_MS) || 12000;

const secret = () => process.env.FLW_SECRET_KEY || '';
export const isConfigured = () => !!secret();

// fetch + timeout. Throws on network error/timeout (AbortSignal.timeout fires a
// TimeoutError); each caller below maps that to its own failure contract.
function flwFetch(path, opts = {}) {
  return fetch(`${FLW_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${secret()}`, ...opts.headers },
    signal: AbortSignal.timeout(FLW_TIMEOUT_MS),
  });
}

// True for a timeout/network abort — lets callers log the distinction.
const isTimeout = (err) => err?.name === 'TimeoutError' || err?.name === 'AbortError';

// Create a hosted-checkout payment link. Returns the URL to send the buyer to.
// THROWS on failure/timeout (the route maps it to a 502).
export async function initiatePayment({ tx_ref, amount, currency, redirect_url, customer, meta }) {
  let res;
  try {
    res = await flwFetch('/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx_ref, amount, currency, redirect_url, customer, meta, payment_options: 'card,banktransfer,ussd' }),
    });
  } catch (err) {
    throw new Error(isTimeout(err) ? 'Flutterwave timed out starting the payment' : 'Flutterwave could not start the payment');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success' || !data.data?.link)
    throw new Error(data.message || 'Flutterwave could not start the payment');
  return data.data.link;
}

// Verify a transaction by Flutterwave's numeric id. NEVER trust the webhook's
// amount/status alone — always re-verify server-side before releasing escrow.
// Returns the verified data object, or null if it can't be confirmed (incl. timeout).
export async function verifyTransaction(flwId) {
  let res;
  try {
    res = await flwFetch(`/transactions/${flwId}/verify`);
  } catch (err) {
    console.error('FLW verify:', isTimeout(err) ? 'timed out' : err.message);
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') return null;
  return data.data; // { id, tx_ref, status, amount, currency, customer, ... }
}

// Refund a charge (full by default). Returns true on success, false otherwise
// (incl. timeout) — the route relies on `false` to revert its refund claim, so
// this MUST NOT throw.
export async function refundTransaction(flwId, amount) {
  let res;
  try {
    res = await flwFetch(`/transactions/${flwId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(amount != null ? { amount } : {}),
    });
  } catch (err) {
    console.error('FLW refund:', isTimeout(err) ? 'timed out' : err.message);
    return false;
  }
  const data = await res.json().catch(() => ({}));
  return res.ok && data.status === 'success';
}

// ── Payouts (transfers to sellers) ──────────────────────────
// Bank list for a country (the seller's payout dropdown). Returns [] on failure/timeout.
export async function getBanks(country = 'NG') {
  let res;
  try {
    res = await flwFetch(`/banks/${country}`);
  } catch (err) {
    console.error('FLW banks:', isTimeout(err) ? 'timed out' : err.message);
    return [];
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') return [];
  return (data.data || []).map(b => ({ code: b.code, name: b.name }));
}

// Confirm an account number resolves to a real name (prevents failed payouts).
// Returns the name, or null on failure/timeout.
export async function resolveAccount(accountNumber, bankCode) {
  let res;
  try {
    res = await flwFetch('/accounts/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_number: accountNumber, account_bank: bankCode }),
    });
  } catch (err) {
    console.error('FLW resolve:', isTimeout(err) ? 'timed out' : err.message);
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') return null;
  return data.data?.account_name || null;
}

// Initiate a payout to a bank account. THROWS on failure/timeout; otherwise
// returns the queued transfer (it completes asynchronously, confirmed via the
// transfer webhook). The release route catches the throw and un-claims the release.
export async function createTransfer({ bankCode, accountNumber, amount, currency, reference, narration }) {
  let res;
  try {
    res = await flwFetch('/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_bank: bankCode, account_number: accountNumber, amount, currency, reference, narration: narration || 'Escrow release' }),
    });
  } catch (err) {
    throw new Error(isTimeout(err) ? 'Transfer timed out' : 'Transfer could not be created');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Transfer could not be created');
  return data.data; // { id, reference, status, ... }
}
