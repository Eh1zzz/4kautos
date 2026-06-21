# Escrow lifecycle & funds-release blueprint

How a deal moves from "buyer interested" to "seller paid", who triggers each
step, and how disputes/failures are handled. This documents the **implemented**
flow (`backend/routes/transactions.js`, `backend/routes/payments.js`,
`backend/models/Transaction.js`) plus the deliberate gaps.

Escrow is **buyer-protective**: the platform holds the money and only pays the
seller when the **buyer** confirms receipt. There is no seller-initiated
"unlock" — the seller's job is to be *ready* to be paid.

## State machine

`transactions.status` (`VALID_STATUSES`): `initiated`, `pending_inspection`,
`payment_in_escrow`, `completed`, `cancelled`, `disputed`.
A separate `payout_status` (`null` → `pending` → `paid`) tracks the *settlement*
of an international (manual/Wise) payout after release.

```
initiated ──pay──▶ (Flutterwave checkout) ──webhook──▶ payment_in_escrow
   │                                                      │   │   │
 cancel                                          buyer/admin │   │ admin
   ▼                                              release ▼   │   ▼ dispute
cancelled                                       completed     │ disputed
                                                  ▲           │ (manual resolve
                              payout FAILED ──────┘     refund │  → refund or
                              (revert to escrow)              ▼   release)
                                                          cancelled
```

## Happy path — step by step

1. **Buyer opens the deal.** `POST /transactions { carId }` (role: buyer).
   Seller is derived from the car record (never client-supplied); self-purchase
   and duplicate active deals are rejected. → `status: initiated`.
2. **Buyer pays into escrow.** `POST /payments/initiate { transactionId }`
   (role: buyer, own tx; allowed from `initiated`/`pending_inspection`). The
   charge **amount is snapshotted from the car** (`car.price`/`currency`) —
   never a client amount — and a unique `payment_ref` is stored. Returns a
   Flutterwave hosted-checkout link; the buyer is redirected to pay.
3. **Escrow is funded (asynchronous).** Flutterwave calls
   `POST /payments/webhook`. We **re-verify server-side** (`verifyTransaction`)
   and reject any amount/currency mismatch — the webhook's own numbers are never
   trusted. On success → `markEscrowPaid` → `status: payment_in_escrow`
   (records `flw_tx_id`, `paid_at`). Idempotent: only transitions from
   `initiated`/`pending_inspection`.
4. **Buyer confirms receipt → release.** `POST /payments/release
   { transactionId }` (the **buyer**, or an admin). Only from
   `payment_in_escrow`. Requires the seller to have payout details on file, then
   pays out via the seller's rail (`payOutToSeller`):
   - **NG bank** → Flutterwave transfer → `status: completed`.
   - **International** → manual/Wise → `status: completed`, `payout_status:
     pending` (queued for the admin to settle).
5. **Admin settles international payouts.** `GET /payments/pending-payouts` lists
   them; `POST /payments/mark-payout-paid { transactionId }` → `payout_status:
   paid`.

## The exact triggers

**Buyer — signal satisfaction (the key handshake):**
- Prerequisite: escrow is funded (`payment_in_escrow`).
- Action: `POST /payments/release` — this *is* the "I received the vehicle, pay
  the seller" confirmation. It's the only routine path that moves money to the
  seller. (Surfaced in the dashboard as "Confirm receipt & release funds".)

**Seller — milestones to be paid:**
- Add valid payout details (`POST /payments/payout`): NG bank (verified live via
  Flutterwave `resolveAccount`) or international (name/country/details for manual
  settlement). Without this, release is blocked with a clear message.
- That's the seller's entire obligation in-system — there is intentionally **no
  seller-triggered release**; funds are gated on buyer confirmation.

**Admin — oversight:**
- Refund: `POST /payments/refund` (also available to the buyer on their own tx) —
  only from `payment_in_escrow` → Flutterwave refund → `markRefunded` →
  `status: cancelled`.
- Dispute: `PATCH /admin/transactions/:id/dispute` → `status: disputed` for
  off-system resolution, after which the admin refunds (→buyer) or releases
  (→seller).

## Disputes, failures, timeouts, partials

- **Disputes:** flagged by admin (`disputed`); resolved manually, then closed via
  refund or release. No automated arbitration.
- **Payout failure:** the payout webhook (`transfer.completed` with `FAILED`)
  calls `revertRelease` → the deal goes **back to `payment_in_escrow`** so the
  release can be retried. Money is never silently lost.
- **Webhook safety:** authenticated by the shared `verif-hash`; acknowledged
  immediately (Flutterwave won't retry on our latency); every state write is
  guarded by a `WHERE status IN (...)` clause, so at-least-once delivery is
  idempotent.
- **Cancellation before payment:** participants can move an unpaid deal to
  `cancelled` (`PATCH /transactions/:id/status`); cancelled deals can be deleted
  (`DELETE /transactions/:id`). `completed`/`cancelled` deals can never be paid.

### Deliberate gaps (future work)
- **Automated release timeout:** there is currently **no** auto-release if a
  buyer never confirms. This protects buyers but can strand a seller. Planned:
  auto-release (or auto-dispute) N days after delivery confirmation / a tracking
  milestone. *Seller-protection follow-up.*
- **Partial releases / split payouts:** not supported — release is the full
  escrowed amount. Planned for multi-party or deposit-style deals.
- **Inspection gate:** `pending_inspection` exists as a status but isn't yet
  wired to a mandatory pre-payment inspection step; the new seller
  inspection-report field (see the listings wizard) is the data foundation for
  making structural condition a release criterion later.
