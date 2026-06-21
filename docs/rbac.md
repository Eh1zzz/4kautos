# Access control & role boundaries (RBAC)

Three roles, chosen at signup (`buyer` / `seller`); `admin` is granted manually
and is **never** self-assignable (`SELF_SIGNUP_ROLES = ['buyer','seller']` in
`backend/routes/auth.js`). The role is stamped into the JWT at signup/login
(`jwt.sign({ id, role }, …)`) and re-attached to every request as `req.user` by
`authenticate`. `authorize(roles)` then shields each endpoint.

## Role intent

| Role   | Can do |
|--------|--------|
| **Buyer**  | Browse listings, save searches, favourite cars, message sellers, initiate/confirm purchases. |
| **Seller** | List & manage their own inventory, upload photos, set payout details, view incoming messages, see their transactions. |
| **Admin**  | System-wide moderation only — users, all cars, all transactions/disputes, payouts, contact inbox. No personal buyer/seller surfaces. |

Data is **per-user scoped** everywhere: a buyer/seller only ever sees rows they
participate in (their cars, their threads, their transactions). Admin sees the
system but reaches private operations only through the moderation endpoints.

## Endpoint → guard matrix

> "Owner check" = the handler additionally verifies the row belongs to
> `req.user.id` (or the user is admin) before acting.

| Method & path | Guard | Notes |
|---|---|---|
| `POST /auth/signup` `/login` `/forgot` `/reset` | public + `authLimiter` | `admin` role can't be requested |
| `GET /cars`, `GET /cars/:id`, `/similar`, `/valuation` | public | read-only catalogue |
| `POST /cars` | `seller` + `writeLimiter` | seller becomes the owner |
| `PUT /cars/:id` | `seller`\|`admin` + owner check | edit own listing; admin any |
| `DELETE /cars/:id` | `seller` (own) \| `admin` (any) | |
| `POST /uploads` | `seller` + `writeLimiter` | photo intake |
| `GET/POST/DELETE /saved-searches` | authenticated | buyer-oriented; surfaced only in the buyer dashboard. Per-user, no cross-role data — left open to any logged-in user rather than 403-ing a seller who browses. |
| `GET /messages/*`, `POST /messages` | authenticated | scoped to threads the user is part of |
| `POST /transactions` | `buyer` | buyer opens the deal |
| `GET /transactions`, `/:id` | authenticated + participant scope | only your own deals |
| `PATCH /transactions/:id/status`, `DELETE /transactions/:id` | authenticated + participant/role check | |
| `POST /payments/initiate` | `buyer` | |
| `GET/POST /payments/payout` | `seller` | seller payout details |
| `POST /payments/refund`, `/release` | authenticated + participant check | buyer or admin |
| `GET /payments/pending-payouts`, `POST /payments/mark-payout-paid` | `admin` | |
| `POST /payments/webhook` | public + signature verify | Flutterwave callback |
| `ALL /admin/*` | `admin` (`router.use(authenticate, authorize('admin'))`) | users, cars, transactions, disputes, contact inbox |
| `GET /fx`, `GET /vin`, `POST /clearance/*`, `POST /contact`, `POST /subscribe`, `POST /chatbot` | public (rate-limited) | |

## Why not literal `/api/admin|seller|buyer` URL prefixes

The requirement is **role-based shielding**, which is enforced per-route by
`authorize()` + owner checks above — the security property is identical to URL
namespacing, without breaking every existing client path. Admin already *is*
namespaced (`/admin/*`, blanket-guarded). Seller/buyer actions are guarded at
the verb that mutates (e.g. `POST /cars` = seller, `POST /transactions` = buyer)
rather than by prefix, because the same resource is read publicly and written by
one role.

## Frontend mirror (defence in depth)

`frontend/profile.html` scopes the dashboard to match — admin sees only the
system-wide Admin tab; sellers get My Listings / Add Listing; buyers get Saved
searches; "My Listings" is hidden from buyers and Saved searches from sellers.
The server guards above are the real boundary; the UI scoping is convenience.
