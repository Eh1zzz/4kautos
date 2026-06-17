import express from 'express';
import { normalizeVIN } from '../utils/validation.js';

const router = express.Router();
const VPIC = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues';

const titleCase = s => (s ? String(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '');

function mapBody(bodyClass) {
  const s = (bodyClass || '').toLowerCase();
  if (/suv|sport utility|mpv|multi-?purpose/.test(s)) return 'SUV';
  if (/sedan|saloon/.test(s)) return 'Sedan';
  if (/hatchback/.test(s)) return 'Hatchback';
  if (/coupe/.test(s)) return 'Coupe';
  if (/pickup|truck/.test(s)) return 'Pickup';
  if (/convertible|cabriolet|roadster/.test(s)) return 'Convertible';
  if (/minivan/.test(s)) return 'Minivan';
  if (/wagon|estate/.test(s)) return 'Wagon';
  if (/crossover/.test(s)) return 'Crossover';
  if (/\bvan\b/.test(s)) return 'Van';
  return '';
}

// GET /vin?vin=... — decode a VIN via the free NHTSA vPIC database (no key).
router.get('/', async (req, res) => {
  const vin = normalizeVIN(req.query.vin);
  if (!vin) return res.status(400).json({ message: 'A valid 17-character VIN is required' });
  try {
    const r = await fetch(`${VPIC}/${vin}?format=json`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(502).json({ message: 'VIN service unavailable' });
    const data = await r.json();
    const v = data.Results?.[0] || {};
    res.json({
      vin,
      make:  titleCase(v.Make),
      model: v.Model || '',
      year:  v.ModelYear ? parseInt(v.ModelYear, 10) : null,
      bodyType: mapBody(v.BodyClass),
      bodyClass: v.BodyClass || '',
      engine: [v.EngineCylinders && `${v.EngineCylinders}-cyl`, v.DisplacementL && `${v.DisplacementL}L`].filter(Boolean).join(' '),
      plant:  [v.PlantCity, v.PlantCountry].filter(Boolean).map(titleCase).join(', '),
    });
  } catch (err) {
    console.error('VIN decode:', err.message);
    res.status(502).json({ message: 'VIN lookup failed' });
  }
});

export default router;
