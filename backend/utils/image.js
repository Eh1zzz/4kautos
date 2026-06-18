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
