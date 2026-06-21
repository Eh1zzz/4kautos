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

async function req(method, path, body = null, isForm = false) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isForm ? body : JSON.stringify(body);

  const res = await fetch(`${BASE}${API_PREFIX}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

const API = {
  /* ── AUTH ── */
  async signup(name, email, password, role) {
    const data = await req('POST', '/auth/signup', { name, email, password, role });
    if (data.token) { setToken(data.token); localStorage.setItem('4k_user', JSON.stringify(data.user)); }
    return data;
  },
  async login(email, password) {
    const data = await req('POST', '/auth/login', { email, password });
    if (data.token) { setToken(data.token); localStorage.setItem('4k_user', JSON.stringify(data.user)); }
    return data;
  },
  forgotPassword(email)          { return req('POST', '/auth/forgot', { email }); },
  resetPassword(token, password) { return req('POST', '/auth/reset', { token, password }); },
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

  /* ── TRANSACTIONS ── */
  initTx(carId, sellerId) { return req('POST', '/transactions', { carId, sellerId }); },
  getMyTx()               { return req('GET', '/transactions'); },
  getTx(id)               { return req('GET', `/transactions/${id}`); },
  updateTxStatus(id, status) { return req('PATCH', `/transactions/${id}/status`, { status }); },
  deleteTx(id)               { return req('DELETE', `/transactions/${id}`); },
  // Escrow: start paying for a transaction → returns { link } to the Flutterwave checkout.
  initiatePayment(transactionId) { return req('POST', '/payments/initiate', { transactionId }); },
  refundPayment(transactionId)   { return req('POST', '/payments/refund',   { transactionId }); },
  releasePayment(transactionId)  { return req('POST', '/payments/release',  { transactionId }); },
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

  /* ── CUSTOMS CLEARANCE ── */
  getClearanceAgents()      { return req('GET', '/clearance/agents'); },
  estimateClearance(data)   { return req('POST', '/clearance/estimate', data); },

  /* ── SAVED / FAVOURITES (client-side) ── */
  getSaved() {
    try { return JSON.parse(localStorage.getItem('4k_saved')) || []; } catch { return []; }
  },
  isSaved(id) { return API.getSaved().includes(String(id)); },
  toggleSaved(id) {
    id = String(id);
    const set = new Set(API.getSaved());
    set.has(id) ? set.delete(id) : set.add(id);
    localStorage.setItem('4k_saved', JSON.stringify([...set]));
    return set.has(id);
  },

  /* ── SAVED SEARCHES (server-side) ── */
  getSavedSearches()         { return req('GET', '/saved-searches'); },
  saveSearch(label, filters) { return req('POST', '/saved-searches', { label, filters }); },
  deleteSavedSearch(id)      { return req('DELETE', `/saved-searches/${id}`); },

  /* ── CONTACT ── */
  sendContact(payload)       { return req('POST', '/contact', payload); },
  adminContactMessages()     { return req('GET', '/admin/contact-messages'); },
  adminDeleteContact(id)     { return req('DELETE', `/admin/contact-messages/${id}`); },
  adminBackfillImages(apply) { return req('POST', `/admin/backfill-images${apply ? '?apply=1' : ''}`); },
};

window.API = API;
