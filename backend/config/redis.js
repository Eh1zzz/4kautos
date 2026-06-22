import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

/* ── Shared Redis (optional) ────────────────────────────────────────────────
   Single-instance / $0 mode needs no Redis: rate-limit counters live in process
   memory and Socket.IO broadcasts within the one node. To run MORE THAN ONE
   replica behind a load balancer, two things must become shared state:
     1. rate-limit counters  → rate-limit-redis store (security.js / server.js)
     2. Socket.IO pub/sub     → @socket.io/redis-adapter (realtime.js)
   Both activate automatically when REDIS_URL is set; until then this returns
   null and the in-memory paths are used. Importing ioredis does NOT open a
   connection — only `new Redis()` does — so this is free when unused. */

let client;       // ioredis instance, or null when REDIS_URL is unset
let initialised = false;

/** Lazily create (once) and return the shared Redis client, or null. */
export function getRedis() {
  if (initialised) return client;
  initialised = true;

  const url = process.env.REDIS_URL;
  if (!url) { client = null; return client; }

  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    // Don't let a Redis blip wedge requests forever; degrade instead.
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  client.on('error', (err) => console.warn('[redis]', err.message));
  client.on('connect', () => console.log('🔌 Redis connected (shared rate-limit + socket adapter)'));
  return client;
}

/** True when a REDIS_URL is configured (multi-instance mode). */
export const redisEnabled = () => !!process.env.REDIS_URL;
