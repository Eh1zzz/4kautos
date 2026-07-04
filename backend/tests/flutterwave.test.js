import { jest } from '@jest/globals';
import * as FLW from '../utils/flutterwave.js';

/* Pure unit tests for the Flutterwave client's timeout + failure handling.
   No DB, no real network — global fetch is mocked. The point is to prove:
     1. Every call wires an AbortSignal (the timeout), so a hung gateway can't
        pin the request handler open (Node's global fetch has no default timeout).
     2. A timeout maps to each function's DOCUMENTED failure contract — the
        payment routes depend on these exact return shapes (e.g. refund relies on
        `false` to revert its claim; a throw there would strand the claim). */

const TIMEOUT = () => Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' });
const okRes  = (body) => ({ ok: true,  json: async () => body });
const errRes = (body) => ({ ok: false, json: async () => body });

beforeAll(() => { process.env.FLW_SECRET_KEY = 'FLWSECK_TEST-unit'; });

beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); delete global.fetch; });

// Assert the last fetch call carried an AbortSignal (the timeout is wired).
function expectSignalPassed() {
  const opts = global.fetch.mock.calls.at(-1)[1] || {};
  expect(opts.signal).toBeInstanceOf(AbortSignal);
}

describe('flutterwave client — timeout wiring', () => {
  it('every call passes an AbortSignal', async () => {
    global.fetch.mockResolvedValue(okRes({ status: 'success', data: {} }));
    await FLW.verifyTransaction('123').catch(() => {});
    expectSignalPassed();
  });
});

describe('refundTransaction — MUST return false (never throw) so the route reverts its claim', () => {
  it('returns false on timeout', async () => {
    global.fetch.mockRejectedValue(TIMEOUT());
    await expect(FLW.refundTransaction('flw_1', 100)).resolves.toBe(false);
  });
  it('returns false on a non-ok response', async () => {
    global.fetch.mockResolvedValue(errRes({ status: 'error', message: 'nope' }));
    await expect(FLW.refundTransaction('flw_1', 100)).resolves.toBe(false);
  });
  it('returns true on success', async () => {
    global.fetch.mockResolvedValue(okRes({ status: 'success', data: { id: 9 } }));
    await expect(FLW.refundTransaction('flw_1', 100)).resolves.toBe(true);
  });
});

describe('verifyTransaction — returns null on failure/timeout (webhook must not trust a hang)', () => {
  it('returns null on timeout', async () => {
    global.fetch.mockRejectedValue(TIMEOUT());
    await expect(FLW.verifyTransaction('123')).resolves.toBeNull();
  });
  it('returns null on a non-ok response', async () => {
    global.fetch.mockResolvedValue(errRes({ status: 'error' }));
    await expect(FLW.verifyTransaction('123')).resolves.toBeNull();
  });
  it('returns the data object on success', async () => {
    const data = { id: 123, tx_ref: '4kautos-1-abc', status: 'successful', amount: 500, currency: 'NGN' };
    global.fetch.mockResolvedValue(okRes({ status: 'success', data }));
    await expect(FLW.verifyTransaction('123')).resolves.toEqual(data);
  });
});

describe('getBanks / resolveAccount — degrade to []/null on timeout', () => {
  it('getBanks returns [] on timeout', async () => {
    global.fetch.mockRejectedValue(TIMEOUT());
    await expect(FLW.getBanks('NG')).resolves.toEqual([]);
  });
  it('getBanks maps codes+names on success', async () => {
    global.fetch.mockResolvedValue(okRes({ status: 'success', data: [{ code: '044', name: 'Access', extra: 'x' }] }));
    await expect(FLW.getBanks('NG')).resolves.toEqual([{ code: '044', name: 'Access' }]);
  });
  it('resolveAccount returns null on timeout', async () => {
    global.fetch.mockRejectedValue(TIMEOUT());
    await expect(FLW.resolveAccount('0690000031', '044')).resolves.toBeNull();
  });
  it('resolveAccount returns the name on success', async () => {
    global.fetch.mockResolvedValue(okRes({ status: 'success', data: { account_name: 'Jane Doe' } }));
    await expect(FLW.resolveAccount('0690000031', '044')).resolves.toBe('Jane Doe');
  });
});

describe('initiatePayment / createTransfer — THROW on timeout (route maps to 502 / un-claims release)', () => {
  it('initiatePayment throws a timeout-flavoured error on timeout', async () => {
    global.fetch.mockRejectedValue(TIMEOUT());
    await expect(FLW.initiatePayment({ tx_ref: 't', amount: 1, currency: 'NGN' }))
      .rejects.toThrow(/timed out/i);
  });
  it('initiatePayment returns the checkout link on success', async () => {
    global.fetch.mockResolvedValue(okRes({ status: 'success', data: { link: 'https://checkout/x' } }));
    await expect(FLW.initiatePayment({ tx_ref: 't', amount: 1, currency: 'NGN' }))
      .resolves.toBe('https://checkout/x');
  });
  it('createTransfer throws on timeout', async () => {
    global.fetch.mockRejectedValue(TIMEOUT());
    await expect(FLW.createTransfer({ bankCode: '044', accountNumber: '1', amount: 1, currency: 'NGN', reference: 'r' }))
      .rejects.toThrow(/timed out/i);
  });
  it('createTransfer returns the queued transfer on success', async () => {
    global.fetch.mockResolvedValue(okRes({ status: 'success', data: { id: 77, status: 'NEW' } }));
    await expect(FLW.createTransfer({ bankCode: '044', accountNumber: '1', amount: 1, currency: 'NGN', reference: 'r' }))
      .resolves.toEqual({ id: 77, status: 'NEW' });
  });
});
