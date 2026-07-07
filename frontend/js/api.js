/* ── 4Kautos API Client ─────────────────── */
// Resolve where the API lives:
//  • window.API_BASE  → explicit override (use for a separately-hosted frontend, e.g. Netlify)
//  • backend-served   → SAME origin (works on any host/port, no CORS) — dev on :3000 and production
//  • static dev server (VS Code Live Server, `serve`, Vite…) → can't answer API calls and
//    returns 405 for POST, so route those origins to the local backend on :3000
//  • file://          → local backend on :3000
const BASE = (function () {
  if (window.API_BASE != null) return window.API_BASE;
  if (!location.protocol.startsWith('http')) return 'http://localhost:3000';
  const STATIC_DEV_PORTS = ['5173', '4173', '8080', '8000', '4200'];
  // Live Server uses 5500 and increments (5501, 5502, …) — match the whole 55xx range.
  const isStaticDev = STATIC_DEV_PORTS.includes(location.port) || /^55\d\d$/.test(location.port);
  // Always target localhost:3000 (not 127.0.0.1): the dev backend listens there, and on
  // Windows 127.0.0.1:3000 can be a different/empty listener. Plain http (backend isn't TLS).
  if (isStaticDev) return 'http://localhost:3000';
  return ''; // same-origin (backend-served, dev on :3000 or production)
})();

// Versioned API prefix. /uploads is deliberately left unversioned (its stored
// URLs are /uploads/<hash>). The backend still accepts legacy unversioned paths.
const API_PREFIX = '/v1';

function getToken() { return localStorage.getItem('4k_token'); }
function setToken(t) { localStorage.setItem('4k_token', t); }
function clearToken()  { localStorage.removeItem('4k_token'); localStorage.removeItem('4k_user'); }

function getUser() {
  try { return JSON.parse(localStorage.getItem('4k_user')); } catch { return null; }
}

// Random idempotency key for replay-safe money mutations.
const idemKey = () => (self.crypto?.randomUUID ? self.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

async function req(method, path, body = null, isForm = false, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isForm ? body : JSON.stringify(body);

  const res = await fetch(`${BASE}${API_PREFIX}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const e = new Error(err.message || `HTTP ${res.status}`);
    e.status = res.status; // callers use this to tell auth failures from other errors
    throw e;
  }
  return res.json();
}

const API = {
  /* ── AUTH ── */
  async signup(name, email, password, role) {
    const data = await req('POST', '/auth/signup', { name, email, password, role });
    if (data.token) { setToken(data.token); localStorage.setItem('4k_user', JSON.stringify(data.user)); API.syncSaved(); }
    return data;
  },
  async login(email, password) {
    const data = await req('POST', '/auth/login', { email, password });
    if (data.token) { setToken(data.token); localStorage.setItem('4k_user', JSON.stringify(data.user)); API.syncSaved(); }
    return data;
  },
  forgotPassword(email)          { return req('POST', '/auth/forgot', { email }); },
  resetPassword(token, password) { return req('POST', '/auth/reset', { token, password }); },
  getMe()                        { return req('GET', '/auth/me'); },
  updateLocation(location)       { return req('PATCH', '/auth/me', { location }); },
  logout() { clearToken(); window.location.href = '/'; },
  getUser,
  isLoggedIn() { return !!getToken(); },
  origin() { return BASE; },   // backend origin for the realtime socket
  token: getToken,             // raw JWT for the socket handshake

  /* ── CARS ── */
  getCars(params = {}) {
    const q = new URLSearchParams(params).toString();
    return req('GET', `/cars${q ? '?' + q : ''}`);
  },
  // Paginated variant: returns { cars, total, pages } using the response headers.
  async getCarsPage(params = {}) {
    const clean = {};
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') clean[k] = v; });
    const q = new URLSearchParams(clean).toString();
    const token = getToken();
    const res = await fetch(`${BASE}${API_PREFIX}/cars${q ? '?' + q : ''}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `HTTP ${res.status}`); }
    const cars = await res.json();
    return {
      cars,
      total: Number(res.headers.get('X-Total-Count')) || cars.length,
      pages: Number(res.headers.get('X-Total-Pages')) || 1,
    };
  },
  getCar(id)        { return req('GET', `/cars/${id}`); },
  getSimilar(id, limit = 4) { return req('GET', `/cars/${id}/similar?limit=${limit}`); },
  getValuation(id)  { return req('GET', `/cars/${id}/valuation`); },
  getCustoms(id, destination) { return req('GET', `/cars/${id}/customs${destination ? '?destination=' + encodeURIComponent(destination) : ''}`); },
  getSeller(id)     { return req('GET', `/sellers/${id}`); },
  createCar(data)   { return req('POST', '/cars', data); },
  updateCar(id, data) { return req('PUT', `/cars/${id}`, data); },
  deleteCar(id)     { return req('DELETE', `/cars/${id}`); },

  /* ── PHOTO UPLOAD (multipart) ── */
  async uploadPhotos(files) {
    const fd = new FormData();
    [...files].forEach(f => fd.append('photos', f));
    const token = getToken();
    const res = await fetch(`${BASE}/uploads`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},  // let the browser set the multipart boundary
      body: fd,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(e.message || `HTTP ${res.status}`);
    }
    return res.json(); // { urls: [...] }
  },
  async uploadDoc(file) {
    const fd = new FormData();
    fd.append('document', file);
    const token = getToken();
    const res = await fetch(`${BASE}/uploads/doc`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(e.message || `HTTP ${res.status}`);
    }
    return res.json(); // { url }
  },

  /* ── TRANSACTIONS ── */
  initTx(carId, sellerId) { return req('POST', '/transactions', { carId, sellerId }, false, { 'Idempotency-Key': idemKey() }); },
  getMyTx()               { return req('GET', '/transactions'); },
  getTx(id)               { return req('GET', `/transactions/${id}`); },
  updateTxStatus(id, status) { return req('PATCH', `/transactions/${id}/status`, { status }); },
  deleteTx(id)               { return req('DELETE', `/transactions/${id}`); },
  // Escrow: start paying for a transaction → returns { link } to the Flutterwave checkout.
  initiatePayment(transactionId) { return req('POST', '/payments/initiate', { transactionId }, false, { 'Idempotency-Key': idemKey() }); },
  refundPayment(transactionId)   { return req('POST', '/payments/refund',   { transactionId }, false, { 'Idempotency-Key': idemKey() }); },
  releasePayment(transactionId)  { return req('POST', '/payments/release',  { transactionId }, false, { 'Idempotency-Key': idemKey() }); },
  getBanks()                     { return req('GET',  '/payments/banks'); },
  getPayout()                    { return req('GET',  '/payments/payout'); },
  savePayout(payload)            { return req('POST', '/payments/payout', payload); },
  adminPendingPayouts()          { return req('GET',  '/payments/pending-payouts'); },
  adminMarkPayoutPaid(transactionId) { return req('POST', '/payments/mark-payout-paid', { transactionId }); },

  /* ── CHATBOT ── */
  // carId (optional) lets AutoBot answer about a specific listing — the server
  // loads that car's real details and adds general facts about the model.
  async chat(message, history = [], carId = null) {
    const body = { message, history };
    if (carId != null) body.carId = carId;
    return req('POST', '/chat', body);
  },

  /* ── FX (USD ↔ NGN) ── */
  getRate() { return req('GET', '/fx'); },

  /* ── NEWSLETTER ── */
  subscribe(email) { return req('POST', '/subscribe', { email }); },

  /* ── VIN DECODE ── */
  decodeVin(vin) { return req('GET', `/vin?vin=${encodeURIComponent(vin)}`); },

  /* ── MESSAGES (buyer ↔ seller) ── */
  getThreads()  { return req('GET', '/messages/threads'); },
  getUnread()   { return req('GET', '/messages/unread'); },
  getThread(carId, buyerId) {
    const q = new URLSearchParams({ carId });
    if (buyerId) q.set('buyerId', buyerId);
    return req('GET', `/messages?${q}`);
  },
  sendMessage(carId, body, buyerId) {
    return req('POST', '/messages', buyerId ? { carId, body, buyerId } : { carId, body });
  },

  /* ── ADMIN (admin role only) ── */
  adminUsers()           { return req('GET', '/admin/users'); },
  adminVerifyUser(id)    { return req('PATCH', `/admin/users/${id}/verify`); },
  adminDeleteUser(id)    { return req('DELETE', `/admin/users/${id}`); },
  adminCars()            { return req('GET', '/admin/cars'); },
  adminDeleteCar(id)     { return req('DELETE', `/admin/cars/${id}`); },
  adminSetFeatured(id, featured) { return req('PATCH', `/admin/cars/${id}/feature`, { featured }); },
  adminTransactions()    { return req('GET', '/admin/transactions'); },
  adminStats()           { return req('GET', '/admin/stats'); },
  adminFlags()           { return req('GET', '/admin/flags'); },
  adminActivity()        { return req('GET', '/admin/activity'); },
  adminMap()             { return req('GET', '/admin/map'); },

  /* ── CUSTOMS CLEARANCE ── */
  getClearanceAgents()      { return req('GET', '/clearance/agents'); },
  estimateClearance(data)   { return req('POST', '/clearance/estimate', data); },

  /* ── SAVED / FAVOURITES ─────────────────────
     localStorage is always the instant, synchronous store (works anonymously
     and offline). When signed in, every toggle mirrors to the server and
     syncSaved() merges server↔local so hearts follow the account across
     devices instead of dying with the browser. */
  getSaved() {
    try { return JSON.parse(localStorage.getItem('4k_saved')) || []; } catch { return []; }
  },
  isSaved(id) { return API.getSaved().includes(String(id)); },
  toggleSaved(id) {
    id = String(id);
    const set = new Set(API.getSaved());
    const on = !set.has(id);
    on ? set.add(id) : set.delete(id);
    localStorage.setItem('4k_saved', JSON.stringify([...set]));
    if (API.isLoggedIn()) // fire-and-forget mirror; local state already updated
      req(on ? 'PUT' : 'DELETE', `/saved-cars/${encodeURIComponent(id)}`).catch(() => {});
    return on;
  },
  getSavedCars(full)    { return req('GET', `/saved-cars${full ? '?full=1' : ''}`); },
  async syncSaved() {
    if (!API.isLoggedIn()) return;
    try {
      const { ids } = await API.getSavedCars();
      const server = new Set(ids.map(String));
      const local  = API.getSaved();
      const merged = [...new Set([...server, ...local])];
      localStorage.setItem('4k_saved', JSON.stringify(merged));
      // Push local-only hearts up so the merge is two-way.
      await Promise.all(local.filter(i => !server.has(i))
        .map(i => req('PUT', `/saved-cars/${encodeURIComponent(i)}`).catch(() => {})));
      window.dispatchEvent(new CustomEvent('saved-sync')); // let the UI re-paint hearts
    } catch { /* sync is best-effort */ }
  },

  /* ── SAVED SEARCHES (server-side) ── */
  getSavedSearches()         { return req('GET', '/saved-searches'); },
  saveSearch(label, filters) { return req('POST', '/saved-searches', { label, filters }); },
  deleteSavedSearch(id)      { return req('DELETE', `/saved-searches/${id}`); },

  /* ── CONTACT ── */
  sendContact(payload)       { return req('POST', '/contact', payload); },
  adminContactMessages()     { return req('GET', '/admin/contact-messages'); },
  adminDeleteContact(id)     { return req('DELETE', `/admin/contact-messages/${id}`); },
  adminBackfillImages(apply, async) {
    const q = new URLSearchParams();
    if (apply) q.set('apply', '1');
    if (async) q.set('async', '1');
    const qs = q.toString();
    return req('POST', `/admin/backfill-images${qs ? '?' + qs : ''}`);
  },
  adminBackfillStatus()      { return req('GET', '/admin/backfill-images/status'); },
};

window.API = API;
