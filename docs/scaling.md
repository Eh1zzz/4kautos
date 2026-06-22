# High-traffic, concurrency & scalability strategy

How 4kautos sustains spikes (vehicle launches, auction windows) without falling
over, layer by layer. Each section marks what **exists today** vs **recommended
next**, so it doubles as a runbook. The guiding principle: **keep the app tier
stateless and push work outward** (to the CDN, to queues, to the DB's strengths).

## 1. Frontend / statics — serve most traffic without touching the app

**Today**
- Vanilla HTML/CSS/JS served by Express `express.static`; a Next.js app in
  `web/` SSRs listings + detail.
- Images live on **Cloudflare R2** (`pub-*.r2.dev`), which is CDN-backed, and
  uploads are **content-hashed + immutable** (`Cache-Control: max-age=31536000,
  immutable`) — so an image is fetched once and cached forever at the edge.
- **Responsive variants** (`_400/_800/_1600.webp`) mean phones download small
  files. `frontend/_headers` sets cache headers.

**Next**
- Put **Cloudflare (free tier) in front of the app domain** so HTML/CSS/JS are
  edge-cached globally and most reads never reach Railway.
- Version/fingerprint CSS/JS filenames (or rely on deploy-busting) so they can
  also be `immutable`-cached.
- Cache `GET /cars` and listing pages at the edge with a **short TTL (30–60s)** —
  during a launch, thousands of identical "browse" requests collapse into one
  origin hit per minute.

## 2. Application layer — stateless, horizontally scalable

**Today**
- Node/Express; **auth is JWT** → no server session state, so the app is already
  horizontally scalable in principle.
- `/health` endpoint + graceful SIGTERM/SIGINT shutdown → safe rolling deploys /
  load-balancer health checks.

**Done — multi-instance is now a config flip**
- Set **`REDIS_URL`** and the app is ready for **N replicas behind a load
  balancer** — both shared-state concerns activate automatically:
  1. **Rate limiter** → `rate-limit-redis` store (global + auth + write + chat +
     contact limiters), so limits are global across replicas instead of each
     node granting the full quota. Unset = in-memory (single node).
  2. **Socket.IO** → `@socket.io/redis-adapter`, so a chat message emitted on one
     replica reaches sockets on any replica (no sticky-session requirement).
  Importing the Redis libs opens no connection until `REDIS_URL` is set, so this
  is free in single-node / $0 mode.

**Next**
- In-memory caches (FX rate, price benchmarks) are per-instance — harmless (each
  refreshes its own); move to Redis only if you want a single source of truth.
- **Task queues (BullMQ + Redis)** for anything slow or spiky, so request
  latency stays bounded:
  - **Image optimization** (`sharp` in `POST /uploads`) is still synchronous in
    the request — the top candidate to move to a worker.
  - **Email sends** and **payout reconciliation** → queue + retry with backoff.
  - *Already detached*: the **admin image backfill** (`POST
    /admin/backfill-images?async=1`) runs as an in-process background job with a
    `…/status` poll endpoint, so reprocessing a large library never ties up the
    request. A Redis-backed queue is the multi-instance upgrade.
- Autoscale on CPU/RAM or queue depth; pre-warm replicas ahead of a known launch.

## 3. Database layer — pooling, indexes, concurrency

**Today**
- `mysql2` **connection pool** (default limit ~10) over Railway MySQL.
- **Indexes on the hot columns**: `cars(created_at, body_type, price, mileage,
  condition)`, `messages(car_id, buyer_id)`, `transactions(payment_ref)`.
- Pagination is **capped** (`LIMIT`/`OFFSET`, page size ≤ 100).
- **Concurrent writes are guarded**: escrow updates use optimistic, idempotent
  `UPDATE … WHERE status IN (…)`; webhooks re-verify + are idempotent; `users.email`
  is `UNIQUE`; duplicate transactions are de-duped (`findExisting`).

**Done**
- **Tunable pool**: `DATABASE_URL` is parsed into a config object so
  `connectionLimit` is set via `DB_POOL_SIZE` (default 10) — keep
  `replicas × connectionLimit` under MySQL `max_connections` (a common outage
  cause under load). `enableKeepAlive` stops PaaS proxies handing back dead idle
  sockets; opt-in TLS via `DB_SSL`.
- **Indexed free-text search**: a `FULLTEXT` index on
  `cars(make, model, title, description)` backs `MATCH..AGAINST` (BOOLEAN-mode,
  prefix-expanded) instead of an un-indexable `LIKE '%q%'` scan. Auto-used when
  every query word is ≥ 3 chars; falls back to `LIKE` for short model tokens
  ("M3") and if the index can't be built. `SEARCH_MODE` forces `like`/`fulltext`.

**Next**
- For very large catalogues, move free-text to an external engine
  (Meilisearch/Elasticsearch) for typo-tolerance + faceting; the structured
  filters already hit B-tree indexes.
- **Deep pagination**: `OFFSET` degrades on large offsets → switch to **keyset /
  seek pagination** (`WHERE created_at < ?`) for endless scroll.
- **Read replicas** for the read-heavy listing/browse traffic; route writes to
  primary. Pairs well with the short-TTL edge cache above.
- **Money operations**: wrap multi-step settlement in a DB **transaction** (and
  `SELECT … FOR UPDATE` where needed) as volume grows, on top of the existing
  state-guarded updates.

## Spike playbook (auction / launch window)
1. Pre-scale replicas + DB connections ahead of the window.
2. Edge-cache the catalogue (short TTL) so browse traffic is absorbed by
   Cloudflare, not the DB.
3. Shed load gracefully: rate-limit at the edge; queue writes (uploads, emails)
   instead of doing them inline.
4. Watch queue depth + DB connections as the lead indicators; autoscale on them.
5. Degrade gracefully — if the DB is hot, serve last-cached inventory rather than
   erroring.

## Cheap wins already in place
Responsive images · content-hashed immutable assets · DB indexes on hot columns ·
`/health` + graceful shutdown · per-route rate limiting · capped pagination ·
idempotent, state-guarded escrow writes. The highest-leverage *next* steps are
**Cloudflare in front of the app** and **moving image-optimize + email to a
queue** — both modest effort, both remove the biggest spike risks.
