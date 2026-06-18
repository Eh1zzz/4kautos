import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/* Object storage abstraction. Today it writes to local disk (public/uploads);
   to move to S3/R2/GCS later, swap only the body of putObject() — the signature
   and the rest of the app stay the same. Filenames are content-hashed so the
   same image is stored once and can be cached "forever" (immutable). */
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export function hashKey(buffer, ext = 'webp') {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32) + '.' + ext;
}

export async function putObject(key, buffer) {
  await fs.promises.writeFile(path.join(UPLOAD_DIR, key), buffer);
  return `/uploads/${key}`; // public URL (front a CDN here in production)
}
