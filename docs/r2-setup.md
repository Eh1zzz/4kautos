# Cloudflare R2 — photo storage setup

Car photos uploaded by sellers must live in **object storage**, not on Railway's
local disk. Railway's filesystem is **ephemeral**: it's wiped on every redeploy
(every `git push`), so any locally-stored upload disappears on the next deploy.

The code is already done. `backend/utils/storage.js` is env-gated:

- **No `S3_BUCKET`** → writes to local disk (`public/uploads`) — fine for dev.
- **`S3_BUCKET` set** → pushes to Cloudflare R2 (or any S3-compatible store) and
  returns public CDN URLs.

So enabling R2 is **0 lines of code** — just create the bucket and set 5 env vars
on Railway. Nothing else in the app changes.

---

## 1. Create the bucket

1. Cloudflare dashboard → **R2 Object Storage** (left sidebar).
2. First time only: enable R2 / "Purchase R2 plan" — this is where a **card** is
   required (R2 has a generous free tier: 10 GB storage + **free egress**, but
   Cloudflare needs a card on file).
3. **Create bucket** → name it `4kautos-photos` (lowercase, hyphens ok) →
   Location: **Automatic** → Create.

## 2. Make objects publicly readable

R2 buckets are private by default. For now use the managed dev subdomain:

1. Open the bucket → **Settings** → **Public access** / **Public Development URL**.
2. **Enable** it → confirm **Allow Access**.
3. Copy the URL it gives you — looks like `https://pub-<hash>.r2.dev`.
   **This is your `ASSET_BASE_URL`.**

> ⚠️ `r2.dev` is rate-limited and meant for dev/testing. It's perfect to launch
> with. On "domain day" swap it for a custom domain (e.g. `cdn.4kautos.com`) —
> just change `ASSET_BASE_URL`, no code change.

## 3. Create S3 API credentials

1. R2 overview → **Manage R2 API Tokens** (top-right) → **Create API token**.
2. Name: `4kautos-railway`.
3. Permissions: **Object Read & Write**.
4. Scope: **Apply to specific buckets only** → select `4kautos-photos`
   (least privilege).
5. **Create**. It shows, **once**:
   - **Access Key ID**
   - **Secret Access Key**  ← copy now, it's never shown again
   - **S3 API endpoint** → `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
     (this is your `S3_ENDPOINT`).

## 4. Set the env vars on Railway

Backend service → **Variables** → add these five:

```
S3_BUCKET=4kautos-photos
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=<access key id from step 3>
S3_SECRET_ACCESS_KEY=<secret access key from step 3>
ASSET_BASE_URL=https://pub-<hash>.r2.dev
```

- **Don't** set `S3_REGION` — the driver defaults to `auto` (correct for R2).
- **Don't** set `S3_FORCE_PATH_STYLE` — the default works with R2.

Railway redeploys automatically when you save variables.

## 5. Test it

1. After the redeploy, log in as a **seller** and upload a photo to a listing.
2. The image URL should now be `https://pub-<hash>.r2.dev/<sha>.webp`
   (not `/uploads/...`).
3. **Push any commit to redeploy**, then reload — the photo should **still load**.
   That persistence across redeploys is the whole point.

---

## Notes

- **No CORS config needed.** Uploads go server-side (the Node backend talks to R2
  with the API token), and `<img>` tags don't require CORS to display. The browser
  never talks to R2 directly.
- **Existing local uploads don't migrate** — only new uploads land in R2. For a
  fresh marketplace that's fine.
- **Custom domain later:** point a Cloudflare custom domain at the bucket and set
  `ASSET_BASE_URL` to it. Same code.
