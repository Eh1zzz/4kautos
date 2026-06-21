import fs from 'fs';
import path from 'path';
import { pool } from '../config/db.js';
import { isImage, optimizeSizes } from './image.js';
import { hashBase, putObject } from './storage.js';

/* Shared core for the responsive-image backfill — used by both the CLI script
   (backend/scripts/backfill-responsive-images.js) and the admin endpoint
   (POST /admin/backfill-images). See docs/backfill-images.md for the why.

   Regenerates _400/_800/_1600 variants for legacy single-size uploads and
   repoints each car's photos at the new _1600.webp. Idempotent + non-destructive
   (already-responsive URLs are skipped; legacy objects are left in place). */

const VARIANT_RE = /_(?:400|800|1600)\.webp$/i;     // already responsive
const isAbsolute = u => /^https?:\/\//i.test(u);

export async function runBackfill({ apply = false, onItem } = {}) {
  const useS3      = !!process.env.S3_BUCKET;
  const ASSET_BASE = (process.env.ASSET_BASE_URL || '').replace(/\/+$/, '');
  if (useS3 && !ASSET_BASE) throw new Error('S3_BUCKET is set but ASSET_BASE_URL is missing — new URLs would be broken.');

  // A URL we own and can rewrite — strictly under our own asset domain (or the
  // local /uploads path). Scoping to ASSET_BASE only (not any *.r2.dev host)
  // prevents a seller-pasted URL from steering this server-side fetch (SSRF).
  const isOurStoreUrl = u => useS3
    ? (isAbsolute(u) && !!ASSET_BASE && u.startsWith(ASSET_BASE))
    : (!isAbsolute(u) && /\/uploads\//.test(u));

  async function readBytes(url) {
    if (isAbsolute(url)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    }
    return fs.promises.readFile(path.join(process.cwd(), 'public', url.replace(/^\/+/, '')));
  }

  async function convert(url) {
    const bytes = await readBytes(url);
    if (!isImage(bytes)) throw new Error('not a recognised image');
    const base  = hashBase(bytes);
    const sizes = await optimizeSizes(bytes);
    let main = '';
    for (const { width, buffer } of sizes) {
      const u = await putObject(`${base}_${width}.webp`, buffer);
      if (width === 1600) main = u;
    }
    return main;
  }

  const [cars] = await pool.query('SELECT id, photos FROM cars ORDER BY id');
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    store: useS3 ? `r2:${process.env.S3_BUCKET}` : 'local',
    scanned: cars.length, carsChanged: 0, converted: 0, alreadyOk: 0, skipped: 0, failed: 0,
  };

  for (const car of cars) {
    let photos = car.photos;
    if (typeof photos === 'string') { try { photos = JSON.parse(photos); } catch { photos = []; } }
    if (!Array.isArray(photos) || !photos.length) continue;

    let changed = false;
    const next = [];
    for (const url of photos) {
      if (typeof url !== 'string' || !url) { next.push(url); continue; }
      if (VARIANT_RE.test(url))   { summary.alreadyOk++; next.push(url); continue; }
      if (!isOurStoreUrl(url))    { summary.skipped++;   next.push(url); continue; }
      try {
        if (apply) {
          const newUrl = await convert(url);
          next.push(newUrl); onItem?.({ carId: car.id, url, newUrl });
        } else {
          await readBytes(url);            // verify reachability, write nothing
          next.push(url); onItem?.({ carId: car.id, url });
        }
        summary.converted++; changed = true;
      } catch (e) {
        summary.failed++; next.push(url);
        onItem?.({ carId: car.id, url, error: e.message });
      }
    }
    if (changed) {
      if (apply) await pool.query('UPDATE cars SET photos = ? WHERE id = ?', [JSON.stringify(next), car.id]);
      summary.carsChanged++;
    }
  }
  return summary;
}
