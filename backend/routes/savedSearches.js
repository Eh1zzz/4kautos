import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { create, findByUser, deleteByIdAndUser, countByUser } from '../models/SavedSearch.js';

const router = express.Router();
const MAX_PER_USER = 50;

// GET /saved-searches — the current user's saved searches
router.get('/', authenticate, async (req, res) => {
  try { res.json(await findByUser(req.user.id)); }
  catch (err) { console.error('GET /saved-searches:', err.message); res.status(500).json({ message: 'Failed to load saved searches' }); }
});

// POST /saved-searches { label, filters } — save the current search
router.post('/', authenticate, async (req, res) => {
  try {
    const label = typeof req.body.label === 'string' ? req.body.label.trim().slice(0, 160) : '';
    const raw = req.body.filters;
    if (!label) return res.status(400).json({ message: 'A label is required' });
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      return res.status(400).json({ message: 'filters must be an object' });
    if (await countByUser(req.user.id) >= MAX_PER_USER)
      return res.status(409).json({ message: `You can save up to ${MAX_PER_USER} searches` });

    // Keep only safe scalar filter values (the listings page reads these as query params).
    const filters = {};
    for (const [k, v] of Object.entries(raw)) {
      if (['string', 'number'].includes(typeof v) && String(v).length <= 80) filters[k] = String(v);
    }
    const savedSearch = await create(req.user.id, label, filters);
    res.status(201).json({ message: 'Search saved', savedSearch });
  } catch (err) { console.error('POST /saved-searches:', err.message); res.status(500).json({ message: 'Failed to save search' }); }
});

// DELETE /saved-searches/:id — remove one of your own
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const deleted = await deleteByIdAndUser(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ message: 'Saved search not found' });
    res.json({ message: 'Removed' });
  } catch (err) { console.error('DELETE /saved-searches:', err.message); res.status(500).json({ message: 'Failed to delete' }); }
});

export default router;
