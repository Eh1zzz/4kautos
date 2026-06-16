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
- **Same-origin API base** — the frontend now calls the origin that served it (no hard-coded `localhost:3000`), eliminating the cross-origin CORS failure. Override with `window.API_BASE` for a separately-hosted frontend.
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
Or serve the frontend separately with Live Server / `npx serve frontend`.

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
| POST   | /cars             | seller        | Validated: `{ make, model, year, mileage, vin(17), price, currency('NGN'\|'USD'), condition, photos[≥5], description? }` |
| POST   | /cars/:id/photos  | seller (owner)| multipart form |
| DELETE | /cars/:id         | seller (owner) or admin | |

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

### Admin (all require admin role)
| Method | Path                            |
|--------|---------------------------------|
| GET    | /admin/users                    |
| PATCH  | /admin/users/:id/verify         |
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

### Backend — Render.com / Railway / any Node host
1. Push to GitHub
2. New Web Service → connect repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Provision a MySQL database (PlanetScale, Railway, RDS, etc.)
6. Add env vars: `NODE_ENV=production`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `ANTHROPIC_API_KEY`

> `NODE_ENV=production` switches CORS to the strict `ALLOWED_ORIGINS` allow-list.
> In development (no `NODE_ENV`), any `localhost` / `127.0.0.1` / `file://` origin is accepted.

> For managed MySQL that requires TLS, append the appropriate SSL parameters to
> `DATABASE_URL` (e.g. `?ssl={"rejectUnauthorized":true}`).

### Frontend — Netlify / Vercel
By default the frontend calls the **same origin** that served it (the backend serves it),
so no config is needed when running `npm start`. To host the frontend separately
(Netlify/Vercel) pointing at a remote backend, set `window.API_BASE = 'https://your-api'`
in each HTML file before `api.js` loads.
