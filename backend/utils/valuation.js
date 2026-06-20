/* Price valuation — compares a car's USD-normalised price to the average of
   comparable listings and returns a buyer-facing verdict for the "Good price"
   badge. Pure + tiny so it backs both the per-card badge (grouped averages)
   and the detail endpoint (findSimilar), with identical thresholds. */

export function usdOf(price, currency, usdToNgn) {
  if (price == null) return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  if (currency === 'USD') return n;
  return usdToNgn ? n / usdToNgn : null;
}

// Buckets are slightly buyer-friendly (a deal is flagged a touch more readily
// than "overpriced"). Needs >= 3 comparables to say anything at all.
export function priceVerdict(carUsd, avgUsd, sampleSize) {
  if (carUsd == null || avgUsd == null || avgUsd <= 0 || !sampleSize || sampleSize < 3)
    return { verdict: null, sampleSize: sampleSize || 0 };
  const pct = Math.round(((carUsd - avgUsd) / avgUsd) * 100);
  let verdict;
  if (pct <= -12)     verdict = 'great';
  else if (pct <= -4) verdict = 'good';
  else if (pct < 6)   verdict = 'fair';
  else                verdict = 'high';
  return { verdict, pctVsAvg: pct, sampleSize, avgUsd: Math.round(avgUsd) };
}

export const VERDICT_LABEL = {
  great: 'Great price',
  good:  'Good price',
  fair:  'Fair price',
  high:  'Above market',
};
