import express from 'express';
import { getRate } from './fx.js';
import { resolveDestination, DESTINATIONS } from '../utils/locale.js';

const router = express.Router();

/* ── Clearance agents directory ──────────────────────────────
   Curated partner agents. Kept here (not in the DB) so the feature ships
   without a migration; the shape is DB-ready if it ever needs to move. */
const AGENTS = [
  { id: 'swiftclear',  name: 'SwiftClear Logistics',   rating: 4.8, reviews: 312, baseFeeUsd: 220, ratePercent: 1.2, turnaroundDays: 4, verified: true,  port: 'Tin Can Island, Lagos', phone: '+234 801 000 0001', services: ['Duty payment', 'Terminal handling', 'Doorstep delivery'] },
  { id: 'naijaports',  name: 'NaijaPorts Clearing',    rating: 4.6, reviews: 198, baseFeeUsd: 180, ratePercent: 1.6, turnaroundDays: 6, verified: true,  port: 'PTML, Lagos',           phone: '+234 802 000 0002', services: ['Duty payment', 'Documentation', 'Inland haulage'] },
  { id: 'crestmarine', name: 'Crest Marine Agents',    rating: 4.9, reviews: 421, baseFeeUsd: 300, ratePercent: 0.9, turnaroundDays: 3, verified: true,  port: 'Onne, Port Harcourt',   phone: '+234 803 000 0003', services: ['Express clearing', 'Duty payment', 'Insurance', 'Delivery'] },
  { id: 'gatewaycfa',  name: 'Gateway CFA',            rating: 4.3, reviews: 96,  baseFeeUsd: 140, ratePercent: 1.9, turnaroundDays: 8, verified: false, port: 'Tin Can Island, Lagos', phone: '+234 804 000 0004', services: ['Duty payment', 'Documentation'] },
  { id: 'sahelclear',  name: 'Sahel Clearing Co.',     rating: 4.5, reviews: 154, baseFeeUsd: 200, ratePercent: 1.4, turnaroundDays: 5, verified: true,  port: 'Apapa, Lagos',          phone: '+234 805 000 0005', services: ['Duty payment', 'Terminal handling', 'Inland haulage'] },
];

const round2 = n => Math.round(n * 100) / 100;

/**
 * Indicative Nigerian import charges on a vehicle, computed on the CIF value.
 * Rates approximate published Customs structure; this is an ESTIMATE, not an
 * official quotation. Returns all figures in USD.
 */
function governmentCharges(cifUsd) {
  const importDuty = cifUsd * 0.20;          // 20% import duty
  const nacLevy    = cifUsd * 0.15;          // 15% NAC levy (cars)
  const etls       = cifUsd * 0.005;         // 0.5% ECOWAS levy
  const ciss       = cifUsd * 0.01;          // 1% CISS
  const surcharge  = importDuty * 0.07;      // 7% port surcharge on duty
  const vatBase    = cifUsd + importDuty + nacLevy + etls + ciss + surcharge;
  const vat        = vatBase * 0.075;        // 7.5% VAT
  const total      = importDuty + nacLevy + etls + ciss + surcharge + vat;
  return {
    importDuty: round2(importDuty),
    nacLevy:    round2(nacLevy),
    etls:       round2(etls),
    ciss:       round2(ciss),
    surcharge:  round2(surcharge),
    vat:        round2(vat),
    total:      round2(total),
  };
}

// GET /clearance/agents — directory for the comparison table
router.get('/agents', (_req, res) => {
  res.json(AGENTS);
});

// GET /clearance/destinations — supported destination profiles (for the UI).
router.get('/destinations', (_req, res) => {
  res.json(Object.entries(DESTINATIONS).map(([country, d]) => ({
    country, port: d.port, currency: d.currency,
    effectiveDutyPct: d.effectiveDutyPct, estimate: d.estimate,
  })));
});

// POST /clearance/estimate — duty + best-rate agent comparison
// body: { cifValueUsd, year?, currency? ('USD'|'NGN'), cifValueNgn? }
router.post('/estimate', async (req, res) => {
  try {
    const { usdToNgn, updatedAt, source } = await getRate();

    // Accept the car value in either currency.
    let cifUsd = Number(req.body.cifValueUsd);
    if (!Number.isFinite(cifUsd) && Number.isFinite(Number(req.body.cifValueNgn)))
      cifUsd = Number(req.body.cifValueNgn) / usdToNgn;
    if (!Number.isFinite(cifUsd) || cifUsd <= 0)
      return res.status(400).json({ message: 'A positive vehicle value (cifValueUsd or cifValueNgn) is required' });

    // Resolve the destination from the buyer's locale (defaults to Nigeria).
    const dest = resolveDestination(req.body.destinationLocale);

    let government, agents = [];
    if (dest.country === 'Nigeria') {
      const gov = governmentCharges(cifUsd);
      government = { ...gov, totalNgn: round2(gov.total * usdToNgn), estimate: false };
      agents = AGENTS.map(a => {
        const agentFeeUsd = round2(a.baseFeeUsd + (cifUsd * a.ratePercent) / 100);
        const totalUsd    = round2(gov.total + agentFeeUsd);
        return {
          id: a.id, name: a.name, rating: a.rating, reviews: a.reviews,
          turnaroundDays: a.turnaroundDays, verified: a.verified, port: a.port,
          phone: a.phone, services: a.services,
          agentFeeUsd, totalUsd, totalNgn: round2(totalUsd * usdToNgn),
        };
      }).sort((x, y) => x.totalUsd - y.totalUsd);
      if (agents.length) agents[0].bestRate = true; // cheapest all-in cost
    } else {
      // Labeled estimate for non-Nigeria destinations (single effective rate).
      const total = round2((cifUsd * dest.effectiveDutyPct) / 100);
      government = { total, totalNgn: round2(total * usdToNgn), effectiveDutyPct: dest.effectiveDutyPct, estimate: true };
    }

    const notes = [];
    const year = Number.parseInt(req.body.year, 10);
    if (Number.isInteger(year)) {
      const age = new Date().getFullYear() - year;
      if (age > 12) notes.push(`This vehicle is ${age} years old — cars over 12 years may face additional age levies or import restrictions.`);
    }
    if (dest.estimate) notes.push(`Charges for ${dest.country} are an indicative estimate (~${dest.effectiveDutyPct}% of value); final duties are set by local customs.`);

    res.json({
      fx: { usdToNgn, updatedAt, source },
      input: { cifValueUsd: round2(cifUsd), cifValueNgn: round2(cifUsd * usdToNgn) },
      destination: {
        country: dest.country, port: dest.port, currency: dest.currency,
        effectiveDutyPct: dest.effectiveDutyPct, estimate: dest.estimate, contact: dest.contact,
      },
      government,
      agents,
      bestAgentId: agents[0]?.id || null,
      notes,
      disclaimer: dest.country === 'Nigeria'
        ? 'Indicative estimate only. Final charges are set by the Nigeria Customs Service based on the official valuation.'
        : `Indicative estimate only. Final charges are set by ${dest.country} customs based on the official valuation.`,
    });
  } catch (err) {
    console.error('Clearance estimate:', err.message);
    res.status(500).json({ message: 'Failed to compute estimate' });
  }
});

export default router;
