/**
 * One-time backfill — regenerate responsive image variants for EXISTING uploads.
 *
 * Why this exists
 *   Photos uploaded before the responsive-images feature are a single full-size
 *   .webp with no _400/_800/_1600 siblings. The frontend's window.imgSrcset()
 *   keys on a `_1600.webp` URL to build a srcset, so those legacy photos get no
 *   srcset and phones download the full-size image (the "oversized Camaro on
 *   mobile" symptom). This script finds those legacy URLs, generates the
 *   400/800/1600 variants into the SAME object store the app serves from, and
 *   repoints each car's `photos` entry at the new `_1600.webp` URL.
 *
 * Safe by design
 *   • Idempotent — URLs already ending in _400/_800/_1600.webp are skipped, so
 *     re-running does nothing new.
 *   • Non-destructive — legacy objects are left in place (immutable + cached);
 *     we only ADD variants and update the DB pointer.
 *   • Dry-run by default — writes nothing until you pass --apply.
 *
 * Run mode mirrors backend/utils/storage.js
 *   • S3/R2 mode (S3_BUCKET set): processes absolute store URLs, reads each
 *     image's bytes over HTTP from its public URL, writes the variants back to
 *     R2. ASSET_BASE_URL MUST be set (new URLs are built from it). This is the
 *     production run — execute it with the prod env so it updates the prod DB:
 *         railway run npm run backfill:images          # dry run (reports only)
 *         railway run npm run backfill:images -- --apply
 *   • Local mode (no S3_BUCKET): processes /uploads/* URLs, reads them from
 *     public/uploads on disk, writes the variants back there.
 *
 * Usage
 *   npm run backfill:images              # DRY RUN — reports what it would do
 *   npm run backfill:images -- --apply   # generate variants + update the DB
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from '../config/db.js';
import { isImage, optimizeSizes } from '../utils/image.js';
import { hashBase, putObject } from '../utils/storage.js';

const APPLY      = process.argv.includes('--apply') || process.env.APPLY === '1';
const useS3      = !!process.env.S3_BUCKET;
const ASSET_BASE = (process.env.ASSET_BASE_URL || '').replace(/\/+$/, '');

const VARIANT_RE = /_(?:400|800|1600)\.webp$/i;          // already responsive
const isAbsolute = u => /^https?:\/\//i.test(u);

// A URL we own and can rewrite — scoped to whichever store this run is wired to,
// so we never touch external seed/placeholder images by mistake.
function isOurStoreUrl(u) {
  if (useS3) {
    if (!isAbsolute(u)) return false;                    // /uploads/* isn't on disk in prod
    return (ASSET_BASE && u.startsWith(ASSET_BASE)) || /\.r2\.dev\//i.test(u);
  }
  return !isAbsolute(u) && /\/uploads\//.test(u);        // local static only
}

async function readBytes(url) {
  if (isAbsolute(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const rel = url.replace(/^\/+/, '');
  return fs.promises.readFile(path.join(process.cwd(), 'public', rel));
}

// Legacy URL -> new _1600.webp URL (writing 400/800/1600 to the store).
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

async function main() {
  console.log(`\n4kautos · responsive-image backfill  [${APPLY ? 'APPLY' : 'DRY RUN'}]`);
  console.log(`store: ${useS3 ? `S3/R2 (bucket ${process.env.S3_BUCKET})` : 'local public/uploads'}\n`);
  if (useS3 && !ASSET_BASE) {
    console.error('✖ S3_BUCKET is set but ASSET_BASE_URL is missing — new URLs would be broken. Aborting.');
    await pool.end(); process.exit(1);
  }

  const [cars] = await pool.query('SELECT id, photos FROM cars ORDER BY id');
  let carsChanged = 0, converted = 0, alreadyOk = 0, skipped = 0, failed = 0;

  for (const car of cars) {
    let photos = car.photos;
    if (typeof photos === 'string') { try { photos = JSON.parse(photos); } catch { photos = []; } }
    if (!Array.isArray(photos) || !photos.length) continue;

    let changed = false;
    const next = [];
    for (const url of photos) {
      if (typeof url !== 'string' || !url) { next.push(url); continue; }
      if (VARIANT_RE.test(url))   { alreadyOk++; next.push(url); continue; }
      if (!isOurStoreUrl(url))    { skipped++;   next.push(url); continue; }
      try {
        if (APPLY) {
          const newUrl = await convert(url);
          next.push(newUrl); converted++; changed = true;
          console.log(`  car ${car.id}: ${url}\n            ->  ${newUrl}`);
        } else {
          await readBytes(url);                 // verify reachability, write nothing
          next.push(url); converted++; changed = true;
          console.log(`  car ${car.id}: would convert  ${url}`);
        }
      } catch (e) {
        failed++; next.push(url);
        console.warn(`  car ${car.id}: SKIP  ${url}   (${e.message})`);
      }
    }

    if (changed) {
      if (APPLY) await pool.query('UPDATE cars SET photos = ? WHERE id = ?', [JSON.stringify(next), car.id]);
      carsChanged++;
    }
  }

  console.log(`\nSummary`);
  console.log(`  cars scanned         ${cars.length}`);
  console.log(`  cars ${APPLY ? 'updated  ' : 'to update'}         ${carsChanged}`);
  console.log(`  photos ${APPLY ? 'converted' : 'to convert'}     ${converted}`);
  console.log(`  already responsive   ${alreadyOk}`);
  console.log(`  external (skipped)   ${skipped}`);
  console.log(`  failed/unreadable    ${failed}`);
  if (!APPLY) console.log(`\nDry run — nothing written. Re-run with --apply to commit.`);
  console.log('');

  await pool.end();
}

main().catch(async e => { console.error(e); try { await pool.end(); } catch {} process.exit(1); });
