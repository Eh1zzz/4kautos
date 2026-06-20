import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/* Object-storage abstraction.
   - Default (no config): writes to local disk (public/uploads) — zero-setup dev.
   - Production: set S3_BUCKET (+ creds + ASSET_BASE_URL) to push to Cloudflare R2,
     AWS S3, or Backblaze B2. The signature below never changes, so the rest of the
     app (uploads route) is identical either way.
   Filenames are content-hashed → an object is immutable and cacheable "forever". */

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const S3_BUCKET  = process.env.S3_BUCKET;
const useS3      = !!S3_BUCKET;

// Public base for returned URLs — your CDN / R2 public (or custom) domain, e.g.
// https://cdn.4kautos.com . Required when using S3/R2 (the API endpoint is not
// publicly readable). Trailing slashes trimmed.
const ASSET_BASE = (process.env.ASSET_BASE_URL || '').replace(/\/+$/, '');

if (!useS3) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} else if (!ASSET_BASE) {
  console.warn('⚠️  S3_BUCKET is set but ASSET_BASE_URL is missing — uploaded image URLs will be broken. Set ASSET_BASE_URL to your R2/CDN public domain.');
}

let _client; // lazy S3 client — only constructed (and SDK imported) when first used
async function s3() {
  if (_client) return _client;
  const { S3Client } = await import('@aws-sdk/client-s3');
  _client = new S3Client({
    region: process.env.S3_REGION || 'auto',        // Cloudflare R2 uses "auto"
    endpoint: process.env.S3_ENDPOINT || undefined,  // R2/B2 endpoint; omit for AWS S3
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function hashKey(buffer, ext = 'webp') {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32) + '.' + ext;
}

// 32-char content-hash base (no extension) — for responsive variants that share
// one base and differ only by a _<width>.webp suffix.
export function hashBase(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32);
}

export async function putObject(key, buffer, contentType = 'image/webp') {
  if (useS3) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await (await s3()).send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    return `${ASSET_BASE}/${key}`; // served by the CDN/R2 public domain
  }
  await fs.promises.writeFile(path.join(UPLOAD_DIR, key), buffer);
  return `/uploads/${key}`; // served by express.static (put a CDN in front in prod)
}
