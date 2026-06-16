/* ── 4Kautos API Client ─────────────────── */
// Default to the SAME origin that served the page (the backend serves this
// frontend), so it works on any host/port with no CORS. Opened from a file://
// path we fall back to the local dev server. For a separately-hosted frontend
// (e.g. Netlify), set `window.API_BASE = 'https://your-api'` before this loads.
const BASE = window.API_BASE ?? (location.protocol.startsWith('http') ? '' : 'http://localhost:3000');

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
