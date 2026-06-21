# Backfill: responsive image variants for old uploads

Photos uploaded **before** the responsive-images feature are a single full-size
`.webp` with no `_400` / `_800` / `_1600` siblings. The frontend
(`window.imgSrcset`) keys on a `_1600.webp` URL to build a `srcset`, so those
legacy photos get no `srcset` and phones download the full-size image (the
"oversized Camaro on mobile" symptom).

`backend/scripts/backfill-responsive-images.js` fixes them once: it finds the
legacy URLs, generates the 400/800/1600 variants into the **same store the app
serves from**, and repoints each car's `photos` entry at the new `_1600.webp`
URL.

It is **idempotent** (already-converted URLs are skipped), **non-destructive**
(legacy objects stay; we only add variants + update the DB pointer), and
**dry-run by default** (writes nothing until `--apply`).

## Run it against production (R2 + Railway DB)

### Easiest: the admin dashboard button (no CLI)

Because it must run with the live R2 + DB env, the simplest way is to trigger it
**from inside the deployed app**:

1. Sign in as an admin → **Dashboard → Admin → Maintenance**.
2. Click **Preview changes** (dry run — writes nothing) to see how many photos
   would convert.
3. Click **Regenerate now** to generate the variants in R2 and repoint the DB.

This calls `POST /admin/backfill-images` (`?apply=1` to write), which runs the
exact same `runBackfill()` core as the CLI. Best for the usual handful of legacy
uploads; for a very large library prefer the CLI so it isn't bound by the HTTP
request lifetime.

### Alternative: the CLI (Railway env)

The variants must land in the same R2 bucket the site serves, and the **prod**
DB pointers must be updated — so run it with the Railway environment:

```bash
# 1) Dry run — reports what it would convert, writes nothing
railway run npm run backfill:images

# 2) Commit — generate variants in R2 + update the prod DB
railway run npm run backfill:images -- --apply
```

Requires `S3_BUCKET`, the R2 credentials, and `ASSET_BASE_URL` in the env (all
already set on Railway). The script aborts if `S3_BUCKET` is set without
`ASSET_BASE_URL` (new URLs would be broken).

## Local mode

With no `S3_BUCKET` set it runs in local mode: it only touches `/uploads/*`
URLs, reads them from `public/uploads`, and writes the variants back there.
External/seed/placeholder URLs are always skipped in both modes.

## After it runs

Hard-refresh a previously-affected listing on a phone (or DevTools device mode).
The `<img>` should now carry a `srcset` and the browser should fetch the
`_400`/`_800` variant instead of the full-size original.
