# 4kautos — Platform Upgrade Roadmap

Source: Figma UI pivot + feature expansion (2026-06-20). Inspiration refs:
Darkone (admin), the "Used Car Website" Figma make file (UI direction), Seron
(motion). This is a living checklist — tick items as they ship.

## 🎨 Design-system invariants (DO NOT break)
The original look stays through the redesign — explicitly retained per owner:
- **Color theme + accent tokens** ("Electric Midnight" — CSS vars at top of `styles.css`).
- **Turn-signal arrow accents.**
- **Caution-cone cursor.**
Everything else (layout, motion, components) is open to modification.

## 🧭 Key architectural decisions
1. **Stack is MySQL** (not Mongoose/Postgres). Schema changes = idempotent
   `ensureColumn()` in `backend/config/db.js`; arrays = JSON columns (like `cars.photos`).
2. **Identity verification: BUY, don't build.** Use a KYC vendor (Smile ID for
   Nigeria/Africa; or Onfido/Persona/Veriff). Store only `kyc_status` + provider
   ref + timestamp — NEVER raw ID/biometric images (NDPR/GDPR special-category data).
3. **Email is a shared dependency** for password reset, contact-form alerts, and
   push notifications. Driver built (`utils/email.js`) but unconfigured → gated on
   a verified domain ("domain day").
4. **AI streaming = SSE**, not WebSockets (Socket.IO stays for human chat). Needs
   `ANTHROPIC_API_KEY` + per-user rate limit + spend cap. AutoBot already
   listing-aware (`routes/chatbot.js`) — transport/UI upgrade, not a rebuild.
5. **Market valuation ≈ 80% built** — wrap existing `marketContext` + `Car.findSimilar`
   into `GET /cars/:id/valuation`; guard `sampleSize < 3`.
6. **Saved searches → server-side (new)**: one `saved_searches` table powers BOTH
   empty-state recommendations AND push notifications.
7. **Some "edits" are cleanups**, not features (buyer add-listing already seller-gated;
   delete cancelled tx; remove stray widgets).
8. **Scope ≈ weeks**, several items gated on spend (domain, KYC seat, AI budget).

---

## 1. Frontend
### A. General / Shared
- [ ] UI redesign + motion across landing/browse (extend existing IO scroll-reveal; lib only for page transitions) — **XL**
- [ ] Body-type emoji → SVG sprite keyed by `body_type` — **M**
- [ ] Footer: remove car-outline SVG; skew → smooth curve; YouTube→WhatsApp (+ IG/TikTok/X) — **M**
- [ ] Real production images + responsive `srcset`/Cloudflare resizing (R2 live ✅) — **M**
- [ ] "Send Us a Message" floating panel + Contact Us section — **M**
- [ ] Forgot-password / recovery wizard — **M** ⛔email
- [ ] AutoBot streaming widget (consume SSE) — **M**

### B. Buyer
- [ ] Browse grids + empty-state recommendations (saved search) — **M**
- [ ] Brand "Show More" + "Other" — **S**
- [ ] Hot Sales / ad banner — **S–M**
- [ ] "Good Price" valuation badge on cards/detail — **S**
- [ ] Identity verification UI (vendor SDK flow) — **M** 🔴vendor
- [ ] Dashboard: confirm add-listing hidden for buyers; delete cancelled transaction — **S**

### C. Seller
- [ ] Advanced intake wizard (animated steps) + new fields: ext/int color, engine,
      transmission, drivetrain, MPG, HP, seats; conditional max-towing (Truck only) — **L**
- [ ] Optional extras tabs (Comfort, Safety, Modifications) + media slots — **M**
- [ ] Identity verification before submit (same vendor) — **M** 🔴vendor
- [ ] Remove stray similar/ask widgets from owner view; add make/model "Other" — **S**

### D. Admin
- [ ] Rebuild admin panel to Figma/Darkone style (cards/tables/charts) on theme tokens;
      surfaces: contact messages, KYC queue, payouts, Hot-Sales mgmt — **L**

## 2. Backend
### A. Core & Security
- [ ] Account recovery: `/auth/forgot` + `/auth/reset`, hashed single-use time-locked token — **M** ⛔email
- [ ] Identity verification webhook → `kyc_status` (no biometric storage) — **L** 🔴vendor
- [ ] Contact endpoint → `contact_messages` table + admin email — **S–M** ⛔email(alert)
- [ ] Security hardeners: per-route limits, CSP, sanitize rich vehicle inputs — **M**

### B. AI
- [ ] `GET /chat/stream` SSE token streaming + rate limit + spend cap — **M** ⛔AI key

### C. Buyer service
- [ ] Recommendations fallback on 0-result (saved search) — **M**
- [ ] Push/alert engine on new matching listing — **L** ⛔email, needs saved-search
- [ ] `GET /cars/:id/valuation` (wrap existing market context) — **S**

### D. Seller / inventory
- [ ] Extended vehicle schema + validation + create/update + detail display — **M**
- [ ] "Other" make/model handling (sanitize, store, optional admin review) — **S**

---

## 3. Phased sequence
- **Phase 0 — quick wins (free, unblocked):** dashboard cleanups, delete-cancelled-tx,
  footer overhaul, brand Show More/Other. ← *in progress*
- **Phase 1 — data & reuse:** extended schema + intake wizard, body-type SVGs,
  valuation badge, saved-searches table.
- **Phase 2 — recs + media:** empty-state recs, responsive images, Hot Sales.
- **Phase 3 — AI streaming** ⛔ AI key + budget.
- **Phase 4 — "domain day" bundle:** email → password reset, contact, push. ⛔ domain.
- **Phase 5 — KYC** (buyer+seller+admin review). 🔴 vendor seat.
- **Phase 6 — full UI redesign + admin rebuild** (style the final component set once).

Tags: **S**≈<½d · **M**≈1–2d · **L**≈3–5d · **XL**≈week+ · ⛔ blocked · 🔴 high-risk/vendor.
