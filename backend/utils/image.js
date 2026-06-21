import sharp from 'sharp';

/* Verify the real file type from its magic bytes — never trust the client's
   extension or Content-Type. Only raster photo formats are accepted. */
function sniff(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  return null;
}

export const isImage = buffer => sniff(buffer) !== null;

/* PDF magic bytes (%PDF). Used for document uploads (e.g. inspection reports). */
export const isPdf = b => !!b && b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

/* Decode → auto-orient → strip metadata (EXIF/GPS) → resize → re-encode WebP.
   The re-encode is the security control: a polyglot/malicious payload doesn't
   survive being decoded and rewritten, and we never serve the original bytes.
   (Pure transform — move this into a queue worker unchanged when you scale.) */
export async function optimize(buffer) {
  if (!isImage(buffer)) throw new Error('Unsupported image type');
  return sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/* Re-encode to WebP at several widths for a responsive <img srcset>. Same security
   guarantee as optimize() — every output is a fresh decode → re-encode. */
export async function optimizeSizes(buffer, widths = [400, 800, 1600]) {
  if (!isImage(buffer)) throw new Error('Unsupported image type');
  const oriented = sharp(buffer).rotate();
  return Promise.all(widths.map(async width => ({
    width,
    buffer: await oriented.clone()
      .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),
  })));
}
