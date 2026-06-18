# 4Kautos — Premium Preowned Car Marketplace

A full-stack web application for buying preowned vehicles from **international sellers**, with **customs clearance handled in Nigeria**. Node.js/Express backend, **MySQL** database, and a premium static frontend featuring an AI-powered chatbot, **dual USD/NGN pricing at the live exchange rate**, brand browsing, and a **customs-duty estimator with agent rate comparison**.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js ≥ 18 (ESM) |
| Server | Express 4 |
| Database | MySQL 8 (via `mysql2/promise`) |
| Auth | JWT (7-day tokens) + bcrypt |
| AI Chatbot | Anthropic Claude (`claude-haiku-4-5-20251001`) |
| Frontend | Vanilla HTML / CSS / JS (no framework) |
| Tests | Jest + Supertest |

---

## Recent Changes

### v2.8 — Production deploy-readiness (Phase 1)
- **Portable, PaaS-ready backend** — `trust proxy` (env `TRUST_PROXY`) so the rate-limiter sees real client IPs behind Cloudflare/Railway; **graceful SIGTERM/SIGINT shutdown** (drain server + close DB pool); root `/health` for platform healthchecks.
- **`/v1` API versioning** — all routes mounted under `/v1` with legacy unversioned aliases kept for back-compat; unmatched API paths return JSON 404 (not the SPA HTML). Frontend `api.js` now calls `/v1` (uploads stay unversioned).
- **Pluggable storage** — `utils/storage.js` gained an env-gated **Cloudflare R2 / S3** driver (AWS SDK v3) returning CDN URLs; falls back to local disk when unconfigured. Same `putObject` signature.
- **Pluggable email** — `utils/email.js` gained a **Resend** path (HTTP API, no SDK) ahead of the Gmail SMTP fallback.
- **Deploy config** — `railway.json`, `Procfile`, `.nvmrc`, `frontend/_headers`, and a fully documented `.env.example`. See **Deployment** below. *(45 tests green; back-compat verified.)*

### v2.7 — AutoBot knows the car you're looking at
- **Listing-aware assistant** — "Ask AutoBot about this car" now opens the chat and asks in one click, and AutoBot replies about *that exact listing*. The detail page sends only the car's **id**; the server loads the **authoritative record from the DB** (never trusts client-supplied car data) and builds the context, so a buyer can't spoof a car.
- **Two-part answer** — the model is instructed to (1) summarise **this** listing from real details (price in ₦/$, year, mileage, condition, location, verified seller) without inventing specifics that aren't listed, then (2) add general **make/model facts** — engine/drivetrain, real-world fuel economy, reliability strengths, common problem areas to inspect, and rough running costs — so the buyer can make an informed decision.
- **Compare to similar listings** — AutoBot now pulls **comparable inventory** (`Car.findSimilar`: same make+model, falling back to body type) and grounds price questions in real data, **USD-normalized** so mixed ₦/$ listings rank fairly: *"Among 4 comparable listings spanning $5,003–$19,500, this one is 74% below the average."* Surfaced via a new "How does the price compare?" quick-reply, and a one-line market note now rides along on the "Tell me about this car" answer.
- **"Similar listings" strip on the detail page** — the same `findSimilar` query now also powers a card strip below each listing (`GET /cars/:id/similar`), reusing the standard car card (thumbnail, dual-currency price, landed cost, save) so buyers can jump straight to comparable cars.
- **Prompt-injection guard** — the seller's free-text note is passed as clearly-delimited *data*, with an instruction to ignore any embedded commands.
- **Works without a key too** — with no `ANTHROPIC_API_KEY`, AutoBot still returns the listing's real details, the market comparison, and a used-car inspection checklist (only the model-specific reliability write-up needs the live API). Set `ANTHROPIC_API_KEY` in `.env` to enable the full general-facts section.
- **Tests** — a new `chatbot` suite covers the details, compare, graceful-degrade and process-question paths, plus the `/cars/:id/similar` route (**45 tests** total).

### v2.6 — Scale: pagination, server-side filtering & map browse
- **Server-side pagination/sort/filter** — `GET /cars` takes `page`/`limit`/`sort` and returns the matching count via `X-Total-Count`/`X-Total-Pages` headers. **Price sorting and budget bands (`minUsd`/`maxUsd`) are normalized to USD** so mixed NGN/USD listings rank fairly. The listings page now has a real **pagination UI** (client-side sort/budget removed).
- **Indexes** — added on the columns we filter/sort (`cars.created_at/body_type/price/mileage/condition`, `messages(car_id,buyer_id)`); admin list queries are bounded (`LIMIT 500`).
- **Browse on a map** — a **Grid / Map** toggle on the listings page plots every located car as a pin (Leaflet) with a popup (photo, price, link).

### v2.5 — Audit hardening + image pipeline
- **Security fixes**: closed an **IDOR** on `GET /transactions/:id` (now buyer/seller/admin only — it exposes emails); removed a client-supplied Anthropic-key header; the global error handler no longer leaks internal 5xx details.
- **Hardened image uploads** (replaces the old unused, unsafe disk-upload endpoint): `POST /uploads` validates the **real file type by magic bytes**, caps at 20 MB, re-encodes with **`sharp` → WebP** (strips EXIF, resizes; the re-encode neutralizes malicious payloads), stores via a `putObject()` abstraction (local now, **S3-swappable**) with **content-hashed** filenames, served `immutable, max-age=1y` (CDN-ready). The seller upload form gained per-slot **Upload** buttons.
- **Tests**: added `transaction`/`messages`/`admin` suites (IDOR + authorization regressions) — **37 tests** total.
- Removed dead code (`middleware/upload.js`, `Car.addPhotos`, the old photos route).

### v2.4 — Marketplace expansion, chat & email
- **Buyer↔seller chat** — a polling message thread per car (slide-over panel on the detail page + a Messages tab on the dashboard, with unread badges, read-on-open, and self-message blocking). `messages` table + `/messages` routes.
- **Automated email (Gmail)** — welcome email on newsletter subscribe + a notification to the recipient on every new chat message, via Gmail SMTP (nodemailer). Set `GMAIL_USER` + `GMAIL_APP_PASSWORD`; absent, email is silently skipped.
- **Home** — Featured now precedes Shop-by-Brand; a subtle car slideshow behind the hero; a **Browse By** (body type / budget / mileage) section that deep-links into listings filters; **Why Us**, **Reviews**, and a promo banner. Brand strip grew to 26 makes.
- **Browse/filter** — new `cars.body_type` column; `GET /cars` gains `type`, `minMileage`, `maxMileage`; budget bands filter by USD client-side.
- **Footer** — rebuilt as a multi-column guide (Buy/Sell/Company/Support + social, app badges, newsletter). New `about.html` + `community.html`.
- **Fix** — the Leaflet map no longer paints over the sticky header.

### v2.3 — Car location maps + landed-cost
- **Location & maps** — each listing carries a location (city/country) + coordinates. The detail page shows an interactive **Leaflet + OpenStreetMap/CARTO** map pin (theme-aware tiles, no API key); the seller upload form geocodes the location (free **OSM Nominatim**) and previews the pin. Cards show a 📍 location chip.
- **"Landed cost to your door"** — every listing shows the all-in cost delivered & cleared in Nigeria (vehicle price + import duty from the clearance engine + a region-based RoRo shipping estimate) in ₦/$, reactive to the currency toggle. In-country cars are flagged as duty-free. Detail page shows the full breakdown with a link to the customs calculator.
- Seed refreshed with international demo inventory (USA/UK/Germany/UAE/Japan + in-country Lagos/Abuja) priced in mixed currencies.

### v2.2 — "Electric Midnight" UI redesign
- **Light + dark themes** — CSS-variable theming (dark default), a nav/mobile toggle that persists to `localStorage` and respects `prefers-color-scheme`, with a no-flash inline init in each page `<head>` and smooth cross-fade.
- **New look** — indigo/violet + cyan palette, glassmorphism surfaces, neon glow, gradient text/buttons; Sora + Plus Jakarta Sans + Space Grotesk type.
- **Motion** — scroll-reveal (IntersectionObserver), animated hero gradient mesh, count-up stats, card hover-lift/glow — all gated behind `prefers-reduced-motion`.
- **Skewed car-outline footer** — a single shared footer (injected by `app.js`) with an angled clip-path top edge, a car-silhouette watermark and a gradient top-glow, replacing the per-page footers.

### v2.1 — Security hardening, FX & customs clearance
- **Security fixes**
  - **Privilege escalation closed** — `/auth/signup` no longer accepts an arbitrary `role`; only `buyer`/`seller` can be self-assigned (never `admin`).
  - **Transactions no longer trust the client** — the seller is derived from the car record, not a `sellerId` in the request body; self-purchase is blocked.
  - **Stored XSS closed** — all seller-supplied fields are HTML-escaped on render (cards, listings, detail specs).
  - **Seller PII** — email is no longer exposed on public car endpoints.
  - Added a stricter **auth rate limiter**, **security headers** (no new deps), email-format validation, and a **JWT_SECRET** strength check at startup.
- **Listing standards** — `POST /cars` now validates make/model, year range, mileage, a real **17-char VIN**, price, condition, and a **minimum of 5 photos**. The seller form is a guided checklist (front/rear/interior/odometer/engine) with live VIN validation and a client-side image-quality (resolution) check.
- **Dual-currency pricing** — listings carry a `currency` (`NGN`/`USD`); every price shows both currencies using a **live USD↔NGN rate** (`GET /fx`, cached server-side). A nav toggle switches the headline currency.
- **Customs clearance** — new `clearance.html` + `GET /clearance/agents` and `POST /clearance/estimate`: estimates Nigerian import duty and compares verified clearing agents, flagging the **best all-in rate**.
- **Shop by brand** — clickable brand-logo strip on the home and listings pages filters by make.
- **Mobile nav fixed** — the hamburger now opens a working drawer (it previously did nothing); injected consistently across all pages.
- **Smart API base** — the frontend calls the **same origin** that served it (backend-served in dev or prod → no CORS). When opened from a separate static dev server (Live Server, `serve`, Vite…) it auto-routes API calls to the backend on `:3000`. Override with `window.API_BASE` for a separately-hosted frontend. This resolves the original cross-origin CORS / "method not allowed" failures.
- Working listings **sort**, persistent **saved/favourites**, Esc-to-close modal/chat, and the footer year auto-updates.

### Database — migrated from MongoDB to MySQL
- Replaced Mongoose/MongoDB with the `mysql2` driver and a connection pool
- Models are now thin, parameterised SQL query modules (no ORM) — every query uses `?` placeholders, so there is no SQL-injection surface
- Schema is auto-created on startup (`connectDB()` runs `CREATE TABLE IF NOT EXISTS …`)
- The app connects as a **dedicated least-privilege user** (`kautos_app`), never as root
- `condition` is a reserved word in MySQL, so it is backticked throughout
- `photos` are stored in a native `JSON` column; seller/buyer/car relations are composed with `JSON_OBJECT(...)`

### Security & bug fixes
- **XSS fixed** — chatbot messages are now HTML-escaped before rendering (`frontend/js/app.js`)
- **Chatbot model ID corrected** — the previous ID was invalid; now uses `claude-haiku-4-5-20251001`
- **Image uploads work** — the upload directory is created on startup and served at `/uploads`
- **Transaction status validated** — invalid values return `400` instead of a generic `500`
- **Duplicate transactions blocked** — a buyer cannot open two active transactions for the same car (`409`)
- **Correct 404s** — deleting/verifying a non-existent record now returns `404` instead of a misleading `200`
- **Sellers can delete their own listings** — `DELETE /cars/:id` allows a seller to remove their own car (admins can remove any)
- **Test isolation fixed** — the Jest script now passes `--experimental-vm-modules` to Node (not Jest) and runs serially (`--runInBand`) against a separate test database

---

## Project Structure

```
4Kautos/
├── package.json
├── .env.example
├── README.md
│
├── backend/
│   ├── server.js              ← Express app entry point
│   ├── seed.js                ← Demo data seeder
│   ├── config/
│   │   └── db.js              ← MySQL pool + schema bootstrap
│   ├── sql/
│   │   └── setup.sql          ← One-time DB + app-user creation (run as root)
│   ├── middleware/
│   │   ├── auth.js            ← JWT authenticate + role authorize
│   │   ├── security.js        ← security headers + auth rate limiter
│   │   └── upload.js          ← Multer image upload (creates ./public/uploads)
│   ├── utils/
│   │   └── validation.js      ← shared validators (VIN, car input, toId, email)
│   ├── models/                ← Parameterised SQL query helpers (no ORM)
│   │   ├── User.js
│   │   ├── Car.js
│   │   └── Transaction.js     ← exports VALID_STATUSES
│   ├── routes/
│   │   ├── auth.js            ← POST /auth/signup, /auth/login (bcrypt)
│   │   ├── cars.js            ← CRUD + photo upload (validated)
│   │   ├── transactions.js    ← initiate, list, update status
│   │   ├── admin.js           ← admin-only management
│   │   ├── chatbot.js         ← POST /chat → AutoBot (Claude)
│   │   ├── fx.js              ← GET /fx → live USD↔NGN rate (cached)
│   │   └── clearance.js       ← agents directory + duty estimate
│   └── tests/
│       ├── setup.js           ← points the app at the test database
│       ├── auth.test.js
│       └── car.test.js
│
└── frontend/
    ├── favicon.svg
    ├── index.html             ← Home: hero, shop-by-brand, featured listings
    ├── listings.html          ← Browse with sidebar filters + working sort
    ├── detail.html            ← Gallery, specs, CTA, clearance estimate, chatbot
    ├── profile.html           ← Dashboard: listings, transactions, guided add-car
    ├── clearance.html         ← Customs duty estimator + agent rate comparison
    ├── css/
    │   └── styles.css         ← Complete design system
    └── js/
        ├── api.js             ← Fetch wrapper: auth, cars, transactions, chat
        └── app.js             ← Auth modal, chatbot widget, toasts, nav
```

---

## Setup

### 1. Prerequisites
- Node.js ≥ 18
- MySQL 8 running locally (or a remote MySQL instance)
- (Optional) Anthropic API key for the AI chatbot

### 2. Install dependencies
```bash
npm install
```

### 3. Create the databases and app user
Run the setup script **once** as your MySQL root user. It creates the `4kautos`
and `4kautos_test` databases plus a dedicated `kautos_app` user scoped to them:

```bash
# Linux/macOS (cmd.exe-style redirect)
mysql -u root -p < backend/sql/setup.sql
```

```powershell
# Windows PowerShell
Get-Content "backend\sql\setup.sql" -Raw | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p
```

> The script creates user `kautos_app` with password `Kautos4DevLocalOnly`.
> Change this in `backend/sql/setup.sql` (and in your `.env`) for anything beyond local dev.

### 4. Configure environment
```bash
cp .env.example .env
```
Set at minimum `DATABASE_URL`, `DATABASE_URL_TEST`, and `JWT_SECRET`:
```env
DATABASE_URL=mysql://kautos_app:Kautos4DevLocalOnly@localhost:3306/4kautos
DATABASE_URL_TEST=mysql://kautos_app:Kautos4DevLocalOnly@localhost:3306/4kautos_test
JWT_SECRET=<a long random secret, at least 32 chars>
```

### 5. Seed demo data (recommended for first run)
```bash
node backend/seed.js
# Creates the tables, 8 car listings, and 3 demo accounts
```

### 6. Start the server
```bash
npm start          # production
npm run dev        # with nodemon auto-restart
```
The server runs on `http://localhost:3000` and also serves the frontend statically.

### 7. Open in browser
```
http://localhost:3000
```
Or serve the frontend separately with Live Server / `npx serve frontend` — API calls
auto-route to the backend on `:3000` (recognised dev ports: 5500–5502, 5173, 4173, 8080,
8000, 4200). For any other port, set `window.API_BASE` in the HTML.

---

## Troubleshooting

| Symptom | Cause & fix |
|---|---|
| **"CORS blocked" or "method not allowed"** on login/signup | The page is loaded from a different origin than the API (e.g. VS Code Live Server). The API client auto-routes known dev ports to `:3000`; for any other port set `window.API_BASE`. Simplest: open the app at `http://localhost:3000` (backend-served, same origin). Hard-refresh (`Ctrl+Shift+R`) after changing this. |
| **`backend/sql/setup.sql` shows red underlines in VS Code** | The `ms-mssql` extension lints `.sql` as SQL Server (T-SQL) and mis-flags valid MySQL syntax. The repo's `.vscode/settings.json` disables that check (`mssql.intelliSense.enableErrorChecking: false`) — reload the window. The SQL itself is correct. |
| **`mysql_native_password` deprecation warning** | Harmless on MySQL 8.0.34+. On MySQL **8.4+** the plugin is removed — change the user in `setup.sql` to `caching_sha2_password` and append `?allowPublicKeyRetrieval=true` to `DATABASE_URL` for non-TLS local connections. |

---

## Demo Accounts (after seeding)

| Role   | Email                    | Password     |
|--------|--------------------------|--------------|
| Seller | seller@4kautos.com       | password123  |
| Buyer  | buyer@4kautos.com        | password123  |
| Admin  | admin@4kautos.com        | admin1234    |

---

## API Reference

### Auth
| Method | Path           | Auth | Body |
|--------|----------------|------|------|
| POST   | /auth/signup   | —    | `{ name, email, password, role }` |
| POST   | /auth/login    | —    | `{ email, password }` |

### Cars
| Method | Path              | Auth          | Notes |
|--------|-------------------|---------------|-------|
| GET    | /cars             | —             | `?q=&make=&model=&year=&minPrice=&maxPrice=&condition=&sellerId=` |
| GET    | /cars/:id         | —             | |
| POST   | /cars             | seller        | Validated: `{ make, model, year, mileage, vin(17), price, currency('NGN'\|'USD'), condition, location, latitude?, longitude?, photos[≥5], description? }` |
| DELETE | /cars/:id         | seller (owner) or admin | |
| POST   | /uploads          | seller        | multipart `photos[]` → magic-byte validated, optimized to WebP, returns CDN-ready URLs |

### Transactions
| Method | Path                     | Auth   | Body |
|--------|--------------------------|--------|------|
| POST   | /transactions            | buyer  | `{ carId, sellerId }` |
| GET    | /transactions            | any    | Returns own transactions |
| GET    | /transactions/:id        | any    | |
| PATCH  | /transactions/:id/status | buyer/seller | `{ status }` — validated against allowed values |

Valid statuses: `initiated`, `pending_inspection`, `payment_in_escrow`, `completed`, `cancelled`, `disputed`.

### Chatbot
| Method | Path  | Auth | Body |
|--------|-------|------|------|
| POST   | /chat | —    | `{ message, history? }` — falls back to built-in answers when no `ANTHROPIC_API_KEY` is set |

### FX & Customs Clearance
| Method | Path                   | Auth | Notes |
|--------|------------------------|------|-------|
| GET    | /fx                    | —    | Live USD↔NGN rate (cached 1h, offline fallback) |
| GET    | /clearance/agents      | —    | Directory of clearing agents |
| POST   | /clearance/estimate    | —    | `{ cifValueUsd \| cifValueNgn, year? }` → duty breakdown + agents ranked by best rate |

### Messages & Newsletter
| Method | Path                | Auth | Notes |
|--------|---------------------|------|-------|
| GET    | /messages/threads   | any  | The user's conversations (last message + unread count) |
| GET    | /messages           | any  | `?carId=&buyerId=` → a thread's messages (marks them read) |
| POST   | /messages           | any  | `{ carId, body, buyerId? }` — seller supplies `buyerId`; emails the recipient |
| GET    | /messages/unread    | any  | `{ count }` for the nav badge |
| POST   | /subscribe          | —    | `{ email }` — newsletter capture + welcome email |

### Admin (all require admin role)
| Method | Path                            |
|--------|---------------------------------|
| GET    | /admin/users                    |
| PATCH  | /admin/users/:id/verify         |
| DELETE | /admin/users/:id                |
| GET    | /admin/cars                     |
| DELETE | /admin/cars/:id                 |
| GET    | /admin/transactions             |
| PATCH  | /admin/transactions/:id/dispute |

---

## Running Tests
```bash
# Requires a running MySQL instance — uses DATABASE_URL_TEST (a separate database)
npm test
```
Tests run serially (`--runInBand`) against the `4kautos_test` database so the
two suites don't interfere with each other's data.

---

## Chatbot Configuration

The AutoBot endpoint (`POST /chat`) calls the Anthropic API server-side.

**With server-side key** (recommended for production):
```env
ANTHROPIC_API_KEY=sk-ant-...
```

**Without key:** The chatbot falls back to built-in local responses for common buying/selling questions — works offline with no API key.

---

## Deployment

Target topology (≈$15–30/mo, scales): **Cloudflare** (DNS/CDN/WAF) in front → static
**frontend on Cloudflare Pages** → **Node API on Railway** co-located with **managed
MySQL** → car images on **Cloudflare R2** → email via **Resend**. The app is portable:
nothing below is hard-coded — it's all environment variables (see `.env.example`).

Built-in deploy affordances:
- **`/health`** — liveness probe (also `/v1/health`); `railway.json` points the healthcheck here.
- **Graceful shutdown** — SIGTERM/SIGINT drain in-flight requests + close the DB pool (Railway sends SIGTERM on every deploy).
- **`trust proxy`** — set `TRUST_PROXY` so the rate-limiter sees the real client IP (Railway direct = `1`, behind Cloudflare = `2`).
- **`/v1` API** — canonical versioned routes; legacy unversioned paths still resolve for back-compat.

### 1. Backend + database — Railway
1. Push to GitHub, then **railway.com → New Project → Deploy from GitHub repo**. `railway.json` supplies the build/start/healthcheck.
2. **+ New → Database → MySQL.** Copy its connection string into the API service's `DATABASE_URL`. (Tables auto-migrate on boot.)
3. Set service variables: `NODE_ENV=production`, `JWT_SECRET` (32+ chars), `DATABASE_URL`, `ALLOWED_ORIGINS` (your frontend URLs), `TRUST_PROXY=1`, `ANTHROPIC_API_KEY` (optional).
4. Deploy; confirm `https://<service>.up.railway.app/health` returns `{"status":"ok"}`.

> Managed MySQL requiring TLS: append SSL params to `DATABASE_URL` (e.g. `?ssl={"rejectUnauthorized":true}`).

### 2. Frontend — Cloudflare Pages
1. **Cloudflare Pages → connect repo.** Build command: *(none)*; output directory: `frontend`. (`frontend/_headers` ships security headers.)
2. Point the frontend at the API by setting `window.API_BASE = 'https://<your-api>'` before `api.js` loads (the API client otherwise calls same-origin). Cleanest in production: put both behind Cloudflare — `www` → Pages, `api` → Railway — so `API_BASE` is `https://api.yourdomain.com`, then bump `TRUST_PROXY=2`.

### 3. Car images — Cloudflare R2
1. **R2 → Create bucket**, then create an R2 API token (S3-compatible).
2. On the Railway API service set: `S3_BUCKET`, `S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `ASSET_BASE_URL` (the bucket's public/custom domain). Unset = images stay on local disk (fine for dev).

### 4. Email — Resend
Set `RESEND_API_KEY` (+ `MAIL_FROM`). Until a domain is verified, `onboarding@resend.dev`
works for smoke tests. No key → Gmail SMTP fallback → silent skip.

> `NODE_ENV=production` switches CORS to the strict `ALLOWED_ORIGINS` allow-list. In dev
> (no `NODE_ENV`) any `localhost` / `127.0.0.1` / `file://` origin is accepted.
