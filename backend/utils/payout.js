import crypto from 'crypto';
import * as FLW from './flutterwave.js';

/* Multi-rail seller payouts. The release route calls payOutToSeller() and doesn't
   care which rail runs — so adding Wise later is a change *here only*.
   Today:
   - ng_bank      → Flutterwave Transfer (automated).
   - international → no automated rail yet → returns 'pending' (the platform settles
     these via Wise manually for now; the admin "Pending payouts" view lists them).
*/
export async function payOutToSeller(payout, { amount, currency, txId }) {
  if (payout.payout_method === 'ng_bank') {
    const reference = `4kautos-payout-${txId}-${crypto.randomBytes(6).toString('hex')}`;
    const transfer = await FLW.createTransfer({
      bankCode: payout.bank_code,
      accountNumber: payout.account_number,
      amount,
      currency,
      reference,
      narration: `4kautos escrow release #${txId}`,
    });
    return { status: 'transferred', transferRef: transfer?.id ? String(transfer.id) : reference };
  }

  // international (and any future rail) — recorded as owed, settled manually for now.
  return { status: 'pending', transferRef: null };
}
