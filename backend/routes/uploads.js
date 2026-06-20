import express from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/security.js';
import { isImage, optimizeSizes } from '../utils/image.js';
import { hashBase, putObject } from '../utils/storage.js';

const router = express.Router();

// In-memory so we can sniff + re-encode before anything touches storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
});

// POST /uploads — sellers upload photos; returns optimized, CDN-ready URLs.
router.post('/', writeLimiter, authenticate, authorize('seller'), upload.array('photos', 10), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded' });
    const urls = [];
    for (const f of req.files) {
      if (!isImage(f.buffer))
        return res.status(415).json({ message: 'Only JPEG, PNG or WebP images are allowed' });
      // Responsive variants (400/800/1600w) sharing one content-hash base, so the
      // frontend can derive a srcset from the returned _1600 URL.
      const base = hashBase(f.buffer);
      const sizes = await optimizeSizes(f.buffer);
      let mainUrl = '';
      for (const { width, buffer } of sizes) {
        const url = await putObject(`${base}_${width}.webp`, buffer);
        if (width === 1600) mainUrl = url;
      }
      urls.push(mainUrl);
    }
    res.status(201).json({ urls });
  } catch (err) {
    console.error('upload:', err.message);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// Translate multer's limit errors into clean client responses.
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be under 20MB'
              : err.code === 'LIMIT_FILE_COUNT' ? 'Too many files (max 10)'
              : 'Upload error';
    return res.status(413).json({ message: msg });
  }
  next(err);
});

export default router;
