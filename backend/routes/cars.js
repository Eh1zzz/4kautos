import express from 'express';
import { findAll, findById, findSimilar, create, update, deleteById, deleteByIdAndSeller, priceBenchmarks } from '../models/Car.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/security.js';
import { validateCarInput } from '../utils/validation.js';
import { getRate } from './fx.js';
import { usdOf, priceVerdict } from '../utils/valuation.js';
import { governmentCharges, customsNotes, customsDisclaimer, round2 } from '../utils/customs.js';
import { resolveDestination, destinationCountry } from '../utils/locale.js';

const router = express.Router();

// GET /cars — search/filter/sort/paginate. Body stays an array (back-compat);
// the total is returned via headers for the pagination UI.
router.get('/', async (req, res) => {
  try {
    // The FX rate is needed for USD budget/sort AND the price-valuation badge, so
    // fetch it (cached) for every listing query.
    const rate = (await getRate()).usdToNgn;
    const { cars, total, limit } = await findAll({ ...req.query, rate });

    // Attach a "Good price" verdict per card from one grouped-average query. The
    // average excludes the car itself and needs >= 3 other comparables.
    try {
      const bench = await priceBenchmarks(rate);
      for (const c of cars) {
        const carUsd = usdOf(c.price, c.currency, rate);
        const b = bench.get(`${c.make} ${c.model}`);
        c.valuation = (b && b.n >= 4 && carUsd != null)
          ? priceVerdict(carUsd, (b.avgUsd * b.n - carUsd) / (b.n - 1), b.n - 1)
          : { verdict: null };
      }
    } catch (e) { console.error('valuation attach:', e.message); }

    res.set('X-Total-Count', String(Number(total)));
    res.set('X-Total-Pages', String(Math.max(1, Math.ceil(Number(total) / limit))));
    res.json(cars);
  } catch (err) {
    console.error('GET /cars:', err.message);
    res.status(500).json({ message: 'Failed to fetch cars' });
  }
});

// GET /cars/:id — details
router.get('/:id', async (req, res) => {
  try {
    const car = await findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    res.json(car);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch car' });
  }
});

// GET /cars/:id/similar — comparable listings (same make+model, then body type)
router.get('/:id/similar', async (req, res) => {
  try {
    const car = await findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 4, 1), 12);
    const similar = await findSimilar(car, limit);
    res.json(similar);
  } catch (err) {
    console.error('GET /cars/:id/similar:', err.message);
    res.status(500).json({ message: 'Failed to fetch similar cars' });
  }
});

// GET /cars/:id/valuation — "Good price" verdict vs comparable listings (detail page)
router.get('/:id/valuation', async (req, res) => {
  try {
    const car = await findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });
    const rate = (await getRate()).usdToNgn;
    const carUsd = usdOf(car.price, car.currency, rate);
    const similar = await findSimilar(car, 12);
    const comps = similar.map(s => usdOf(s.price, s.currency, rate)).filter(v => v != null);
    const avg = comps.length ? comps.reduce((a, b) => a + b, 0) / comps.length : null;
    res.json(priceVerdict(carUsd, avg, comps.length));
  } catch (err) {
    console.error('GET /cars/:id/valuation:', err.message);
    res.status(500).json({ message: 'Failed to compute valuation' });
  }
});

// GET /cars/:id/customs — full customs fees, duty & percentage for THIS listing.
// Uses the car's own price/currency/year with the live FX rate, so the figures
// stay current without the buyer re-entering a value. ?destination=<locale>
// overrides the import destination (defaults to Nigeria).
router.get('/:id/customs', async (req, res) => {
  try {
    const car = await findById(req.params.id);
    if (!car) return res.status(404).json({ message: 'Car not found' });

    const { usdToNgn, updatedAt, source } = await getRate();
    const cifUsd = usdOf(car.price, car.currency, usdToNgn);
    if (cifUsd == null || cifUsd <= 0)
      return res.json({ available: false, reason: 'This listing has no asking price yet.' });

    const dest = resolveDestination(req.query.destination);

    // Already in the destination country → nothing to import.
    if (destinationCountry(car.location) === dest.country) {
      return res.json({
        available: true, inCountry: true,
        destination: { country: dest.country, currency: dest.currency },
        charges: { lineItems: [], totalUsd: 0, totalNgn: 0, effectivePct: 0, estimate: false },
        notes: [`This vehicle is already in ${dest.country} — no customs duty applies.`],
      });
    }

    let charges;
    if (dest.country === 'Nigeria') {
      const gov = governmentCharges(cifUsd);
      charges = {
        lineItems: gov.lineItems.map(li => ({ ...li, amountNgn: round2(li.amountUsd * usdToNgn) })),
        totalUsd: gov.total,
        totalNgn: round2(gov.total * usdToNgn),
        effectivePct: gov.effectivePct,
        estimate: false,
      };
    } else {
      const totalUsd = round2((cifUsd * dest.effectiveDutyPct) / 100);
      charges = {
        lineItems: [{
          key: 'effective', label: `Effective import charges (${dest.country})`,
          ratePct: dest.effectiveDutyPct, basis: 'CIF value',
          amountUsd: totalUsd, amountNgn: round2(totalUsd * usdToNgn),
        }],
        totalUsd, totalNgn: round2(totalUsd * usdToNgn),
        effectivePct: dest.effectiveDutyPct,
        estimate: true,
      };
    }

    res.json({
      available: true,
      inCountry: false,
      carId: car.id,
      fx: { usdToNgn, updatedAt, source },
      input: { cifValueUsd: round2(cifUsd), cifValueNgn: round2(cifUsd * usdToNgn) },
      destination: {
        country: dest.country, port: dest.port, currency: dest.currency,
        effectiveDutyPct: dest.effectiveDutyPct, estimate: dest.estimate,
      },
      charges,
      notes: customsNotes(car.year, dest),
      disclaimer: customsDisclaimer(dest.country),
    });
  } catch (err) {
    console.error('GET /cars/:id/customs:', err.message);
    res.status(500).json({ message: 'Failed to compute customs charges' });
  }
});

// POST /cars — create listing (sellers only)
router.post('/', writeLimiter, authenticate, authorize('seller'), async (req, res) => {
  try {
    const { errors, value } = validateCarInput(req.body);
    if (errors.length)
      return res.status(400).json({ message: errors[0], errors });

    const car = await create({ ...value, sellerId: req.user.id });
    res.status(201).json({ message: 'Car added successfully', car });
  } catch (err) {
    console.error('POST /cars:', err.message);
    res.status(500).json({ message: 'Failed to add car' });
  }
});

// PUT /cars/:id — update a listing (the owning seller, or an admin)
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'seller' && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Forbidden' });

    const existing = await findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Car not found' });
    if (req.user.role !== 'admin' && Number(existing.seller_id) !== Number(req.user.id))
      return res.status(403).json({ message: 'You can only edit your own listings' });

    const { errors, value } = validateCarInput(req.body);
    if (errors.length)
      return res.status(400).json({ message: errors[0], errors });

    const car = await update(req.params.id, value);
    res.json({ message: 'Listing updated successfully', car });
  } catch (err) {
    console.error('PUT /cars/:id:', err.message);
    res.status(500).json({ message: 'Failed to update car' });
  }
});

// DELETE /cars/:id — admin deletes any car; seller deletes their own
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    let deleted;

    if (role === 'admin') {
      deleted = await deleteById(req.params.id);
    } else if (role === 'seller') {
      deleted = await deleteByIdAndSeller(req.params.id, userId);
    } else {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (!deleted) return res.status(404).json({ message: 'Car not found' });
    res.json({ message: 'Car deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete car' });
  }
});

export default router;
