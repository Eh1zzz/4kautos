import express from 'express';

const router = express.Router();

// Free, no-key FX provider that includes NGN. Cached server-side so we never
// hammer it and so the frontend gets a fast, same-origin response.
const FX_SOURCE = 'https://open.er-api.com/v6/latest/USD';
const TTL_MS = 60 * 60 * 1000;       // refresh at most once per hour
const FALLBACK_USD_NGN = 1600;        // used only if the provider is unreachable

let cache = { usdToNgn: null, updatedAt: 0, source: null };

async function fetchRate() {
  const res = await fetch(FX_SOURCE, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`FX provider responded ${res.status}`);
  const data = await res.json();
  const ngn = Number(data?.rates?.NGN);
  if (!Number.isFinite(ngn) || ngn <= 0) throw new Error('FX provider returned no NGN rate');
  return ngn;
}

/** Returns the cached rate, refreshing in the background when stale. */
export async function getRate() {
  const fresh = cache.usdToNgn && (Date.now() - cache.updatedAt < TTL_MS);
  if (fresh) return cache;
  try {
    const usdToNgn = await fetchRate();
    cache = { usdToNgn, updatedAt: Date.now(), source: 'open.er-api.com' };
  } catch (err) {
    console.error('FX fetch failed:', err.message);
    // Keep serving the last good value; only fall back if we never had one.
    if (!cache.usdToNgn) cache = { usdToNgn: FALLBACK_USD_NGN, updatedAt: Date.now(), source: 'fallback' };
  }
  return cache;
}

// GET /fx — current USD↔NGN rate
router.get('/', async (_req, res) => {
  const { usdToNgn, updatedAt, source } = await getRate();
  res.json({
    base: 'USD',
    usdToNgn,
    ngnToUsd: usdToNgn ? 1 / usdToNgn : null,
    rates: { USD: 1, NGN: usdToNgn },
    updatedAt,
    source,
  });
});

export default router;
