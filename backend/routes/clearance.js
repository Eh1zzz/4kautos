import express from 'express';
import { getRate } from './fx.js';
import { resolveDestination, DESTINATIONS } from '../utils/locale.js';
import { governmentCharges, quoteAgents, customsNotes, customsDisclaimer, AGENTS, round2 } from '../utils/customs.js';

const router = express.Router();

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
      const { lineItems, ...gov } = governmentCharges(cifUsd);
      government = { ...gov, lineItems, totalNgn: round2(gov.total * usdToNgn), estimate: false };
      agents = quoteAgents(cifUsd, gov.total, usdToNgn);
    } else {
      // Labeled estimate for non-Nigeria destinations (single effective rate).
      const total = round2((cifUsd * dest.effectiveDutyPct) / 100);
      government = { total, totalNgn: round2(total * usdToNgn), effectiveDutyPct: dest.effectiveDutyPct, estimate: true };
    }

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
      notes: customsNotes(req.body.year, dest),
      disclaimer: customsDisclaimer(dest.country),
    });
  } catch (err) {
    console.error('Clearance estimate:', err.message);
    res.status(500).json({ message: 'Failed to compute estimate' });
  }
});

export default router;
