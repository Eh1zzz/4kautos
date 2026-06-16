/* ── 4Kautos App — Shared Utilities & Chatbot ─── */
'use strict';

/* ── TOAST ────────────────────────────────── */
(function() {
  const root = document.createElement('div');
  root.id = 'toast-root';
  document.body.appendChild(root);
  window.toast = function(msg, type = 'info', duration = 3000) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 280); }, duration);
  };
})();

/* ── AUTH MODAL ───────────────────────────── */
(function() {
  const html = `
    <div class="modal-overlay" id="auth-modal">
      <div class="modal">
        <div class="modal-head">
          <h2 id="auth-modal-title">Sign In</h2>
          <button class="modal-close" id="auth-modal-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="modal-tabs">
            <div class="modal-tab active" data-tab="login">Login</div>
            <div class="modal-tab" data-tab="signup">Sign Up</div>
          </div>
          <!-- Login -->
          <div id="tab-login">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-input" type="email" id="login-email" placeholder="you@example.com" autocomplete="email">
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input class="form-input" type="password" id="login-password" placeholder="Your password" autocomplete="current-password">
            </div>
            <div class="form-error hidden" id="login-error"></div>
            <button class="form-submit" id="login-btn">Sign In</button>
            <p class="form-alt">No account? <a id="go-signup">Create one</a></p>
          </div>
          <!-- Signup -->
          <div id="tab-signup" class="hidden">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input class="form-input" type="text" id="signup-name" placeholder="John Doe" autocomplete="name">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-input" type="email" id="signup-email" placeholder="you@example.com" autocomplete="email">
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input class="form-input" type="password" id="signup-password" placeholder="Min. 6 characters" autocomplete="new-password">
            </div>
            <div class="form-group">
              <label class="form-label">I am a</label>
              <select class="form-select" id="signup-role">
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
            </div>
            <div class="form-error hidden" id="signup-error"></div>
            <button class="form-submit" id="signup-btn">Create Account</button>
            <p class="form-alt">Already have an account? <a id="go-login">Sign in</a></p>
          </div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  function switchTab(tab) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('tab-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('tab-signup').classList.toggle('hidden', tab !== 'signup');
  }

  document.querySelectorAll('.modal-tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  document.getElementById('go-signup')?.addEventListener('click', () => switchTab('signup'));
  document.getElementById('go-login')?.addEventListener('click',  () => switchTab('login'));
  document.getElementById('auth-modal-close').addEventListener('click', () => closeAuth());
  document.getElementById('auth-modal').addEventListener('click', e => { if (e.target.id === 'auth-modal') closeAuth(); });

  window.openAuth  = (tab = 'login') => { switchTab(tab); document.getElementById('auth-modal').classList.add('open'); };
  window.closeAuth = () => document.getElementById('auth-modal').classList.remove('open');

  // Login
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    try {
      await API.login(email, pass);
      closeAuth(); toast('Welcome back! 🚗', 'success');
      updateNavAuth(); setTimeout(() => location.reload(), 600);
    } catch(e) {
      errEl.textContent = e.message; errEl.classList.remove('hidden');
    }
  });

  // Signup
  document.getElementById('signup-btn').addEventListener('click', async () => {
    const name  = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const pass  = document.getElementById('signup-password').value;
    const role  = document.getElementById('signup-role').value;
    const errEl = document.getElementById('signup-error');
    errEl.classList.add('hidden');
    try {
      await API.signup(name, email, pass, role);
      closeAuth(); toast('Account created! Welcome to 4Kautos 🚗', 'success');
      updateNavAuth(); setTimeout(() => location.href = '/profile.html', 800);
    } catch(e) {
      errEl.textContent = e.message; errEl.classList.remove('hidden');
    }
  });
})();

/* ── NAV AUTH STATE ───────────────────────── */
function updateNavAuth() {
  const user = API.getUser();
  const loginBtn  = document.getElementById('nav-login-btn');
  const signupBtn = document.getElementById('nav-signup-btn');
  const profileBtn= document.getElementById('nav-profile-btn');

  if (user) {
    loginBtn?.classList.add('hidden');
    signupBtn?.classList.add('hidden');
    if (profileBtn) {
      profileBtn.classList.remove('hidden');
      profileBtn.querySelector('.nav-user-label').textContent = user.name?.split(' ')[0] || 'Profile';
    }
  } else {
    loginBtn?.classList.remove('hidden');
    signupBtn?.classList.remove('hidden');
    profileBtn?.classList.add('hidden');
  }
}
document.addEventListener('DOMContentLoaded', updateNavAuth);
document.getElementById('nav-login-btn')?.addEventListener('click', () => openAuth('login'));
document.getElementById('nav-signup-btn')?.addEventListener('click', () => openAuth('signup'));

/* ── CHATBOT ──────────────────────────────── */
(function() {
  const QUICK = [
    'How do I buy a car?',
    'How does escrow work?',
    'What documents do I need?',
    'How to list my car?',
  ];

  const fabHtml = `
    <button class="chat-fab" id="chat-fab" aria-label="Open chat">
      <svg class="icon-chat" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.03 2 11c0 2.68 1.2 5.08 3.1 6.73L4 22l4.59-1.53C9.67 20.8 10.8 21 12 21c5.52 0 10-4.03 10-9s-4.48-9-10-9zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>
      <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
    <div class="chat-window" id="chat-window">
      <div class="chat-header">
        <div class="chat-bot-avatar">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.03 2 11c0 2.68 1.2 5.08 3.1 6.73L4 22l4.59-1.53C9.67 20.8 10.8 21 12 21c5.52 0 10-4.03 10-9s-4.48-9-10-9z"/></svg>
        </div>
        <div>
          <div class="chat-bot-name">AutoBot</div>
          <div class="chat-bot-status">Online</div>
        </div>
        <button class="chat-close" id="chat-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="quick-replies" id="quick-replies"></div>
      <div class="chat-input-row">
        <textarea class="chat-input" id="chat-input" placeholder="Ask about buying, selling, or any car…" rows="1"></textarea>
        <button class="chat-send" id="chat-send">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', fabHtml);

  const fab      = document.getElementById('chat-fab');
  const win      = document.getElementById('chat-window');
  const msgs     = document.getElementById('chat-messages');
  const input    = document.getElementById('chat-input');
  const sendBtn  = document.getElementById('chat-send');
  const qrWrap   = document.getElementById('quick-replies');
  let history    = [];
  let isOpen     = false;

  function toggleChat() {
    isOpen = !isOpen;
    fab.classList.toggle('open', isOpen);
    win.classList.toggle('open', isOpen);
    if (isOpen && msgs.children.length === 0) {
      addBotMsg("Hi! I'm AutoBot 🚗 I can help you find the perfect car, understand our buying process, or list your vehicle. What can I help you with?");
      renderQuickReplies();
    }
    if (isOpen) input.focus();
  }

  fab.addEventListener('click', toggleChat);
  document.getElementById('chat-close').addEventListener('click', () => {
    isOpen = false; fab.classList.remove('open'); win.classList.remove('open');
  });

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function addBotMsg(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg bot';
    el.innerHTML = `
      <div class="msg-avatar bot-avatar-sm">🤖</div>
      <div class="msg-bubble">${escHtml(text).replace(/\n/g,'<br>')}</div>`;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addUserMsg(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg user';
    el.innerHTML = `
      <div class="msg-avatar user-avatar-sm">You</div>
      <div class="msg-bubble">${escHtml(text)}</div>`;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'chat-msg bot'; el.id = 'typing-indicator';
    el.innerHTML = `<div class="msg-avatar bot-avatar-sm">🤖</div><div class="chat-typing"><span></span><span></span><span></span></div>`;
    msgs.appendChild(el); msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function renderQuickReplies() {
    qrWrap.innerHTML = QUICK.map(q =>
      `<button class="quick-reply">${q}</button>`
    ).join('');
    qrWrap.querySelectorAll('.quick-reply').forEach(btn => {
      btn.addEventListener('click', () => { sendMessage(btn.textContent); qrWrap.innerHTML = ''; });
    });
  }

  async function sendMessage(text) {
    const msg = text || input.value.trim();
    if (!msg) return;
    input.value = '';
    qrWrap.innerHTML = '';
    addUserMsg(msg);
    sendBtn.disabled = true;
    const typing = showTyping();
    history.push({ role: 'user', content: msg });

    try {
      const data = await API.chat(msg, history);
      typing.remove();
      const reply = data.reply || "Sorry, I couldn't get a response right now.";
      addBotMsg(reply);
      history.push({ role: 'assistant', content: reply });
    } catch (e) {
      typing.remove();
      // Fallback local responses when backend is down
      addBotMsg(localFallback(msg));
    }
    sendBtn.disabled = false;
    input.focus();
  }

  // Local fallback answers when backend is unavailable
  function localFallback(msg) {
    const m = msg.toLowerCase();
    if (m.includes('buy') || m.includes('purchase'))
      return "To buy a car on 4Kautos:\n1. Browse listings and find your car\n2. Click 'Initiate Purchase'\n3. Schedule an inspection\n4. Payment goes into escrow\n5. Transfer title and receive keys!\n\nNeed help with anything specific?";
    if (m.includes('escrow'))
      return "Our escrow system protects both buyers and sellers. Once you initiate a purchase, your payment is held securely until both parties confirm the transaction is complete. This prevents fraud and ensures a smooth transfer.";
    if (m.includes('list') || m.includes('sell'))
      return "To list your car:\n1. Create a seller account\n2. Go to your Profile dashboard\n3. Click 'Add New Listing'\n4. Fill in make, model, year, mileage, VIN, condition, price\n5. Upload photos (up to 10)\n\nListings go live immediately after submission!";
    if (m.includes('document'))
      return "For buying you'll need: valid ID, proof of insurance, and payment method.\n\nFor selling you'll need: vehicle title (clean), government-issued ID, and service history if available.";
    return "I'm having trouble connecting to the server right now. Please try again in a moment, or browse our listings page to find your perfect car! 🚗";
  }

  sendBtn.addEventListener('click', () => sendMessage());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  });
})();

/* ── NAV COMMON MARKUP ────────────────────── */
// Inject nav logo into any element with .nav-logo
document.querySelectorAll('.nav-logo').forEach(el => {
  el.innerHTML = `
    <div class="logo-mark">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 17H3v-4l2-5h14l2 5v4h-2"/>
        <circle cx="7.5" cy="17.5" r="1.5" fill="white" stroke="none"/>
        <circle cx="16.5" cy="17.5" r="1.5" fill="white" stroke="none"/>
        <path d="M5 13h14"/>
      </svg>
    </div>
    <div class="logo-text">
      <span class="logo-4k">4KAUTOS</span>
      <span class="logo-autos">Global Marketplace</span>
    </div>`;
});

/* ── HTML ESCAPE (shared) ─────────────────── */
// Prevent stored XSS from seller-supplied fields (title/make/model/vin/etc.)
window.esc = function (str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

/* ── MONEY / FX (USD ⇄ NGN) ───────────────── */
// Prices are stored in a native currency per listing; we display the user's
// chosen currency as the headline and the converted value underneath.
const Money = (function () {
  const CACHE_KEY = '4k_fx';
  const TTL = 60 * 60 * 1000; // 1h
  let usdToNgn = 1600;        // safe default until the live rate loads
  let updatedAt = 0;

  // Seed from localStorage so the first paint isn't wrong.
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c && c.usdToNgn) { usdToNgn = c.usdToNgn; updatedAt = c.updatedAt; }
  } catch {}

  function display() { return localStorage.getItem('4k_currency') || 'NGN'; }
  function setDisplay(c) { localStorage.setItem('4k_currency', c === 'USD' ? 'USD' : 'NGN'); }
  const symbol = c => (c === 'USD' ? '$' : '₦');
  const fmtNum = n => Math.round(n).toLocaleString('en-US');

  function convert(amount, native) {
    const ngn = native === 'NGN' ? amount : amount * usdToNgn;
    const usd = native === 'USD' ? amount : amount / usdToNgn;
    return { NGN: ngn, USD: usd };
  }

  // Returns HTML: headline in the display currency + converted subline.
  function fmt(amount, native = 'NGN') {
    amount = Number(amount);
    if (!Number.isFinite(amount)) return 'Price on Request';
    const v = convert(amount, native);
    const primary = display();
    const secondary = primary === 'NGN' ? 'USD' : 'NGN';
    return `<span class="price-main">${symbol(primary)}${fmtNum(v[primary])}</span>` +
           `<span class="price-sub">≈ ${symbol(secondary)}${fmtNum(v[secondary])}</span>`;
  }

  // Re-render every element carrying price data attributes.
  function repriceAll() {
    document.querySelectorAll('.js-price').forEach(el => {
      const amt = el.dataset.amount;
      if (amt != null && amt !== '') el.innerHTML = fmt(+amt, el.dataset.native || 'NGN');
    });
    document.querySelectorAll('.js-cur-label').forEach(el => { el.textContent = display(); });
  }

  async function load() {
    try {
      const r = await API.getRate();
      if (r && r.usdToNgn) {
        usdToNgn = r.usdToNgn; updatedAt = r.updatedAt || Date.now();
        localStorage.setItem(CACHE_KEY, JSON.stringify({ usdToNgn, updatedAt }));
        repriceAll();
      }
    } catch { /* keep cached/default rate */ }
  }

  function toggle() {
    setDisplay(display() === 'NGN' ? 'USD' : 'NGN');
    repriceAll();
  }

  return { fmt, repriceAll, load, toggle, display, get usdToNgn() { return usdToNgn; } };
})();
window.Money = Money;

/* ── SHARED CAR CARD ──────────────────────── */
window.carCard = function (c) {
  const native = c.currency || 'NGN';
  const img = c.photos?.[0] || `https://placehold.co/600x400/18181d/f59e0b?text=${encodeURIComponent(c.make || 'Car')}`;
  const saved = API.isSaved(c.id);
  const title = c.title || `${c.year || ''} ${c.make || ''} ${c.model || ''}`.trim();
  const badge = c.featured ? '<span class="card-badge featured">Featured</span>'
              : (c.condition === 'excellent' ? '<span class="card-badge new">Excellent</span>' : '');
  const priceHtml = (c.price != null && c.price !== '')
    ? `<div class="card-price js-price" data-amount="${esc(c.price)}" data-native="${esc(native)}">${Money.fmt(c.price, native)}</div>`
    : `<div class="card-price">Price on Request</div>`;

  return `
    <div class="car-card" data-id="${esc(c.id)}">
      <div class="card-img-wrap">
        <img class="card-img" src="${esc(img)}" alt="${esc(title)}" loading="lazy" onerror="this.src='https://placehold.co/600x400/18181d/f59e0b?text=No+Photo'">
        ${badge}
        <button class="card-saves ${saved ? 'saved' : ''}" title="Save" data-save="${esc(c.id)}">${saved ? '♥' : '♡'}</button>
      </div>
      <div class="card-body">
        <div class="card-title">${esc(title)}</div>
        <div class="card-specs">
          ${c.mileage ? `<span class="spec-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${Number(c.mileage).toLocaleString()} km</span>` : ''}
          ${c.condition ? `<span class="spec-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 12l2 2 4-4"/></svg>${esc(c.condition)}</span>` : ''}
          ${c.year ? `<span class="spec-chip">${esc(c.year)}</span>` : ''}
        </div>
        <div class="card-footer">
          ${priceHtml}
          <button class="card-cta">View Details</button>
        </div>
      </div>
    </div>`;
};

// Delegated handlers so cards work no matter who renders them.
document.addEventListener('click', e => {
  const save = e.target.closest('.card-saves');
  if (save) {
    e.stopPropagation(); e.preventDefault();
    const on = API.toggleSaved(save.dataset.save);
    save.classList.toggle('saved', on);
    save.textContent = on ? '♥' : '♡';
    return;
  }
  const card = e.target.closest('.car-card');
  if (card && card.dataset.id) location.href = `detail.html?id=${card.dataset.id}`;
});

/* ── BRAND STRIP (shop by brand) ──────────── */
// Logos via simple-icons CDN with a monogram fallback when a logo is missing.
const BRANDS = [
  { name: 'Toyota', slug: 'toyota' }, { name: 'Honda', slug: 'honda' },
  { name: 'BMW', slug: 'bmw' }, { name: 'Mercedes-Benz', slug: 'mercedes' },
  { name: 'Ford', slug: 'ford' }, { name: 'Hyundai', slug: 'hyundai' },
  { name: 'Kia', slug: 'kia' }, { name: 'Lexus', slug: 'lexus' },
  { name: 'Nissan', slug: 'nissan' }, { name: 'Volkswagen', slug: 'volkswagen' },
  { name: 'Audi', slug: 'audi' }, { name: 'Mazda', slug: 'mazda' },
];
window.renderBrandStrip = function (selector) {
  const host = document.querySelector(selector);
  if (!host) return;
  host.innerHTML = BRANDS.map(b => `
    <a class="brand-tile" href="listings.html?make=${encodeURIComponent(b.name)}" title="${esc(b.name)} for sale">
      <span class="brand-logo">
        <img src="https://cdn.simpleicons.org/${b.slug}/f5f5f4" alt="${esc(b.name)}" loading="lazy"
             onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'brand-mono',textContent:'${esc(b.name[0])}'}))">
      </span>
      <span class="brand-name">${esc(b.name)}</span>
    </a>`).join('');
};

/* ── MOBILE NAV (hamburger + drawer) ──────── */
(function () {
  document.querySelectorAll('.navbar .nav-actions').forEach(actions => {
    if (!actions.querySelector('.nav-hamburger')) {
      const btn = document.createElement('button');
      btn.className = 'nav-hamburger';
      btn.setAttribute('aria-label', 'Menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<span></span><span></span><span></span>';
      actions.appendChild(btn);
    }
  });
  const ham = document.querySelector('.nav-hamburger');
  if (!ham) return;

  const drawer = document.createElement('div');
  drawer.className = 'mobile-menu';
  drawer.innerHTML = `
    <a href="index.html">Home</a>
    <a href="listings.html">Listings</a>
    <a href="clearance.html">Customs Clearance</a>
    <a href="index.html#how-it-works">How It Works</a>
    <div class="mobile-menu-divider"></div>
    <button class="mm-currency" type="button">Currency: <strong class="js-cur-label">NGN</strong> · tap to switch</button>
    <a href="profile.html" id="mm-dashboard" class="hidden">My Dashboard</a>
    <button id="mm-login" type="button">Sign In</button>
    <a href="#" id="mm-signup">List Your Car</a>
    <button id="mm-logout" type="button" class="hidden mm-danger">Sign Out</button>`;
  document.body.appendChild(drawer);

  function setMenu(open) {
    ham.classList.toggle('open', open);
    drawer.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    ham.setAttribute('aria-expanded', String(open));
  }
  ham.addEventListener('click', () => setMenu(!drawer.classList.contains('open')));
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  drawer.querySelector('.mm-currency').addEventListener('click', () => { Money.toggle(); });
  drawer.querySelector('#mm-login').addEventListener('click', () => { setMenu(false); openAuth('login'); });
  drawer.querySelector('#mm-signup').addEventListener('click', e => { e.preventDefault(); setMenu(false); openAuth('signup'); });
  drawer.querySelector('#mm-logout').addEventListener('click', () => API.logout());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 640) setMenu(false); });

  // Sync drawer auth items with login state.
  const sync = () => {
    const user = API.getUser();
    drawer.querySelector('#mm-dashboard').classList.toggle('hidden', !user);
    drawer.querySelector('#mm-logout').classList.toggle('hidden', !user);
    drawer.querySelector('#mm-login').classList.toggle('hidden', !!user);
    drawer.querySelector('#mm-signup').classList.toggle('hidden', !!user);
  };
  document.addEventListener('DOMContentLoaded', sync);
  sync();
})();

/* ── CURRENCY TOGGLE (desktop nav) ────────── */
(function () {
  document.querySelectorAll('.navbar .nav-actions').forEach(actions => {
    if (actions.querySelector('.cur-toggle')) return;
    const btn = document.createElement('button');
    btn.className = 'nav-btn nav-btn-ghost cur-toggle';
    btn.type = 'button';
    btn.title = 'Switch display currency';
    btn.innerHTML = '<span class="js-cur-label">NGN</span> ⇄';
    // Place before the hamburger so it stays on the right cluster.
    const ham = actions.querySelector('.nav-hamburger');
    actions.insertBefore(btn, ham || null);
    btn.addEventListener('click', () => Money.toggle());
  });
})();

/* ── FOOTER YEAR ──────────────────────────── */
document.querySelectorAll('.js-year').forEach(el => { el.textContent = new Date().getFullYear(); });

/* ── GLOBAL ESC: close modal / chat ───────── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  window.closeAuth?.();
  const cw = document.getElementById('chat-window');
  if (cw?.classList.contains('open')) document.getElementById('chat-close')?.click();
});

/* ── BOOT ─────────────────────────────────── */
Money.load();                       // fetch live FX, then reprice
document.addEventListener('DOMContentLoaded', () => Money.repriceAll());
