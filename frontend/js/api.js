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

  const res = await fetch(`${BASE}${path}`, opts);
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
  logout() { clearToken(); window.location.href = '/'; },
  getUser,
  isLoggedIn() { return !!getToken(); },

  /* ── CARS ── */
  getCars(params = {}) {
    const q = new URLSearchParams(params).toString();
    return req('GET', `/cars${q ? '?' + q : ''}`);
  },
  getCar(id)        { return req('GET', `/cars/${id}`); },
  createCar(data)   { return req('POST', '/cars', data); },
  deleteCar(id)     { return req('DELETE', `/cars/${id}`); },

  /* ── TRANSACTIONS ── */
  initTx(carId, sellerId) { return req('POST', '/transactions', { carId, sellerId }); },
  getMyTx()               { return req('GET', '/transactions'); },
  getTx(id)               { return req('GET', `/transactions/${id}`); },
  updateTxStatus(id, status) { return req('PATCH', `/transactions/${id}/status`, { status }); },

  /* ── CHATBOT ── */
  async chat(message, history = []) {
    return req('POST', '/chat', { message, history });
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
};

window.API = API;
