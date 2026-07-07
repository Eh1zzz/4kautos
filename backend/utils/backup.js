import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pool } from '../config/db.js';

/* ── Database backups ────────────────────────────────────────
   Pure-Node logical dump (the deploy image has no mysqldump binary):
   SHOW CREATE TABLE + batched INSERTs for every table, gzipped, then stored
   via the same R2/S3 config the image uploads use (falls back to a local
   ./backups directory when S3 isn't configured, e.g. in dev).

   The R2 bucket has a PUBLIC dev domain (images are served from it), so
   backup keys carry a random 24-hex suffix — like the content-hashed image
   names, the object is unguessable and the bucket does not allow listing.

   Retention: the newest BACKUP_KEEP (default 14) are kept, older ones pruned. */

const S3_BUCKET   = process.env.S3_BUCKET;
const KEEP        = Math.max(1, Number(process.env.BACKUP_KEEP) || 14);
const PREFIX      = 'backups/';
const LOCAL_DIR   = path.join(process.cwd(), 'backups');
const BATCH       = 500; // rows per SELECT page / INSERT statement

const sqlValue = v => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (Buffer.isBuffer(v)) return `0x${v.toString('hex')}`;
  if (v instanceof Date) return pool.escape(v);
  if (typeof v === 'object') return pool.escape(JSON.stringify(v)); // JSON columns
  return pool.escape(v);
};

/** Full logical dump of the connected database as a single SQL string. */
export async function dumpDatabase() {
  const [tRows] = await pool.query('SHOW TABLES');
  const tables = tRows.map(r => Object.values(r)[0]);
  const out = [
    `-- 4kautos logical backup · ${new Date().toISOString()}`,
    'SET FOREIGN_KEY_CHECKS=0;',
  ];
  let totalRows = 0;

  for (const table of tables) {
    const [[create]] = await pool.query(`SHOW CREATE TABLE \`${table}\``);
    out.push(`\nDROP TABLE IF EXISTS \`${table}\`;`);
    out.push(create['Create Table'] + ';');

    for (let offset = 0; ; offset += BATCH) {
      const [rows] = await pool.query(`SELECT * FROM \`${table}\` LIMIT ? OFFSET ?`, [BATCH, offset]);
      if (!rows.length) break;
      totalRows += rows.length;
      const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(',');
      const values = rows.map(r => `(${Object.values(r).map(sqlValue).join(',')})`).join(',\n');
      out.push(`INSERT INTO \`${table}\` (${cols}) VALUES\n${values};`);
      if (rows.length < BATCH) break;
    }
  }
  out.push('\nSET FOREIGN_KEY_CHECKS=1;');
  return { sql: out.join('\n'), tables: tables.length, rows: totalRows };
}

let lastRun = null; // status for the admin endpoint

/** Dump → gzip → store (R2/S3 or ./backups locally) → prune old ones. */
export async function runBackup() {
  const started = Date.now();
  try {
    const { sql, tables, rows } = await dumpDatabase();
    const gz = zlib.gzipSync(Buffer.from(sql, 'utf8'));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = `4kautos-${stamp}-${crypto.randomBytes(12).toString('hex')}.sql.gz`;

    if (S3_BUCKET) {
      const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: process.env.S3_REGION || 'auto',
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
      });
      await client.send(new PutObjectCommand({
        Bucket: S3_BUCKET, Key: PREFIX + name, Body: gz,
        ContentType: 'application/gzip', CacheControl: 'private, no-store',
      }));
      // Prune: list the backups prefix, keep the newest KEEP.
      const listed = await client.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: PREFIX }));
      const objs = (listed.Contents || []).sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
      for (const o of objs.slice(KEEP))
        await client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: o.Key })).catch(() => {});
      lastRun = { ok: true, at: new Date().toISOString(), where: 'r2', key: PREFIX + name, bytes: gz.length, tables, rows, ms: Date.now() - started, kept: Math.min(objs.length, KEEP) };
    } else {
      fs.mkdirSync(LOCAL_DIR, { recursive: true });
      fs.writeFileSync(path.join(LOCAL_DIR, name), gz);
      const files = fs.readdirSync(LOCAL_DIR).filter(f => f.endsWith('.sql.gz')).sort().reverse();
      for (const f of files.slice(KEEP)) fs.unlinkSync(path.join(LOCAL_DIR, f));
      lastRun = { ok: true, at: new Date().toISOString(), where: 'local', key: name, bytes: gz.length, tables, rows, ms: Date.now() - started, kept: Math.min(files.length, KEEP) };
    }
    console.log(`💾 backup ok → ${lastRun.where}:${lastRun.key} (${tables} tables, ${rows} rows, ${gz.length} bytes)`);
    return lastRun;
  } catch (err) {
    lastRun = { ok: false, at: new Date().toISOString(), error: err.message, ms: Date.now() - started };
    console.error('backup failed:', err.message);
    return lastRun;
  }
}

export const backupStatus = () => ({
  lastRun,
  keep: KEEP,
  target: S3_BUCKET ? 'r2' : 'local',
  intervalHours: Number(process.env.BACKUP_INTERVAL_HOURS) || 24,
});

/** Daily scheduler (call once from server startup; no-ops on repeat calls). */
let timer = null;
export function scheduleBackups() {
  if (timer) return;
  const hours = Number(process.env.BACKUP_INTERVAL_HOURS) || 24;
  // First run shortly after boot (also snapshots right after every deploy),
  // then on the interval. unref() so shutdown is never held up.
  setTimeout(() => runBackup(), 5 * 60 * 1000).unref();
  timer = setInterval(() => runBackup(), hours * 60 * 60 * 1000);
  timer.unref();
  console.log(`💾 backups scheduled: every ${hours}h → ${S3_BUCKET ? 'R2 (' + PREFIX + '*)' : LOCAL_DIR}`);
}
