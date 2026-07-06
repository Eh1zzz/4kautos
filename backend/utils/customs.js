/* ── Customs duty engine ─────────────────────────────────────
   Single source of truth for Nigerian vehicle import charges and the partner
   clearing-agent quotes. Used by POST /clearance/estimate (manual value) and
   GET /cars/:id/customs (per-listing breakdown) so the two can never drift. */

export const round2 = n => Math.round(n * 100) / 100;

/* Published Nigeria Customs Service structure for used passenger vehicles.
   All ad-valorem rates are applied to the CIF value except the port surcharge
   (7% of the import duty) and VAT (7.5% of CIF + all prior charges). */
export const NG_RATES = {
  importDuty: { label: 'Import duty',        ratePct: 20,   basis: 'CIF value' },
  nacLevy:    { label: 'NAC levy',           ratePct: 15,   basis: 'CIF value' },
  etls:       { label: 'ECOWAS levy (ETLS)', ratePct: 0.5,  basis: 'CIF value' },
  ciss:       { label: 'CISS fee',           ratePct: 1,    basis: 'CIF value' },
  surcharge:  { label: 'Port surcharge',     ratePct: 7,    basis: 'Import duty' },
  vat:        { label: 'VAT',                ratePct: 7.5,  basis: 'CIF + duties & levies' },
};

/**
 * Full Nigerian government charges on a vehicle's CIF value (USD).
 * Returns the flat per-charge map (legacy shape used by /clearance/estimate),
 * plus `lineItems` (each fee with its rate %) and `effectivePct` — the all-in
 * total expressed as a percentage of the vehicle value.
 */
export function governmentCharges(cifUsd) {
  const importDuty = cifUsd * (NG_RATES.importDuty.ratePct / 100);
  const nacLevy    = cifUsd * (NG_RATES.nacLevy.ratePct / 100);
  const etls       = cifUsd * (NG_RATES.etls.ratePct / 100);
  const ciss       = cifUsd * (NG_RATES.ciss.ratePct / 100);
  const surcharge  = importDuty * (NG_RATES.surcharge.ratePct / 100);
  const vatBase    = cifUsd + importDuty + nacLevy + etls + ciss + surcharge;
  const vat        = vatBase * (NG_RATES.vat.ratePct / 100);
  const total      = importDuty + nacLevy + etls + ciss + surcharge + vat;

  const amounts = { importDuty, nacLevy, etls, ciss, surcharge, vat };
  return {
    ...Object.fromEntries(Object.entries(amounts).map(([k, v]) => [k, round2(v)])),
    total: round2(total),
    effectivePct: cifUsd > 0 ? round2((total / cifUsd) * 100) : 0,
    lineItems: Object.entries(amounts).map(([key, amountUsd]) => ({
      key,
      label: NG_RATES[key].label,
      ratePct: NG_RATES[key].ratePct,
      basis: NG_RATES[key].basis,
      amountUsd: round2(amountUsd),
    })),
  };
}

/* ── Clearance agents directory ──────────────────────────────
   Curated partner agents. Kept here (not in the DB) so the feature ships
   without a migration; the shape is DB-ready if it ever needs to move. */
export const AGENTS = [
  { id: 'swiftclear',  name: 'SwiftClear Logistics',   rating: 4.8, reviews: 312, baseFeeUsd: 220, ratePercent: 1.2, turnaroundDays: 4, verified: true,  port: 'Tin Can Island, Lagos', phone: '+234 801 000 0001', services: ['Duty payment', 'Terminal handling', 'Doorstep delivery'] },
  { id: 'naijaports',  name: 'NaijaPorts Clearing',    rating: 4.6, reviews: 198, baseFeeUsd: 180, ratePercent: 1.6, turnaroundDays: 6, verified: true,  port: 'PTML, Lagos',           phone: '+234 802 000 0002', services: ['Duty payment', 'Documentation', 'Inland haulage'] },
  { id: 'crestmarine', name: 'Crest Marine Agents',    rating: 4.9, reviews: 421, baseFeeUsd: 300, ratePercent: 0.9, turnaroundDays: 3, verified: true,  port: 'Onne, Port Harcourt',   phone: '+234 803 000 0003', services: ['Express clearing', 'Duty payment', 'Insurance', 'Delivery'] },
  { id: 'gatewaycfa',  name: 'Gateway CFA',            rating: 4.3, reviews: 96,  baseFeeUsd: 140, ratePercent: 1.9, turnaroundDays: 8, verified: false, port: 'Tin Can Island, Lagos', phone: '+234 804 000 0004', services: ['Duty payment', 'Documentation'] },
  { id: 'sahelclear',  name: 'Sahel Clearing Co.',     rating: 4.5, reviews: 154, baseFeeUsd: 200, ratePercent: 1.4, turnaroundDays: 5, verified: true,  port: 'Apapa, Lagos',          phone: '+234 805 000 0005', services: ['Duty payment', 'Terminal handling', 'Inland haulage'] },
];

/** All-in agent quotes (government total + each agent's fee), cheapest first. */
export function quoteAgents(cifUsd, govTotalUsd, usdToNgn) {
  const quotes = AGENTS.map(a => {
    const agentFeeUsd = round2(a.baseFeeUsd + (cifUsd * a.ratePercent) / 100);
    const totalUsd    = round2(govTotalUsd + agentFeeUsd);
    return {
      id: a.id, name: a.name, rating: a.rating, reviews: a.reviews,
      turnaroundDays: a.turnaroundDays, verified: a.verified, port: a.port,
      phone: a.phone, services: a.services,
      agentFeeUsd, totalUsd, totalNgn: round2(totalUsd * usdToNgn),
    };
  }).sort((x, y) => x.totalUsd - y.totalUsd);
  if (quotes.length) quotes[0].bestRate = true; // cheapest all-in cost
  return quotes;
}

/** Advisory notes shared by both endpoints (vehicle-age levies, estimate labels). */
export function customsNotes(year, dest) {
  const notes = [];
  const y = Number.parseInt(year, 10);
  if (Number.isInteger(y)) {
    const age = new Date().getFullYear() - y;
    if (age > 12) notes.push(`This vehicle is ${age} years old — cars over 12 years may face additional age levies or import restrictions.`);
  }
  if (dest?.estimate) notes.push(`Charges for ${dest.country} are an indicative estimate (~${dest.effectiveDutyPct}% of value); final duties are set by local customs.`);
  return notes;
}

export const customsDisclaimer = country => country === 'Nigeria'
  ? 'Indicative estimate only. Final charges are set by the Nigeria Customs Service based on the official valuation.'
  : `Indicative estimate only. Final charges are set by ${country} customs based on the official valuation.`;
