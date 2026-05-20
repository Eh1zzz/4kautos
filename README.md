# 4Kautos — Premium Preowned Car Marketplace

A full-stack web application for buying and selling preowned vehicles, with a Node.js/Express backend, MongoDB database, and a premium static frontend featuring an AI-powered chatbot.

---

## What Was Improved (v1 → v2)

### Backend Bug Fixes
| Issue | Fix |
|-------|-----|
| Missing `"type":"module"` in package.json | Added — ESM now works correctly |
| `cars.js` had triple duplicate route handlers | Removed duplicates — single clean implementation |
| `transactions.js` had duplicate handlers | Same fix |
| `admin.js` imported from `../middleware/authorize.js` (doesn't exist) | Fixed to `../middleware/auth.js` |
| `upload.js` was empty | Implemented multer with file-type validation and 10MB limit |
| Auth route double-hashed passwords | Pre-save hook now handles hashing; route removed manual call |
| `auth/login` returned no user object | Now returns `{ token, user: { id, name, email, role } }` |
| No CORS middleware | Added with configurable allowed origins |
| No rate limiting | Added 200 req/15min global limit, 20 req/min on chatbot |
| No global error handler | Added |

### New Features
- **AI Chatbot** (`/chat`) — AutoBot powered by Claude, with local fallback responses when backend is offline
- **Seed script** (`node backend/seed.js`) — 8 realistic car listings + buyer/seller/admin demo accounts
- **Text search index** on Car model (make, model, title, description)

### Frontend — Complete Redesign
- **4Kautos logo** — wordmark with car icon in navbar and footer
- **Favicon** — SVG car/brand icon
- **Design system** — Anthracite + Amber palette, Oswald + Jost typography
- **Hero** with animated search form and live stats
- **Listings page** with filter sidebar (make, model, year range, price range, condition)
- **Detail page** with photo gallery (thumbnail nav + prev/next), specs table, seller card, escrow safety note
- **Profile/Dashboard** — tabs for Overview, My Listings (sellers), Transactions, Add Listing
- **Auth modal** — login/signup with role selection, inline validation, no page redirect
- **Chatbot widget** — floating FAB, typing indicator, quick reply chips, graceful offline fallback
- **Toast notifications** system-wide

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
│   │   └── db.js              ← MongoDB connection
│   ├── middleware/
│   │   ├── auth.js            ← JWT authenticate + authorize
│   │   └── upload.js          ← Multer image upload config
│   ├── models/
│   │   ├── User.js            ← bcrypt pre-save, comparePassword, toJSON strip
│   │   ├── Car.js             ← text search index, featured flag, description
│   │   └── Transaction.js     ← 6 status values including disputed
│   ├── routes/
│   │   ├── auth.js            ← POST /auth/signup, /auth/login
│   │   ├── cars.js            ← CRUD + photo upload
│   │   ├── transactions.js    ← initiate, list, update status
│   │   ├── admin.js           ← admin-only management
│   │   └── chatbot.js         ← POST /chat → AutoBot (Claude)
│   └── tests/
│       ├── auth.test.js
│       └── car.test.js
│
└── frontend/
    ├── favicon.svg
    ├── index.html             ← Home: hero, featured listings, how-it-works
    ├── listings.html          ← Browse with sidebar filters + sort
    ├── detail.html            ← Gallery, specs, CTA, chatbot enquiry
    ├── profile.html           ← Dashboard: listings, transactions, add car
    ├── css/
    │   └── styles.css         ← Complete design system (798 lines)
    └── js/
        ├── api.js             ← Fetch wrapper: auth, cars, transactions, chat
        └── app.js             ← Auth modal, chatbot widget, toasts, nav
```

---

## Setup

### 1. Prerequisites
- Node.js ≥ 18
- MongoDB running locally or a MongoDB Atlas URI
- (Optional) Anthropic API key for the AI chatbot

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env — set MONGO_DB_URI and JWT_SECRET at minimum
```

### 4. Seed demo data (recommended for first run)
```bash
node backend/seed.js
# Creates 8 car listings + 3 demo accounts
```

### 5. Start the server
```bash
npm start          # production
npm run dev        # with nodemon auto-restart
```
The server runs on `http://localhost:3000` and also serves the frontend statically.

### 6. Open in browser
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
| Method | Path              | Auth         | Notes |
|--------|-------------------|--------------|-------|
| GET    | /cars             | —            | `?make=&model=&year=&minPrice=&maxPrice=&condition=` |
| GET    | /cars/:id         | —            | |
| POST   | /cars             | seller       | |
| POST   | /cars/:id/photos  | seller       | multipart form |
| DELETE | /cars/:id         | admin        | |

### Transactions
| Method | Path                     | Auth   | Body |
|--------|--------------------------|--------|------|
| POST   | /transactions            | buyer  | `{ carId, sellerId }` |
| GET    | /transactions            | any    | Returns own transactions |
| GET    | /transactions/:id        | any    | |
| PATCH  | /transactions/:id/status | any    | `{ status }` |

### Chatbot
| Method | Path  | Auth | Body |
|--------|-------|------|------|
| POST   | /chat | —    | `{ message, history? }` |

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
# Requires a running MongoDB instance (test DB is separate)
npm test
```

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

### Backend — Render.com
1. Push to GitHub
2. New Web Service → connect repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add env vars: `PORT`, `MONGO_DB_URI`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `ANTHROPIC_API_KEY`

### Frontend — Netlify / Vercel
Drag the `frontend/` folder to Netlify, or set `window.API_BASE` in each HTML file to point to your deployed backend URL before `api.js` loads.
