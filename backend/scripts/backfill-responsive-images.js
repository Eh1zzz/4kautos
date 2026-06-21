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
 *
 * The actual work lives in backend/utils/backfillImages.js (shared with the
 * admin endpoint POST /admin/backfill-images); this is just the CLI wrapper.
 */
import 'dotenv/config';
import { pool } from '../config/db.js';
import { runBackfill } from '../utils/backfillImages.js';

const APPLY = process.argv.includes('--apply') || process.env.APPLY === '1';

(async () => {
  console.log(`\n4kautos · responsive-image backfill  [${APPLY ? 'APPLY' : 'DRY RUN'}]\n`);
  try {
    const s = await runBackfill({
      apply: APPLY,
      onItem: ({ carId, url, newUrl, error }) =>
        error      ? console.warn(`  car ${carId}: SKIP  ${url}   (${error})`)
        : newUrl   ? console.log(`  car ${carId}: ${url}\n            ->  ${newUrl}`)
                   : console.log(`  car ${carId}: would convert  ${url}`),
    });
    console.log(`\nSummary  (store: ${s.store})`);
    console.log(`  cars scanned         ${s.scanned}`);
    console.log(`  cars ${APPLY ? 'updated  ' : 'to update'}         ${s.carsChanged}`);
    console.log(`  photos ${APPLY ? 'converted' : 'to convert'}     ${s.converted}`);
    console.log(`  already responsive   ${s.alreadyOk}`);
    console.log(`  external (skipped)   ${s.skipped}`);
    console.log(`  failed/unreadable    ${s.failed}`);
    if (!APPLY) console.log(`\nDry run — nothing written. Re-run with --apply to commit.`);
    console.log('');
    await pool.end();
  } catch (e) {
    console.error('✖', e.message);
    try { await pool.end(); } catch {}
    process.exit(1);
  }
})();
