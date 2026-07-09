/* ── 4Kautos App — Shared Utilities & Chatbot ─── */
'use strict';

/* ── Password show/hide icons + toggle ────── */
const EYE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
document.addEventListener('click', e => {
  const btn = e.target.closest('.pw-toggle');
  if (!btn) return;
  const input = document.getElementById(btn.dataset.pw);
  if (!input) return;
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  btn.innerHTML = reveal ? EYE_OFF_SVG : EYE_SVG;
  btn.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
});

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
          <h2 id="auth-modal-title" data-i18n="nav.signin">Sign In</h2>
          <button class="modal-close" id="auth-modal-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="modal-tabs">
            <div class="modal-tab active" data-tab="login" data-i18n="auth.login">Login</div>
            <div class="modal-tab" data-tab="signup" data-i18n="auth.signup">Sign Up</div>
          </div>
          <!-- Login -->
          <div id="tab-login">
            <div class="form-group">
              <label class="form-label" data-i18n="auth.email">Email</label>
              <input class="form-input" type="email" id="login-email" placeholder="you@example.com" autocomplete="email">
            </div>
            <div class="form-group">
              <label class="form-label" data-i18n="auth.password">Password</label>
              <div class="pw-wrap">
                <input class="form-input" type="password" id="login-password" placeholder="Your password" data-i18n-ph="auth.passwordPh" autocomplete="current-password">
                <button type="button" class="pw-toggle" data-pw="login-password" aria-label="Show password">${EYE_SVG}</button>
              </div>
            </div>
            <div class="form-group hidden" id="login-totp-group">
              <label class="form-label" data-i18n="auth.totp">Authentication code</label>
              <input class="form-input" type="text" inputmode="numeric" autocomplete="one-time-code" id="login-totp" placeholder="6-digit code" maxlength="6">
            </div>
            <div class="form-error hidden" id="login-error"></div>
            <div class="form-alt hidden" id="login-verify-note" style="margin:.1rem 0 .4rem">
              <a id="resend-verify" style="cursor:pointer;color:var(--accent)" data-i18n="auth.resend">Resend verification email</a>
            </div>
            <button class="form-submit" id="login-btn" data-i18n="nav.signin">Sign In</button>
            <p class="form-alt" style="margin-top:.6rem"><a id="go-forgot" style="cursor:pointer" data-i18n="auth.forgot">Forgot password?</a></p>
            <p class="form-alt"><span data-i18n="auth.noAccountQ">No account?</span> <a id="go-signup" data-i18n="auth.createOne">Create one</a></p>
          </div>
          <!-- Signup -->
          <div id="tab-signup" class="hidden">
            <div class="form-group">
              <label class="form-label" data-i18n="auth.fullName">Full Name</label>
              <input class="form-input" type="text" id="signup-name" placeholder="John Doe" data-i18n-ph="auth.namePh" autocomplete="name">
            </div>
            <div class="form-group">
              <label class="form-label" data-i18n="auth.email">Email</label>
              <input class="form-input" type="email" id="signup-email" placeholder="you@example.com" autocomplete="email">
            </div>
            <div class="form-group">
              <label class="form-label" data-i18n="auth.password">Password</label>
              <div class="pw-wrap">
                <input class="form-input" type="password" id="signup-password" placeholder="Min. 6 characters" data-i18n-ph="auth.pwMin" autocomplete="new-password">
                <button type="button" class="pw-toggle" data-pw="signup-password" aria-label="Show password">${EYE_SVG}</button>
              </div>
            </div>
            <div class="form-group" id="signup-role-group">
              <label class="form-label" data-i18n="auth.iam">I am a</label>
              <select class="form-select" id="signup-role">
                <option value="buyer" data-i18n="auth.buyer">Buyer</option>
                <option value="seller" data-i18n="auth.seller">Seller</option>
              </select>
            </div>
            <p class="form-alt" id="signup-role-note" style="display:none;margin:-.2rem 0 .6rem;color:var(--text2)"><span data-i18n-html="auth.roleNote">You're creating a <strong>seller</strong> account to list your car.</span> <a id="go-buyer" style="cursor:pointer" data-i18n="auth.buyInstead">Sign up to buy instead</a></p>
            <div class="form-error hidden" id="signup-error"></div>
            <button class="form-submit" id="signup-btn" data-i18n="auth.createBtn">Create Account</button>
            <p class="form-alt"><span data-i18n="auth.haveAccountQ">Already have an account?</span> <a id="go-login" data-i18n="auth.signinLink">Sign in</a></p>
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
  document.getElementById('go-forgot')?.addEventListener('click', () => { closeAuth(); window.openForgot?.(); });
  document.getElementById('auth-modal-close').addEventListener('click', () => closeAuth());
  document.getElementById('auth-modal').addEventListener('click', e => { if (e.target.id === 'auth-modal') closeAuth(); });

  // Role lock for the signup flow. Sell CTAs pass { role:'seller' } so the modal
  // opens with Seller pre-selected and the Buyer option hidden from that flow.
  function applyRoleLock(role) {
    const group = document.getElementById('signup-role-group');
    const note  = document.getElementById('signup-role-note');
    const sel   = document.getElementById('signup-role');
    const lockSeller = role === 'seller';
    if (group) group.style.display = lockSeller ? 'none' : '';
    if (note)  note.style.display  = lockSeller ? ''     : 'none';
    if (sel)   sel.value = lockSeller ? 'seller' : 'buyer';
  }
  document.getElementById('go-buyer')?.addEventListener('click', () => applyRoleLock(null));

  window.openAuth  = (tab = 'login', opts = {}) => { switchTab(tab); applyRoleLock(opts.role); document.getElementById('auth-modal').classList.add('open'); };
  window.closeAuth = () => document.getElementById('auth-modal').classList.remove('open');

  // Login
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const verifyNote = document.getElementById('login-verify-note');
    const totpGroup = document.getElementById('login-totp-group');
    const totp  = document.getElementById('login-totp').value.trim();
    errEl.classList.add('hidden'); verifyNote.classList.add('hidden');
    try {
      const data = await API.login(email, pass, totp || undefined);
      if (data.totpRequired) {
        // Admin 2FA: password OK, now collect the authenticator code.
        totpGroup.classList.remove('hidden');
        document.getElementById('login-totp').focus();
        return;
      }
      closeAuth(); toast(window.t('toast.welcomeBack', 'Welcome back! 🚗'), 'success');
      updateNavAuth(); setTimeout(() => location.reload(), 600);
    } catch(e) {
      errEl.textContent = e.message; errEl.classList.remove('hidden');
      // Unverified email → offer to resend the verification link.
      if (e.verifyRequired) verifyNote.classList.remove('hidden');
    }
  });

  // Resend the verification email for whatever address is in the login field.
  document.getElementById('resend-verify').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    if (!email) { toast(window.t('auth.enterEmail', 'Enter your email above first'), 'error'); return; }
    try {
      await API.resendVerification(email);
      document.getElementById('login-verify-note').classList.add('hidden');
      toast(window.t('toast.verifyResent', 'Verification email sent — check your inbox (and spam).'), 'success');
    } catch { toast(window.t('toast.verifyResent', 'Verification email sent — check your inbox (and spam).'), 'success'); }
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
      const data = await API.signup(name, email, pass, role);
      if (data.verifyRequired) {
        // Email driver is on → no session until they confirm via the emailed link.
        closeAuth();
        toast(window.t('toast.verifyEmail', 'Account created! Check your email to verify your address before signing in.'), 'success');
      } else {
        closeAuth(); toast(window.t('toast.accountCreated', 'Account created! Welcome to 4Kautos 🚗'), 'success');
        updateNavAuth(); setTimeout(() => location.href = '/profile.html', 800);
      }
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
document.getElementById('nav-signup-btn')?.addEventListener('click', () => openAuth('signup', { role: 'seller' }));

/* ── CHATBOT ──────────────────────────────── */
(function() {
  const QUICK = [
    'How do I buy a car?',
    'How does escrow work?',
    'What documents do I need?',
    'How to list my car?',
  ];
  // Shown instead of the generic prompts when the user is on a listing page.
  const QUICK_CAR = [
    'Tell me about this car',
    'How does the price compare?',
    'Common problems to check?',
    'Running & maintenance costs?',
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
  let carCtx     = null; // { id, label } when viewing a specific listing

  function toggleChat() {
    isOpen = !isOpen;
    fab.classList.toggle('open', isOpen);
    win.classList.toggle('open', isOpen);
    if (isOpen && msgs.children.length === 0) {
      addBotMsg(carCtx
        ? `Hi! I'm AutoBot 🚗 Ask me anything about the ${carCtx.label}: its details, whether the price looks fair, common issues to check, or running costs.`
        : "Hi! I'm AutoBot 🚗 I can help you find the perfect car, understand our buying process, or list your vehicle. What can I help you with?");
      renderQuickReplies();
    }
    if (isOpen) input.focus();
  }

  // Public hook used by the detail page: set the current car, open the panel,
  // or ask a question about it. Lets "Ask AutoBot about this car" work in 1 click.
  window.AutoBot = {
    setCar(car) {
      carCtx = car ? { id: car.id, label: car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'this car' } : null;
    },
    clearCar() { carCtx = null; },
    open() { if (!isOpen) toggleChat(); input.focus(); },
    ask(text) { if (!isOpen) toggleChat(); sendMessage(text); },
  };

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
    qrWrap.innerHTML = (carCtx ? QUICK_CAR : QUICK).map(q =>
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
      const data = await API.chat(msg, history, carCtx?.id);
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
    if (carCtx)
      return `I can't reach the server right now, so I can't pull the full write-up for the ${carCtx.label}. The listing's specs are on this page, and once I'm back online I'll add the model's reliability and running cost notes. Please try again in a moment. 🚗`;
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

/* ── DELEGATED ACTIONS (CSP: no inline handlers) ─────────────
   Inline onclick/onerror attributes are blocked once script-src drops
   'unsafe-inline', so every clickable carries data-act instead and this single
   listener dispatches it. Shared actions live here; page scripts add their own
   with Object.assign(window.ACTIONS, {...}). Handlers receive (dataset, el). */
window.ACTIONS = {
  goto:    d => { location.href = d.href; },
  auth:    d => openAuth(d.mode || 'login', d.role ? { role: d.role } : undefined),
  contact: () => openContact(),
  logout:  () => API.logout(),
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = window.ACTIONS[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  if (el.dataset.stop) e.stopPropagation();
  fn(el.dataset, el);
});
// Image fallback (replaces per-img onerror attributes). error doesn't bubble,
// so listen in the capture phase; data-felled guards a broken fallback loop.
document.addEventListener('error', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.fallback || img.dataset.felled) return;
  img.dataset.felled = '1';
  img.removeAttribute('srcset');
  img.src = img.dataset.fallback;
}, true);

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

  // Format a USD amount as a single value in the user's display currency.
  function one(amountUsd) {
    const d = display();
    return symbol(d) + fmtNum(d === 'USD' ? amountUsd : amountUsd * usdToNgn);
  }

  // Re-render every element carrying price data attributes.
  function repriceAll() {
    document.querySelectorAll('.js-price').forEach(el => {
      const amt = el.dataset.amount;
      if (amt != null && amt !== '') el.innerHTML = fmt(+amt, el.dataset.native || 'NGN');
    });
    document.querySelectorAll('.js-landed').forEach(el => {
      if (el.dataset.price == null || !window.Landed) return;
      const r = window.Landed.calc(+el.dataset.price, el.dataset.cur || 'NGN', el.dataset.loc || '');
      el.textContent = '≈ ' + one(r.totalUsd) + ' to your door';
    });
    document.querySelectorAll('.js-usd').forEach(el => {
      if (el.dataset.usd != null) el.textContent = one(+el.dataset.usd);
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

  return { fmt, one, repriceAll, load, toggle, display, get usdToNgn() { return usdToNgn; } };
})();
window.Money = Money;

/* ── LANDED COST (price + Nigerian import duty + shipping) ── */
const Landed = (function () {
  // Effective import charges (% of CIF) by destination. The pct values here are
  // an offline fallback only — hydrate() refreshes them from the authoritative
  // GET /clearance/destinations on boot, so the card estimates can't silently
  // drift from the backend's duty model. Aliases stay client-side (used to map a
  // free-text location string to a country; the API doesn't carry them).
  const DEST = {
    'Nigeria': { pct: 48, aliases: ['nigeria', 'lagos', 'abuja', 'kano', 'ibadan', 'port harcourt', 'benin city', 'enugu'] },
    'Ghana':   { pct: 35, aliases: ['ghana', 'accra', 'kumasi', 'tema'] },
    'Togo':    { pct: 30, aliases: ['togo', 'lome', 'lomé'] },
    'Benin':   { pct: 30, aliases: ['benin', 'cotonou'] },
    "Côte d'Ivoire": { pct: 35, aliases: ['côte', 'cote d', 'ivoire', 'abidjan', 'ivory coast'] },
    'Cameroon': { pct: 35, aliases: ['cameroon', 'douala', 'yaound'] },
    'Senegal': { pct: 40, aliases: ['senegal', 'dakar'] },
  };
  // Refresh pct values from the backend (fallback stays if the call fails).
  async function hydrate() {
    try {
      const rows = await API.getDestinations();
      if (!Array.isArray(rows)) return;
      let changed = false;
      for (const d of rows) {
        const pct = Number(d.effectiveDutyPct);
        if (DEST[d.country] && Number.isFinite(pct) && DEST[d.country].pct !== pct) {
          DEST[d.country].pct = pct; changed = true;
        }
      }
      if (changed) Money.repriceAll?.(); // re-render any landed figures already on the page
    } catch { /* offline / endpoint down → keep the fallback pcts */ }
  }
  function country(loc) {
    const s = (loc || '').toLowerCase();
    for (const [c, d] of Object.entries(DEST)) if (d.aliases.some(a => s.includes(a))) return c;
    return s.trim() ? 'International' : 'Nigeria';
  }
  const dutyPct = c => DEST[c]?.pct ?? 40;
  // RoRo shipping by origin region (USD); 0 when the car is already in the buyer's country.
  function shippingUsd(originLoc, destCountry) {
    if (country(originLoc) === destCountry) return 0;
    const s = (originLoc || '').toLowerCase();
    if (/uk|united kingdom|england|germany|france|belgium|netherlands|spain|italy|poland|europe/.test(s)) return 1600;
    if (/uae|dubai|qatar|saudi|japan|korea|china|india|singapore|asia/.test(s)) return 2100;
    if (/usa|united states|canada|america|, ca|, tx|, ga|, ny|, fl|, nj/.test(s)) return 1900;
    if (/ghana|togo|benin|cameroon|niger|chad|nigeria|senegal|ivoire|ivory|africa/.test(s)) return 850;
    return 1850;
  }
  function buyerLocation() { try { return API.getUser()?.location || ''; } catch { return ''; } }
  function calc(price, currency, originLocation, destLocation) {
    const rate = Money.usdToNgn || 1600;
    const priceUsd = currency === 'USD' ? Number(price) : Number(price) / rate;
    const destCountry = country(destLocation != null ? destLocation : buyerLocation());
    const ship = shippingUsd(originLocation, destCountry);
    const inCountry = ship === 0;
    const duty = inCountry ? 0 : priceUsd * dutyPct(destCountry) / 100;
    const totalUsd = priceUsd + duty + ship;
    return { priceUsd, dutyUsd: duty, shippingUsd: ship, totalUsd, totalNgn: totalUsd * rate, inCountry, destCountry };
  }
  return { calc, dutyPct, shippingUsd, country, hydrate };
})();
window.Landed = Landed;

/* ── SHARED CAR CARD ──────────────────────── */
/* ── BODY-TYPE ICONS — a distinct line-art silhouette per type ── */
const _veh = roof => `<svg viewBox="0 0 48 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19V15q0-2 3-2h36q3 0 3 2v4"/>${roof}<circle cx="14" cy="20" r="3.2"/><circle cx="34" cy="20" r="3.2"/></svg>`;
const BODY_ICONS = {
  Sedan:       _veh('<path d="M12 13 16 8h14l4 5"/>'),
  SUV:         _veh('<path d="M11 13 13 6h20l2 7"/>'),
  Crossover:   _veh('<path d="M11 13 13 6h20l2 7"/>'),
  Hatchback:   _veh('<path d="M12 13 16 8h11l5 5"/>'),
  Coupe:       _veh('<path d="M13 13q7-7 15-6 4 1 6 6"/>'),
  Pickup:      _veh('<path d="M12 13 15 8h8l1 5"/><path d="M24 13v-2h16"/>'),
  Convertible: _veh('<path d="M14 13 18 9l2 4"/>'),
  Wagon:       _veh('<path d="M12 13 15 7h20l2 6"/>'),
  Van:         _veh('<path d="M7 13 9 6h30l2 6"/>'),
  Minivan:     _veh('<path d="M8 13 11 6h26l3 6"/>'),
};
window.bodyIcon = t => BODY_ICONS[t] || _veh('<path d="M12 13 16 8h14l4 5"/>');

/* Build a srcset from a responsive _1600.webp URL (no-op for legacy single URLs). */
window.imgSrcset = function (url) {
  if (typeof url !== 'string' || !/_1600\.webp$/.test(url)) return '';
  const b = url.replace(/_1600\.webp$/, '');
  return `${b}_400.webp 400w, ${b}_800.webp 800w, ${b}_1600.webp 1600w`;
};

// Shimmer placeholders shown in a .cars-grid while real cards load (perceived speed).
window.skeletonCards = function (n = 8) {
  const one = `<div class="skel-card"><div class="skeleton skel-img"></div><div class="skeleton skel-line lg"></div><div class="skeleton skel-line"></div><div class="skeleton skel-line sm"></div></div>`;
  return one.repeat(n);
};

window.carCard = function (c) {
  const T = (k, f) => (window.t ? window.t(k, f) : f);   // current-lang label (re-switched via data-i18n)
  const native = c.currency || 'NGN';
  const img = c.photos?.[0] || `https://placehold.co/600x400/12121f/8b7cff?text=${encodeURIComponent(c.make || 'Car')}`;
  const saved = API.isSaved(c.id);
  const title = c.title || `${c.year || ''} ${c.make || ''} ${c.model || ''}`.trim();
  const badge = c.featured ? `<span class="card-badge featured" data-i18n="card.featured">${esc(T('card.featured', 'Featured'))}</span>`
              : (c.condition === 'excellent' ? `<span class="card-badge new" data-i18n="card.excellent">${esc(T('card.excellent', 'Excellent'))}</span>` : '');
  const priceHtml = (c.price != null && c.price !== '')
    ? `<div class="card-price js-price" data-amount="${esc(c.price)}" data-native="${esc(native)}">${Money.fmt(c.price, native)}</div>`
    : `<div class="card-price">Price on Request</div>`;

  const landed = (c.price != null && c.price !== '') ? Landed.calc(c.price, native, c.location) : null;
  const landedHtml = !landed ? ''
    : landed.inCountry
      ? `<div class="card-landed in-country">✓ Already in ${esc(landed.destCountry)}</div>`
      : `<div class="card-landed js-landed" data-price="${esc(c.price)}" data-cur="${esc(native)}" data-loc="${esc(c.location || '')}">≈ ${Money.one(landed.totalUsd)} to your door</div>`;
  // One quiet meta line under the title (year · mileage · gearbox/condition ·
  // location) instead of stacked rows, so the card scans in a glance.
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const metaLine = [
    c.year,
    c.mileage ? `${Number(c.mileage).toLocaleString()} km` : null,
    c.transmission || (c.condition ? cap(c.condition) : null),
    c.location,
  ].filter(Boolean).map(v => esc(v)).join(' · ');
  // Price-evaluator badge (only the meaningful verdicts — 'fair' stays unmarked).
  const VEVAL = { great: 'Great price', good: 'Good price', high: 'Above market' };
  const vv = c.valuation && c.valuation.verdict;
  const evalHtml = (vv && VEVAL[vv]) ? `<span class="price-eval eval-${vv}" title="vs. ${c.valuation.sampleSize || 0} similar listings">${VEVAL[vv]}</span>` : '';

  return `
    <div class="car-card reveal" data-id="${esc(c.id)}" tabindex="0" role="link" aria-label="${esc(title)}">
      <div class="card-img-wrap">
        <img class="card-img" src="${esc(img)}"${window.imgSrcset(img) ? ` srcset="${esc(window.imgSrcset(img))}" sizes="(max-width:640px) 100vw, 340px"` : ''} alt="${esc(title)}" loading="lazy" data-fallback="https://placehold.co/600x400/12121f/8b7cff?text=No+Photo">
        <div class="card-badges">
          ${c.body_type ? `<span class="card-type">${window.bodyIcon(c.body_type)}${esc(c.body_type)}</span>` : ''}
          ${badge}
        </div>
        <button class="card-saves ${saved ? 'saved' : ''}" title="Save" data-save="${esc(c.id)}">${saved ? '♥' : '♡'}</button>
      </div>
      <div class="card-body">
        <div class="card-title">${esc(title)}</div>
        ${metaLine ? `<div class="card-meta">${metaLine}</div>` : ''}
        ${c.seller?.verified ? `<div class="card-verified" title="Identity-verified seller"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5z"/><path d="m9 12 2 2 4-4"/></svg><span data-i18n="card.verified">${esc(T('card.verified', 'Verified seller'))}</span></div>` : ''}
        <div class="card-footer">
          <div class="card-price-wrap">
            ${priceHtml}
            ${evalHtml}
            ${landedHtml}
          </div>
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
// Keyboard access: cards are focusable "links" — Enter opens them.
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const card = e.target.closest?.('.car-card');
  if (card && card.dataset.id) location.href = `detail.html?id=${card.dataset.id}`;
});

// Server-synced hearts: merge on load, repaint rendered save buttons after.
window.addEventListener('saved-sync', () => {
  document.querySelectorAll('.card-saves').forEach(b => {
    const on = API.isSaved(b.dataset.save);
    b.classList.toggle('saved', on);
    b.textContent = on ? '♥' : '♡';
  });
});
if (API.isLoggedIn()) API.syncSaved();

/* ── BRAND STRIP (shop by brand) ──────────── */
// Logos via simple-icons CDN with a monogram fallback when a logo is missing.
// simple-icons doesn't host Mercedes-Benz or Lexus — supply inline currentColor marks.
const BRAND_SVG = {
  'Mercedes-Benz': `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="20"/><path d="M24 24V4.5M24 24 7.3 33.6M24 24l16.7 9.6"/></svg>`,
  'Lexus': `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="24" cy="24" rx="21" ry="13.5"/><path d="M18.6 15.5V31H30"/></svg>`,
};
const BRANDS = [
  { name: 'Toyota', slug: 'toyota' }, { name: 'Honda', slug: 'honda' },
  { name: 'BMW', slug: 'bmw' }, { name: 'Mercedes-Benz' },
  { name: 'Ford', slug: 'ford' }, { name: 'Hyundai', slug: 'hyundai' },
  { name: 'Kia', slug: 'kia' }, { name: 'Lexus' },
  { name: 'Nissan', slug: 'nissan' }, { name: 'Volkswagen', slug: 'volkswagen' },
  { name: 'Audi', slug: 'audi' }, { name: 'Mazda', slug: 'mazda' },
  { name: 'Tesla', slug: 'tesla' }, { name: 'Porsche', slug: 'porsche' },
  { name: 'Subaru', slug: 'subaru' }, { name: 'Jeep', slug: 'jeep' },
  { name: 'Chevrolet', slug: 'chevrolet' }, { name: 'Volvo', slug: 'volvo' },
  { name: 'Peugeot', slug: 'peugeot' }, { name: 'Mitsubishi', slug: 'mitsubishi' },
  { name: 'Suzuki', slug: 'suzuki' }, { name: 'Renault', slug: 'renault' },
  { name: 'Mini', slug: 'mini' }, { name: 'Acura', slug: 'acura' },
  { name: 'Infiniti', slug: 'infiniti' }, { name: 'Fiat', slug: 'fiat' },
];

// Make → popular models, powering the cascading Model dropdown in search/intake.
// Not exhaustive — every field also accepts a free-typed "Other" value.
window.MAKE_MODELS = {
  'Toyota': ['Corolla','Camry','RAV4','Highlander','Hilux','Land Cruiser','Prado','Avalon','Yaris','Sienna','Tacoma','4Runner','Venza'],
  'Honda': ['Civic','Accord','CR-V','Pilot','HR-V','Odyssey','City','Fit','Ridgeline'],
  'Ford': ['Focus','Fiesta','Fusion','Escape','Explorer','Edge','F-150','Mustang','Ranger','Expedition'],
  'BMW': ['1 Series','3 Series','5 Series','7 Series','X1','X3','X5','X6','M3','M5'],
  'Mercedes-Benz': ['A-Class','C-Class','E-Class','S-Class','CLA','GLA','GLC','GLE','GLS','G-Class'],
  'Hyundai': ['i10','Accent','Elantra','Sonata','Creta','Tucson','Santa Fe','Palisade','Veloster'],
  'Kia': ['Picanto','Rio','Cerato','Optima','Soul','Seltos','Sportage','Sorento','Telluride'],
  'Lexus': ['IS','ES','GS','LS','UX','NX','RX','GX','LX'],
  'Nissan': ['Versa','Sentra','Altima','Maxima','Rogue','X-Trail','Murano','Pathfinder','Patrol','Frontier'],
  'Volkswagen': ['Polo','Golf','Jetta','Passat','Beetle','Tiguan','Touareg','Atlas'],
  'Audi': ['A3','A4','A6','A8','Q3','Q5','Q7','Q8','TT','R8'],
  'Mazda': ['Mazda3','Mazda6','CX-3','CX-30','CX-5','CX-9','MX-5 Miata'],
  'Tesla': ['Model 3','Model S','Model X','Model Y','Cybertruck'],
  'Porsche': ['911','718 Cayman','718 Boxster','Panamera','Macan','Cayenne','Taycan'],
  'Subaru': ['Impreza','Legacy','Outback','Forester','Crosstrek','WRX','Ascent'],
  'Jeep': ['Renegade','Compass','Cherokee','Grand Cherokee','Wrangler','Gladiator'],
  'Chevrolet': ['Spark','Cruze','Malibu','Impala','Camaro','Corvette','Equinox','Traverse','Tahoe','Suburban','Silverado'],
  'Volvo': ['S60','S90','V60','V90','XC40','XC60','XC90'],
  'Peugeot': ['208','308','408','508','2008','3008','5008'],
  'Mitsubishi': ['Mirage','Lancer','ASX','Eclipse Cross','Outlander','Pajero','L200'],
  'Suzuki': ['Alto','Swift','Baleno','Ciaz','Jimny','Vitara','S-Cross'],
  'Renault': ['Clio','Megane','Logan','Captur','Duster','Kadjar','Koleos'],
  'Mini': ['Cooper','Clubman','Countryman','Paceman'],
  'Acura': ['ILX','TLX','RLX','RDX','MDX','NSX'],
  'Infiniti': ['Q50','Q60','Q70','QX50','QX60','QX80'],
  'Fiat': ['500','Panda','Punto','Tipo','500L','500X'],
  'GMC': ['Terrain','Acadia','Yukon','Canyon','Sierra'],
  'Jaguar': ['XE','XF','XJ','E-Pace','F-Pace','F-Type'],
  'Land Rover': ['Defender','Discovery','Range Rover Evoque','Range Rover Velar','Range Rover Sport','Range Rover'],
  'Ferrari': ['Portofino','Roma','488','F8 Tributo','812','SF90'],
};
// Build/refresh a <datalist> of models for the given make (free text still allowed).
window.fillModelList = function (make, datalistEl) {
  if (!datalistEl) return;
  const models = window.MAKE_MODELS[(make || '').trim()] || [];
  datalistEl.innerHTML = models.map(m => `<option value="${m.replace(/"/g, '&quot;')}"></option>`).join('');
};
// Three-dot "Other" glyph → routes to the full listings page (any make, incl.
// unlisted ones via the search box there).
const OTHER_TILE = `<a class="brand-tile brand-tile-other" href="listings.html" title="Browse every make">
    <span class="brand-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg></span>
    <span class="brand-name">Other</span></a>`;

window.renderBrandStrip = function (selector) {
  const host = document.querySelector(selector);
  if (!host) return;
  // Listings page uses a compact horizontal scroller (.brand-strip-sm) — show all
  // there. The home grid caps the list behind a "Show more" toggle.
  const compact = host.classList.contains('brand-strip-sm');
  const INITIAL = 12;
  let expanded = false;

  const tile = (b, col) => {
    const logo = BRAND_SVG[b.name]
      ? `<span class="brand-logo">${BRAND_SVG[b.name]}</span>`
      : `<span class="brand-logo"><img src="https://cdn.simpleicons.org/${b.slug}/${col}" alt="${esc(b.name)} logo" loading="lazy"></span>`;
    return `<a class="brand-tile" href="listings.html?make=${encodeURIComponent(b.name)}" title="${esc(b.name)} for sale">${logo}<span class="brand-name">${esc(b.name)}</span></a>`;
  };

  // Colour the CDN icons to match the theme text so they never fade into the tile.
  function render() {
    const col = document.documentElement.getAttribute('data-theme') === 'light' ? '4b4b66' : 'a6a6c6';
    const list = (compact || expanded) ? BRANDS : BRANDS.slice(0, INITIAL);
    let html = list.map(b => tile(b, col)).join('') + OTHER_TILE;
    if (!compact && BRANDS.length > INITIAL) {
      html += `<button type="button" class="brand-more" aria-expanded="${expanded}">${expanded ? 'Show less ▲' : `Show ${BRANDS.length - INITIAL} more ▾`}</button>`;
    }
    host.innerHTML = html;
    const btn = host.querySelector('.brand-more');
    if (btn) btn.onclick = () => { expanded = !expanded; render(); };
  }
  render();
  document.addEventListener('themechange', render); // recolour CDN icons on theme switch
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
    <a href="index.html" data-i18n="nav.home">Home</a>
    <a href="listings.html" data-i18n="nav.listings">Listings</a>
    <a href="clearance.html" data-i18n="footer.clearance">Customs Clearance</a>
    <a href="index.html#how-it-works" data-i18n="nav.how">How It Works</a>
    <div class="mobile-menu-divider"></div>
    <button class="mm-currency" type="button">Currency: <strong class="js-cur-label">NGN</strong> · tap to switch</button>
    <a href="profile.html" id="mm-dashboard" class="hidden" data-i18n="nav.dashboard">My Dashboard</a>
    <button id="mm-login" type="button" data-i18n="nav.signin">Sign In</button>
    <a href="#" id="mm-signup" data-i18n="nav.sell">List Your Car</a>
    <button id="mm-logout" type="button" class="hidden mm-danger" data-i18n="nav.signout">Sign Out</button>`;
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
  drawer.querySelector('#mm-signup').addEventListener('click', e => { e.preventDefault(); setMenu(false); openAuth('signup', { role: 'seller' }); });
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

/* ── THEME (light / dark) ─────────────────── */
(function () {
  const STORAGE = '4k_theme';
  const ICON_SUN  = `<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
  const ICON_MOON = `<svg class="icon-moon" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`;

  const current = () => document.documentElement.getAttribute('data-theme') || 'light';
  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(STORAGE, t); } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#f5f6fc' : '#08080f');
    document.querySelectorAll('.mm-theme strong').forEach(el => el.textContent = t === 'light' ? 'Light' : 'Dark');
    document.dispatchEvent(new Event('themechange'));
  }
  const toggle = () => apply(current() === 'dark' ? 'light' : 'dark');
  window.toggleTheme = toggle;

  // Desktop: a sun/moon button in the nav actions.
  document.querySelectorAll('.navbar .nav-actions').forEach(actions => {
    if (actions.querySelector('.theme-toggle')) return;
    const btn = document.createElement('button');
    btn.className = 'theme-toggle'; btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle light / dark theme');
    btn.innerHTML = ICON_SUN + ICON_MOON;
    actions.insertBefore(btn, actions.querySelector('.cur-toggle') || actions.querySelector('.nav-hamburger') || null);
    btn.addEventListener('click', toggle);
  });

  // Mobile drawer entry.
  const drawer = document.querySelector('.mobile-menu');
  if (drawer && !drawer.querySelector('.mm-theme')) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mm-theme';
    b.innerHTML = `Theme: <strong>${current() === 'light' ? 'Light' : 'Dark'}</strong> · tap to switch`;
    const cur = drawer.querySelector('.mm-currency');
    if (cur) cur.after(b); else drawer.appendChild(b);
    b.addEventListener('click', toggle);
  }
  apply(current());
})();

/* ── SHARED CAR-OUTLINE FOOTER ────────────── */
/* ── CONTACT MODAL ("Send us a message") ── */
(function () {
  if (document.getElementById('contact-modal')) return;
  const html = `
    <div class="modal-overlay" id="contact-modal">
      <div class="modal">
        <div class="modal-head">
          <h2 data-i18n="contact.title">Send us a message</h2>
          <button class="modal-close" id="contact-modal-close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="color:var(--text2);font-size:.88rem;margin:0 0 1rem" data-i18n="contact.intro">Questions, feedback, or help with a listing. We'll get back to you by email.</p>
          <div class="form-group"><label class="form-label" data-i18n="contact.name">Your name</label><input class="form-input" id="ct-name" autocomplete="name"></div>
          <div class="form-group"><label class="form-label" data-i18n="auth.email">Email</label><input class="form-input" type="email" id="ct-email" placeholder="you@example.com" autocomplete="email"></div>
          <div class="form-group"><label class="form-label" data-i18n="contact.message">Message</label><textarea class="form-input" id="ct-msg" rows="4" placeholder="How can we help?" data-i18n-ph="contact.msgPh" style="resize:vertical"></textarea></div>
          <input type="text" id="ct-hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
          <div class="form-error hidden" id="ct-error"></div>
          <button class="form-submit" id="ct-submit" data-i18n="contact.send">Send message</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const modal = document.getElementById('contact-modal');
  const close = () => modal.classList.remove('open');
  window.openContact = () => {
    const u = API.getUser?.();
    if (u) { const n = document.getElementById('ct-name'), e = document.getElementById('ct-email'); if (!n.value) n.value = u.name || ''; if (!e.value) e.value = u.email || ''; }
    modal.classList.add('open');
  };
  document.getElementById('contact-modal-close').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.getElementById('ct-submit').addEventListener('click', async () => {
    const name = document.getElementById('ct-name').value.trim();
    const email = document.getElementById('ct-email').value.trim();
    const message = document.getElementById('ct-msg').value.trim();
    const website = document.getElementById('ct-hp').value;
    const err = document.getElementById('ct-error');
    err.classList.add('hidden');
    if (!name || !email || !message) { err.textContent = window.t('contact.fillAll', 'Please fill in your name, email and message.'); err.classList.remove('hidden'); return; }
    const btn = document.getElementById('ct-submit'); btn.disabled = true; const o = btn.textContent; btn.textContent = window.t('contact.sending', 'Sending…');
    try {
      await API.sendContact({ name, email, message, website });
      toast(window.t('toast.contactSent', "Message sent. We'll be in touch ✉️"), 'success');
      ['ct-name', 'ct-email', 'ct-msg'].forEach(id => document.getElementById(id).value = '');
      close();
    } catch (e) { err.textContent = e.message || 'Could not send your message'; err.classList.remove('hidden'); }
    finally { btn.disabled = false; btn.textContent = o; }
  });
})();

/* ── FORGOT-PASSWORD MODAL ── */
(function () {
  if (document.getElementById('forgot-modal')) return;
  const html = `
    <div class="modal-overlay" id="forgot-modal">
      <div class="modal">
        <div class="modal-head">
          <h2 data-i18n="forgot.title">Reset your password</h2>
          <button class="modal-close" id="forgot-close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="color:var(--text2);font-size:.88rem;margin:0 0 1rem" data-i18n="forgot.intro">Enter your account email and we'll send a reset link.</p>
          <div class="form-group"><label class="form-label" data-i18n="auth.email">Email</label><input class="form-input" type="email" id="fp-email" placeholder="you@example.com" autocomplete="email"></div>
          <div class="form-error hidden" id="fp-error"></div>
          <div class="hidden" id="fp-ok" style="color:var(--accent);font-size:.85rem;margin-bottom:.6rem"></div>
          <button class="form-submit" id="fp-submit" data-i18n="forgot.send">Send reset link</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const modal = document.getElementById('forgot-modal');
  const close = () => modal.classList.remove('open');
  window.openForgot = () => { document.getElementById('fp-ok').classList.add('hidden'); document.getElementById('fp-error').classList.add('hidden'); modal.classList.add('open'); };
  document.getElementById('forgot-close').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.getElementById('fp-submit').addEventListener('click', async () => {
    const email = document.getElementById('fp-email').value.trim();
    const err = document.getElementById('fp-error'), ok = document.getElementById('fp-ok');
    err.classList.add('hidden'); ok.classList.add('hidden');
    if (!email) { err.textContent = 'Enter your email.'; err.classList.remove('hidden'); return; }
    const btn = document.getElementById('fp-submit'); btn.disabled = true; const o = btn.textContent; btn.textContent = 'Sending…';
    try {
      const r = await API.forgotPassword(email);
      ok.textContent = r.message || "If that email has an account, a reset link is on its way.";
      ok.classList.remove('hidden');
    } catch (e) { err.textContent = e.message || 'Something went wrong'; err.classList.remove('hidden'); }
    finally { btn.disabled = false; btn.textContent = o; }
  });
})();

(function () {
  if (document.querySelector('.site-footer')) return;
  const year = new Date().getFullYear();
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  const SOC = {
    wa: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 18.1a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.1 8.1 0 1 1 12 20.1zm4.5-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.1-.3.2-.5 0a6.6 6.6 0 0 1-3.3-2.8c-.2-.4.2-.4.5-1.2.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.2.9 2.4 1 2.6.1.2 1.7 2.7 4.2 3.8 2.5 1.1 2.5.7 3 .7.5 0 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.2 0-.1-.2-.1-.5-.3z"/></svg>`,
    ig: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/></svg>`,
    fb: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7H16l.5-3h-3V9c0-.8.3-1.3 1.4-1.3H17V5.1C16.6 5 15.6 5 14.8 5c-2 0-3.3 1.2-3.3 3.5V11H9v3h2.5v7h2z"/></svg>`,
    tt: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 4c.4 2 1.8 3.5 3.8 3.8v3c-1.4 0-2.7-.4-3.8-1.1V15a5.5 5.5 0 1 1-5.5-5.5c.3 0 .6 0 .9.1v3.1a2.4 2.4 0 1 0 1.7 2.3V4H16z"/></svg>`,
    x:  `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3l-6.6 7.5L21.6 21h-5.5l-4.2-5.5L7.1 21H4l7.1-8.1L3.4 3H9l3.8 5L17.5 3z"/></svg>`,
  };
  const APPLE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.7 3c.1 1-.3 1.9-.9 2.6-.6.7-1.6 1.2-2.5 1.1-.1-.9.3-1.9.9-2.5.6-.7 1.7-1.2 2.5-1.2zM19 17.2c-.5 1.1-.7 1.6-1.3 2.6-.9 1.3-2.2 3-3.8 3-1.4 0-1.8-.9-3.7-.9s-2.3.9-3.7.9c-1.6 0-2.7-1.5-3.7-2.8C-.7 16-1 10.2 2.5 8.4c1.2-.6 2.2-.3 3.2-.3 1.1 0 1.8.3 2.9.3.9 0 1.6-.4 2.9-.4.8 0 1.8.2 2.6.7-2.3 1.4-1.9 4.7.4 5.7z"/></svg>`;
  const PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 3.2v17.6c0 .5.5.8 1 .6l13-8.8c.5-.3.5-1 0-1.3L5 2.6c-.5-.3-1 0-1 .6z"/></svg>`;

  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-grid">
        <div class="footer-brand">
          <a href="index.html" class="nav-logo" style="display:inline-flex;margin-bottom:.6rem"></a>
          <p data-i18n="footer.tagline">A global preowned-car marketplace. Buy verified vehicles from international sellers, with customs clearance and delivery handled across Nigeria.</p>
          <div class="footer-social">
            <a href="#" aria-label="WhatsApp">${SOC.wa}</a>
            <a href="#" aria-label="Instagram">${SOC.ig}</a>
            <a href="#" aria-label="TikTok">${SOC.tt}</a>
            <a href="#" aria-label="X">${SOC.x}</a>
          </div>
          <div class="app-badges">
            <a href="#" class="app-badge">${APPLE}<span>Download on the<br></span><b>App Store</b></a>
            <a href="#" class="app-badge">${PLAY}<span>Get it on<br></span><b>Google Play</b></a>
          </div>
        </div>
        <div class="footer-col">
          <h5 data-i18n="footer.buy">Buy</h5>
          <a href="listings.html" data-i18n="footer.browse">Browse Listings</a>
          <a href="listings.html?condition=excellent" data-i18n="footer.premium">Premium Cars</a>
          <a href="clearance.html" data-i18n="footer.clearance">Customs Clearance</a>
          <a href="index.html#how-it-works" data-i18n="nav.how">How It Works</a>
        </div>
        <div class="footer-col">
          <h5 data-i18n="footer.sell">Sell</h5>
          <a href="#" data-act="auth" data-mode="signup" data-role="seller" data-i18n="nav.sell">List Your Car</a>
          <a href="profile.html" data-i18n="footer.dashboard">Seller Dashboard</a>
          <a href="profile.html" data-i18n="footer.photoguide">Photo Guide</a>
          <a href="clearance.html" data-i18n="footer.shipping">Shipping &amp; Clearance</a>
        </div>
        <div class="footer-col">
          <h5 data-i18n="footer.company">Company</h5>
          <a href="about.html" data-i18n="footer.about">About Us</a>
          <a href="community.html" data-i18n="footer.community">Community</a>
          <a href="#" data-i18n="footer.careers">Careers</a>
          <a href="#" data-i18n="footer.blog">The 4K Blog</a>
        </div>
        <div class="footer-col">
          <h5 data-i18n="footer.support">Support</h5>
          <a href="#" data-act="contact" data-i18n="footer.help">Help Center</a>
          <a href="#" data-i18n="footer.faqs">FAQs</a>
          <a href="#" data-act="contact" data-i18n="footer.contact">Contact Us</a>
          <a href="#" data-i18n="footer.tos">Terms of Service</a>
          <a href="#" data-i18n="footer.privacy">Privacy Policy</a>
        </div>
      </div>

      <div class="footer-bottom">
        <span>© <span class="js-year">${year}</span> <span data-i18n="footer.rights">4Kautos. All rights reserved.</span></span>
        <span class="footer-legal"><a href="#" data-i18n="footer.terms_s">Terms</a> · <a href="#" data-i18n="footer.privacy_s">Privacy</a> · <a href="#" data-i18n="footer.donotsell">Do Not Sell My Info</a></span>
      </div>
    </div>`;
  // Newsletter band — its own section just above the footer (was buried inside it).
  const newsBand = document.createElement('section');
  newsBand.className = 'newsletter-band';
  newsBand.innerHTML = `
    <div class="newsletter-inner">
      <div class="newsletter-copy">
        <h3 data-i18n="newsletter.title">Get the weekly drop</h3>
        <p data-i18n="newsletter.sub">New arrivals &amp; price moves, straight to your inbox.</p>
      </div>
      <div class="newsletter-form-wrap">
        <form class="news-form" id="news-form" novalidate>
          <input type="email" id="news-email" placeholder="you@example.com" data-i18n-ph="newsletter.email_ph" autocomplete="email" aria-label="Email address">
          <button type="submit" data-i18n="newsletter.btn">Subscribe</button>
        </form>
        <div class="news-note" id="news-note"></div>
      </div>
    </div>`;
  document.body.appendChild(newsBand);
  document.body.appendChild(footer);
  window.applyI18n?.(newsBand);   // translate the just-injected band
  // Populate the footer logo (the page-load logo pass already ran).
  const navLogo = document.querySelector('.navbar .nav-logo');
  const fLogo = footer.querySelector('.nav-logo');
  if (navLogo && fLogo) fLogo.innerHTML = navLogo.innerHTML;

  // Newsletter subscribe (capture; sending wired separately)
  newsBand.querySelector('#news-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = newsBand.querySelector('#news-email').value.trim();
    const note = newsBand.querySelector('#news-note');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { note.className = 'news-note bad'; note.textContent = 'Enter a valid email address.'; return; }
    note.className = 'news-note'; note.textContent = 'Subscribing…';
    try {
      await API.subscribe(email);
      note.className = 'news-note ok'; note.textContent = "✓ You're in. Watch your inbox.";
      newsBand.querySelector('#news-form').reset();
    } catch (err) {
      note.className = 'news-note bad'; note.textContent = err.message || 'Could not subscribe right now.';
    }
  });
})();

/* ── SCROLL REVEAL ────────────────────────── */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js-reveal');
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  const observe = (root = document) => root.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el));
  window.observeReveals = observe;

  const tagStatic = () => document.querySelectorAll('section:not(.hero), .step-card, .panel, .agent-card, .footer-col, .brand-tile')
    .forEach(el => el.classList.add('reveal'));
  document.addEventListener('DOMContentLoaded', () => { tagStatic(); observe(); });

  // Cards added later (carCard already carries .reveal) — observe them as they appear.
  const mo = new MutationObserver(muts => {
    let found = false;
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.classList?.contains('reveal') || n.querySelector?.('.reveal:not(.in)')) found = true;
    }
    if (found) observe();
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();

/* ── COUNT-UP (hero stats) ────────────────── */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  function run(el) {
    const m = el.textContent.trim().match(/^(\D*)(\d[\d,]*)(.*)$/);
    if (!m) return;
    const prefix = m[1], target = parseInt(m[2].replace(/,/g, ''), 10), suffix = m[3];
    if (!target) return;
    const dur = 1100, t0 = performance.now();
    (function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = prefix + Math.round((1 - Math.pow(1 - p, 3)) * target).toLocaleString('en-US') + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
  }, { threshold: 0.6 });
  document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('.hero-stat-n').forEach(el => io.observe(el)));
})();

/* ── CUSTOM CURSOR: dashboard caution triangle ─ */
(function () {
  // Mouse devices only — never hijack the cursor on touch/coarse pointers.
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const el = document.createElement('div');
  el.className = 'cursor-warn' + (reduce ? ' no-flicker' : '');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="cwGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b7cff"/><stop offset="1" stop-color="#22d3ee"/>
    </linearGradient></defs>
    <g class="cursor-ico">
      <path d="M14 3.4 L25.2 22.8 a1.7 1.7 0 0 1-1.5 2.6 H4.3 a1.7 1.7 0 0 1-1.5-2.6 Z" fill="url(#cwGrad)" stroke="#0b0b14" stroke-width="1.1" stroke-linejoin="round"/>
      <rect x="12.8" y="10.4" width="2.4" height="6.6" rx="1.2" fill="#0b0b14"/>
      <circle cx="14" cy="20.3" r="1.5" fill="#0b0b14"/>
    </g></svg>`;
  document.body.appendChild(el);
  document.documentElement.classList.add('has-cursor-warn');

  const INTERACTIVE = 'a,button,[role="button"],input,select,textarea,.car-card,.brand-tile,.modal-tab,.gallery-thumb,.quick-reply,label,.theme-toggle,.cur-toggle';
  addEventListener('mousemove', e => {
    el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    if (!el.classList.contains('on')) el.classList.add('on');
  }, { passive: true });
  addEventListener('mouseover', e => {
    el.classList.toggle('active', !!(e.target.closest && e.target.closest(INTERACTIVE)));
  }, { passive: true });
  addEventListener('mouseout', e => { if (!e.relatedTarget) el.classList.remove('on'); });
  addEventListener('mousedown', () => el.classList.add('press'));
  addEventListener('mouseup',   () => el.classList.remove('press'));
})();

/* ── REALTIME (Socket.IO) ─────────────────── */
// Shared, lazily-connected socket. Loads the client from CDN on first use and
// authenticates with the JWT. If anything fails (offline, CDN blocked, logged
// out) callers simply keep their polling fallback — nothing breaks.
window.RT = (function () {
  let socket = null, connecting = null;
  const handlers = {};

  function loadClient() {
    if (window.io) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function connect() {
    if (socket) return Promise.resolve(socket);
    if (connecting) return connecting;
    if (!API.isLoggedIn()) return Promise.resolve(null);
    connecting = loadClient().then(() => {
      const origin = API.origin();
      socket = origin ? io(origin, { auth: { token: API.token() }, transports: ['websocket','polling'] })
                      : io({ auth: { token: API.token() }, transports: ['websocket','polling'] });
      socket.on('message', d => (handlers.message || []).forEach(fn => fn(d)));
      socket.on('unread',  d => (handlers.unread  || []).forEach(fn => fn(d)));
      return socket;
    }).catch(() => null);
    return connecting;
  }

  return {
    connect,
    on(event, fn) { (handlers[event] || (handlers[event] = [])).push(fn); },
    emit(event, data) { if (socket) socket.emit(event, data); },
  };
})();

/* ── BUYER ↔ SELLER CHAT (thread slide-over) ─ */
(function () {
  const panel = document.createElement('div');
  panel.className = 'thread-overlay';
  panel.id = 'thread-overlay';
  panel.innerHTML = `
    <div class="thread-panel">
      <div class="thread-head">
        <div><div class="thread-title" id="thread-title">Conversation</div><div class="thread-sub" id="thread-sub"></div></div>
        <button class="thread-close" id="thread-close" aria-label="Close">✕</button>
      </div>
      <div class="thread-msgs" id="thread-msgs"></div>
      <div class="thread-input-row">
        <textarea class="thread-input" id="thread-input" rows="1" placeholder="Write a message…"></textarea>
        <button class="thread-send" id="thread-send">Send</button>
      </div>
    </div>`;
  document.body.appendChild(panel);

  const state = { carId: null, buyerId: null, poll: null };
  const $ = id => document.getElementById(id);

  function render(messages) {
    const me = API.getUser()?.id;
    const box = $('thread-msgs');
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML = messages.length
      ? messages.map(m => `
          <div class="tmsg ${m.sender_id === me ? 'mine' : ''}">
            <div class="tmsg-bubble">${esc(m.body)}</div>
            <div class="tmsg-meta">${esc(m.sender_name)} · ${new Date(m.created_at).toLocaleString()}</div>
          </div>`).join('')
      : '<div class="thread-empty">No messages yet. Say hello 👋</div>';
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  async function load() {
    if (!state.carId) return;
    try {
      const data = await API.getThread(state.carId, state.buyerId);
      state.buyerId = data.buyerId;          // lock thread (esp. buyer side)
      render(data.messages);
    } catch { /* ignore transient poll errors */ }
  }

  // Realtime: when a message lands in the currently-open thread, reload it live.
  RT.on('message', ({ carId, buyerId } = {}) => {
    if (panel.classList.contains('open') && String(state.carId) === String(carId) && String(state.buyerId) === String(buyerId)) load();
  });

  window.openChatThread = function ({ carId, buyerId, title, sub }) {
    if (!API.isLoggedIn()) { openAuth('login'); return; }
    state.carId = carId; state.buyerId = buyerId || null;
    $('thread-title').textContent = title || 'Conversation';
    $('thread-sub').textContent = sub || '';
    panel.classList.add('open');
    document.body.classList.add('menu-open');
    // Load history (which marks the thread read server-side), then re-sync the
    // unread badge + thread list, and join the realtime room.
    load().then(() => {
      updateUnreadBadge();           // nav badge — was previously only refreshed on close
      window.refreshThreads?.();     // clear the opened row's unread in the list
      RT.connect().then(s => { if (s && state.carId && state.buyerId) RT.emit('thread:join', { carId: state.carId, buyerId: state.buyerId }); });
    });
    clearInterval(state.poll);
    state.poll = setInterval(load, 15000); // slow fallback; the socket drives real-time
    setTimeout(() => $('thread-input').focus(), 120);
  };

  function close() {
    if (state.carId && state.buyerId) RT.emit('thread:leave', { carId: state.carId, buyerId: state.buyerId });
    panel.classList.remove('open');
    document.body.classList.remove('menu-open');
    clearInterval(state.poll); state.poll = null;
    updateUnreadBadge();
  }
  $('thread-close').addEventListener('click', close);
  panel.addEventListener('click', e => { if (e.target.id === 'thread-overlay') close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) close(); });

  async function send() {
    const input = $('thread-input'); const body = input.value.trim();
    if (!body) return;
    input.value = '';
    try { await API.sendMessage(state.carId, body, state.buyerId); await load(); }
    catch (e) { toast(e.message || 'Could not send', 'error'); input.value = body; }
  }
  $('thread-send').addEventListener('click', send);
  $('thread-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

  // Unread badge on the profile nav button
  let unreadPoll = null;
  window.updateUnreadBadge = async function () {
    if (!API.isLoggedIn()) return;
    try {
      const { count } = await API.getUnread();
      document.querySelectorAll('#nav-profile-btn').forEach(btn => {
        let b = btn.querySelector('.nav-badge');
        if (!b) { b = document.createElement('span'); b.className = 'nav-badge'; btn.appendChild(b); }
        b.textContent = count > 9 ? '9+' : count;
        b.classList.toggle('hidden', !count);
      });
    } catch (e) {
      // Expired/invalid token: sign out locally and stop polling, otherwise the
      // badge hits the API with a dead token every 30s forever (403 spam).
      if (e && (e.status === 401 || e.status === 403)) {
        localStorage.removeItem('4k_token');
        localStorage.removeItem('4k_user');
        clearInterval(unreadPoll); unreadPoll = null;
        document.querySelectorAll('#nav-profile-btn .nav-badge').forEach(b => b.remove());
      }
    }
  };
  RT.on('unread', () => updateUnreadBadge());
  document.addEventListener('DOMContentLoaded', () => {
    updateUnreadBadge();
    RT.connect();                                        // live unread nudges
    unreadPoll = setInterval(updateUnreadBadge, 30000);  // slow fallback
  });
})();

/* ── i18n (localization scaffold) ───────────────────────────────
   Structural setup: a dictionary, a t() helper for JS-built strings, and
   attribute-driven translation of markup:
     data-i18n="key"       → element.textContent
     data-i18n-html="key"  → element.innerHTML (for strings with inline markup)
     data-i18n-ph="key"    → element.placeholder
   The chosen language persists in localStorage and is applied site-wide via the
   nav language switcher (injected on every page). Add languages by extending
   I18N, and grow coverage by tagging more elements with data-i18n. */
(function () {
  const LANGS = { en: 'EN', fr: 'FR' };
  const I18N = {
    en: {
      'nav.home': 'Home', 'nav.listings': 'Listings', 'nav.clearance': 'Clearance',
      'nav.how': 'How It Works', 'nav.signin': 'Sign In', 'nav.sell': 'List Your Car',
      'nav.search_ph': 'Search make, model…',
      'hero.eyebrow': 'Global Inventory · Cleared & Delivered in Nigeria',
      'hero.title': 'Drive Your <em>Dream</em><br>Without Breaking The Bank',
      'hero.sub': 'Buy verified preowned vehicles from trusted international sellers. Secure escrow payments, full inspection reports, and customs clearance handled for you.',
      'search.buy': 'Buy a Car', 'search.sell': 'Sell Your Car',
      'search.make': 'Make', 'search.model': 'Model', 'search.maxprice': 'Max Price (₦)',
      'search.btn': 'Search Cars',
      'search.make_ph': 'Any make, or type your own',
      'search.model_ph': 'Pick a make first, or type any model',
      'newsletter.title': 'Get the weekly drop',
      'newsletter.sub': 'New arrivals & price moves, straight to your inbox.',
      'newsletter.btn': 'Subscribe', 'newsletter.email_ph': 'you@example.com',
      'nav.dashboard': 'My Dashboard', 'nav.signout': 'Sign Out',
      'footer.tagline': 'A global preowned-car marketplace. Buy verified vehicles from international sellers, with customs clearance and delivery handled across Nigeria.',
      'footer.buy': 'Buy', 'footer.sell': 'Sell', 'footer.company': 'Company', 'footer.support': 'Support',
      'footer.browse': 'Browse Listings', 'footer.premium': 'Premium Cars', 'footer.clearance': 'Customs Clearance',
      'footer.dashboard': 'Seller Dashboard', 'footer.photoguide': 'Photo Guide', 'footer.shipping': 'Shipping & Clearance',
      'footer.about': 'About Us', 'footer.community': 'Community', 'footer.careers': 'Careers', 'footer.blog': 'The 4K Blog',
      'footer.help': 'Help Center', 'footer.faqs': 'FAQs', 'footer.contact': 'Contact Us', 'footer.tos': 'Terms of Service', 'footer.privacy': 'Privacy Policy',
      'footer.rights': '4Kautos. All rights reserved.', 'footer.terms_s': 'Terms', 'footer.privacy_s': 'Privacy', 'footer.donotsell': 'Do Not Sell My Info',
      'card.view': 'View Details', 'card.verified': 'Verified seller', 'card.featured': 'Featured', 'card.excellent': 'Excellent',
      'trust.escrow': 'Payments held in escrow', 'trust.verified': 'Sellers verified, VINs checked', 'trust.clearance': 'Duty and clearance handled', 'trust.fx': 'Live ₦ and $ pricing',
      'seller.verified': 'Verified seller', 'seller.unverified': 'Not yet verified', 'seller.memberSince': 'Member since', 'seller.listingsCount': 'listings', 'seller.completedSales': 'completed sales',
      'seller.inventoryLabel': 'Inventory', 'seller.listingsTitle': 'Listings from this seller', 'seller.browseAll': 'Browse all cars →', 'seller.noListings': 'No live listings right now', 'seller.browseOthers': 'Browse other cars', 'seller.notFound': 'Seller not found',
      'seller.reviews': 'reviews', 'seller.reviewsLabel': 'Reputation', 'seller.reviewsTitle': 'What buyers say',
      'review.rate': 'Rate seller', 'review.done': 'reviewed', 'review.title': 'Rate the seller', 'review.ph': 'How was the deal? (optional)', 'review.cancel': 'Cancel', 'review.submit': 'Submit review', 'review.thanks': 'Thanks! Your review is live',
      'listings.filterTitle': '🔍 Filter Cars', 'listings.make': 'Make', 'listings.model': 'Model', 'listings.year': 'Year', 'listings.price': 'Price (₦)', 'listings.condition': 'Condition',
      'cond.excellent': 'Excellent', 'cond.good': 'Good', 'cond.fair': 'Fair',
      'listings.apply': 'Apply Filters', 'listings.clear': 'Clear All',
      'listings.showing': 'Showing', 'listings.vehicles': 'vehicles', 'listings.grid': '▦ Grid', 'listings.map': '🗺 Map', 'listings.sortLabel': 'Sort:',
      'listings.sortNew': 'Newest First', 'listings.sortPriceLow': 'Price: Low → High', 'listings.sortPriceHigh': 'Price: High → Low', 'listings.sortMileage': 'Lowest Mileage',
      'listings.emptyTitle': 'No Cars Found', 'listings.emptyHint': 'Try adjusting your filters', 'listings.save': '🔖 Save search', 'listings.recs': 'You might like these',
      'listings.filtersBtn': '🔍 Filters', 'listings.hideFilters': '✕ Hide filters',
      'detail.description': 'Description', 'detail.specs': 'Vehicle Specifications', 'detail.location': 'Location', 'detail.askingPrice': 'Asking Price',
      'detail.buy': 'Initiate Purchase', 'detail.ask': '💬 Ask AutoBot about this car', 'detail.clearance': '🛃 Estimate import clearance',
      'detail.message': '💬 Message the seller', 'detail.save': '♡ Save this car', 'detail.saved': '♥ Saved', 'detail.share': '🔗 Share listing', 'detail.waShare': 'Share on WhatsApp',
      'detail.buyShort': 'Buy now', 'detail.priceOnRequest': 'Price on request', 'listings.clearAll': 'Clear all',
      'detail.similar': 'Similar listings', 'detail.notFound': 'Car Not Found',
      'spec.make': 'Make', 'spec.model': 'Model', 'spec.year': 'Year', 'spec.bodyType': 'Body type', 'spec.mileage': 'Mileage', 'spec.condition': 'Condition',
      'spec.engine': 'Engine', 'spec.transmission': 'Transmission', 'spec.drivetrain': 'Drivetrain', 'spec.horsepower': 'Horsepower', 'spec.fuel': 'Fuel economy',
      'spec.seats': 'Seats', 'spec.exterior': 'Exterior', 'spec.interior': 'Interior', 'spec.towing': 'Towing', 'spec.vin': 'VIN', 'spec.location': 'Location', 'spec.listed': 'Listed',
      'clr.eyebrow': 'Import Made Easy', 'clr.title': 'Nigeria Customs Clearance', 'clr.sub': 'Estimate import duty on any vehicle and compare verified clearing agents by their all in rate, so you pay less and clear faster at the port.',
      'clr.estimator': 'Duty Estimator', 'clr.cifLabel': 'Vehicle value (CIF)', 'clr.cifHint': 'Cost + Insurance + Freight, the landed value Customs assesses.', 'clr.yearLabel': 'Year of manufacture', 'clr.estimateBtn': 'Estimate & Compare Agents', 'clr.partners': 'Partner Clearing Agents',
      'cond.poor': 'Poor',
      // Dashboard
      'dash.overview': 'Overview', 'dash.listings': 'My Listings', 'dash.transactions': 'Transactions', 'dash.messages': 'Messages',
      'dash.saved': 'Saved searches', 'dash.addListing': 'Add Listing', 'dash.admin': 'Admin',
      'dash.welcome': 'Welcome Back 👋', 'dash.welcomeSub': 'Your 4Kautos dashboard. Manage your listings, track transactions, and keep your profile up to date.',
      'dash.yourLocation': 'Your location', 'dash.locationPh': 'e.g. Port Harcourt, Nigeria', 'dash.save': 'Save',
      'dash.locationHint': 'We use this to estimate shipping & duties to your door.',
      'dash.savedSub': 're-run a search anytime', 'dash.newListing': '+ New Listing',
      'dash.savedCars': 'Saved cars', 'dash.savedCarsSub': 'the cars you hearted', 'dash.noSavedCars': 'No saved cars yet. Tap the ♡ on any listing to save it here.', 'dash.browseListings': 'Browse listings',
      'dash.payout': 'Payout details', 'dash.payoutSub': 'where your sales are paid', 'dash.txHistory': 'Transaction History',
      'dash.gateTitle': 'Sign in to access your dashboard', 'dash.gateSub': 'Manage your listings, track purchases, and update your profile.',
      // Admin cockpit
      'admin.operations': 'Operations', 'admin.escrowLiq': 'Escrow liquidity', 'admin.usd': '(USD)', 'admin.funnel': 'Conversion funnel',
      'admin.risk': 'Risk & moderation', 'admin.activity': 'Recent activity', 'admin.invMap': 'Inventory map', 'admin.invMapSub': 'listing origins', 'admin.topBuyers': 'Top buyer locations',
      'admin.users': 'Users', 'admin.listings': 'Listings', 'admin.pendingPayouts': 'Pending payouts',
      'admin.intlPayouts': 'Pending international payouts', 'admin.intlPayoutsSub': 'pay via Wise, then mark settled',
      'admin.allListings': 'All Listings', 'admin.contactMsgs': 'Contact messages', 'admin.maintenance': 'Maintenance',
      'admin.security': 'Security', 'admin.twofaP': "Protect the admin account with two-factor authentication. You'll enter a 6-digit code from your authenticator app at login.", 'admin.twofaEnable': 'Enable 2FA', 'admin.twofaOn': 'Two-factor is ON', 'admin.twofaDisable': 'Disable 2FA', 'admin.twofaDisableHint': 'Enter a current code to turn it off.', 'admin.twofaDisabled': 'Two-factor disabled', 'admin.twofaEnabled': 'Two-factor enabled 🔒', 'admin.twofaStep1': 'In your authenticator app, add an account and enter this key:', 'admin.twofaLink': 'or tap to open in your app', 'admin.twofaConfirm': 'Confirm & enable', 'auth.totp': 'Authentication code',
      'admin.maintenanceP': 'Regenerate responsive image sizes for older uploads so they load fast on phones (creates <code>_400/_800/_1600</code> variants). Safe to run repeatedly; already optimized photos are skipped.',
      'admin.preview': 'Preview changes', 'admin.regen': 'Regenerate now',
      // Add-listing wizard
      'wiz.addTitle': 'Add New Listing', 'wiz.editTitle': 'Edit Listing',
      'wiz.standards': "<strong>Listing standards.</strong> Every car needs a valid 17-character VIN, accurate mileage, and clear photos of the required angles below (minimum 800×600). Listings that don't meet these standards can't be published.",
      'wiz.basics': 'Basics', 'wiz.specs': 'Specs', 'wiz.location': 'Location', 'wiz.photos': 'Photos',
      'wiz.title': 'Title', 'wiz.titlePh': 'e.g. 2019 Toyota Camry XSE (optional)', 'wiz.makePh': 'Pick one or type your own',
      'wiz.price': 'Price', 'wiz.mileage': 'Mileage (km)', 'wiz.vinPh': '17-character VIN', 'wiz.vinHint': '17 characters · letters I, O, Q are not allowed',
      'wiz.bodyTypePh': 'Select a body type…', 'wiz.specsHead': 'Specifications',
      'wiz.extColor': 'Exterior colour', 'wiz.extColorPh': 'e.g. Pearl White', 'wiz.intColor': 'Interior colour', 'wiz.intColorPh': 'e.g. Black leather',
      'wiz.enginePh': 'e.g. 2.0L Turbo I4', 'wiz.mpg': 'Fuel economy (MPG)', 'wiz.mpgPh': 'e.g. 28 combined',
      'wiz.select': 'Select…', 'wiz.trAuto': 'Automatic', 'wiz.trManual': 'Manual', 'wiz.trSemi': 'Semi-automatic', 'wiz.trDct': 'Dual-clutch',
      'wiz.hpPh': 'e.g. 200', 'wiz.seatsPh': 'e.g. 5',
      'wiz.accident': 'Accident history', 'wiz.accidentNo': 'No reported accidents', 'wiz.accidentYes': 'Has accident history',
      'wiz.accidentHint': "Helps us assess the vehicle's condition. Not shown publicly on your listing.",
      'wiz.inspection': 'Inspection report', 'wiz.uploadReport': '⬆ Upload report',
      'wiz.inspectionHint': 'Latest inspection report (PDF or photo). Used for our condition checks, not shown publicly.',
      'wiz.towing': 'Max towing capacity', 'wiz.towingPh': 'e.g. 3,500 kg', 'wiz.towingHint': 'Required for pickups.',
      'wiz.extras': 'Optional extras', 'wiz.comfort': 'Comfort & convenience', 'wiz.comfortPh': 'Heated seats, Sunroof, Apple CarPlay (comma-separated)',
      'wiz.safety': 'Safety', 'wiz.safetyPh': 'Blind-spot monitor, Lane assist, 360° camera (comma-separated)',
      'wiz.mods': 'Modifications', 'wiz.modsPh': 'Lift kit, Aftermarket exhaust (comma-separated)',
      'wiz.locationLabel': 'Location (where the car is)', 'wiz.locationPh': 'e.g. Atlanta, GA, USA', 'wiz.locate': '📍 Locate',
      'wiz.locHint': "City and country. We'll pin it on the map for buyers.",
      'wiz.descPh': "Describe the vehicle's history, features, and any known issues…",
      'wiz.reqPhotos': 'Required photos', 'wiz.addPhotos': 'Additional photos (optional, one URL per line)',
      'wiz.back': '← Back', 'wiz.next': 'Next →', 'wiz.submit': '📋 Submit Listing',
      // About page
      'about.label': 'Our Story', 'about.title': 'About <em>4Kautos</em>',
      'about.sub': 'We make buying a car from anywhere in the world feel as safe as buying one down the street.',
      'about.intro': '4Kautos is a global preowned-car marketplace built for the Nigerian buyer. Sellers list verified vehicles from the US, UK, Europe, the Gulf and Asia; we handle the parts that usually go wrong: inspection standards, secure escrow, import duty and door to door clearance. That way you always know the real cost to your door before you commit.',
      'about.believe': 'What we believe',
      'about.v1h': 'Honest pricing', 'about.v1p': 'Every listing shows its all-in landed cost in ₦ and $, with duty and shipping included. No surprises at the port.',
      'about.v2h': 'Verified inventory', 'about.v2p': 'Listings require a valid VIN, accurate mileage and clear photos of every key angle before they go live.',
      'about.v3h': 'Protected payments', 'about.v3p': 'Funds sit in escrow and are only released to the seller once you confirm the vehicle is as described.',
      'about.v4h': 'Clearance, sorted', 'about.v4p': "Compare verified clearing agents by their best rate, and track your car from the seller's driveway to yours.",
      'about.started': 'How it started', 'about.startedP': "Importing a car into Nigeria has long meant guesswork: unclear duties, unreliable agents and sellers you can't verify. 4Kautos was built to replace that guesswork with transparency: real-time exchange rates, a customs estimator, and a marketplace where both sides are accountable.",
      'about.join': 'Join us',
      'about.joinP': `Whether you're buying your first car or shipping your tenth, we'd love to have you. <a href="#" data-act="auth" data-mode="signup">Create an account</a> or <a href="listings.html">browse the latest arrivals</a>.`,
      // Community page
      'community.label': 'Better Together', 'community.title': 'The 4Kautos <em>Community</em>',
      'community.sub': 'Buyers, sellers and clearing agents swapping import know-how, build threads and honest reviews.',
      'community.intro': "Importing and selling cars is a lot easier with people who've done it before. Our community is where members share what they learned: which agents clear fastest, how to budget for duty, and what to check before you buy from abroad.",
      'community.inside': "What's inside",
      'community.c1h': 'Import guides', 'community.c1p': 'Step-by-step walkthroughs on duty, shipping and paperwork for first-time importers.',
      'community.c2h': 'Agent reviews', 'community.c2p': 'Real ratings of clearing agents from buyers who used them, so you pick the best rate with confidence.',
      'community.c3h': 'Build & ownership threads', 'community.c3p': "Owners sharing reliability notes, mods and maintenance on the models you're considering.",
      'community.c4h': 'Marketplace alerts', 'community.c4p': 'Get a heads-up when a car matching your search lands, and follow price moves on your shortlist.',
      'community.involved': 'Get involved',
      'community.involvedP': `The community hub is rolling out soon. In the meantime, <a href="#" data-act="auth" data-mode="signup">create an account</a> to save cars, message sellers and be first in when it opens. Want updates? Subscribe in the footer below.`,
      // Home page sections
      'home.tickerLabel': 'HOT DEALS',
      'cat.SUV': 'SUV', 'cat.Sedan': 'Sedan', 'cat.Hatchback': 'Hatchback', 'cat.Coupe': 'Coupe', 'cat.Pickup': 'Pickup', 'cat.Convertible': 'Convertible', 'cat.Van': 'Van',
      'home.statCarsL': 'Cars Listed', 'home.statSatL': 'Buyer Satisfaction', 'home.statFeesL': 'Hidden Fees',
      'home.hotLabel': '🔥 Hot Sales', 'home.hotTitle': 'Deals worth grabbing', 'home.viewAll': 'View All Cars →',
      'home.freshLabel': 'Fresh Inventory', 'home.latestTitle': 'Latest Arrivals',
      'home.findLabel': 'Find It Faster', 'home.browseTitle': 'Browse By', 'home.browseType': 'Body Type', 'home.browseBudget': 'Budget', 'home.browseMileage': 'Mileage',
      'home.brandLabel': 'Browse Makes', 'home.brandTitle': 'Shop by Brand', 'home.allBrands': 'All Brands →',
      'home.processLabel': 'Process', 'home.howTitle': 'How 4Kautos Works', 'home.howSub': 'Our secure process protects buyers and sellers from listing to handover.',
      'home.step1t': 'Browse & Search', 'home.step1d': 'Filter by make, model, year, price and condition to find your perfect match from our verified inventory.',
      'home.step2t': 'Request Inspection', 'home.step2d': "Initiate a purchase and our certified inspectors verify the vehicle's condition before you commit.",
      'home.step3t': 'Pay Into Escrow', 'home.step3d': "Your funds are held securely in our escrow system and released to the seller only when you're satisfied.",
      'home.step4t': 'Drive Away', 'home.step4d': 'Title is transferred, keys handed over. Your new car is ready. We handle all the paperwork.',
      'home.whyLabel': 'Why 4Kautos', 'home.whyTitle': 'Built For <em>Confident</em> Buying', 'home.whySub': 'Verified inventory, secure escrow, and door to door clearance. The parts that usually go wrong, handled for you.',
      'home.why1': 'Cars delivered & cleared', 'home.why2': 'Inspection-backed listings', 'home.why3': 'Average port clearance', 'home.why4': 'Hidden fees, ever',
      'home.reviewsLabel': 'Loved By Drivers', 'home.reviewsTitle': 'What Our Buyers Say',
      'home.review1': `"Bought a Lexus from a seller in Japan and 4Kautos handled the duty and shipping. The landed cost figure was spot on. Zero surprises at the port."`, 'home.review1meta': 'Lagos · Verified buyer',
      'home.review2': `"As a seller in Houston, listing was painless and I got paid through escrow the moment the buyer confirmed. Easily the smoothest export I've done."`, 'home.review2meta': 'Houston · Verified seller',
      'home.review3': `"The dual ₦/$ pricing and the clearance estimator helped me budget properly before committing. Delivered to Abuja in good time."`, 'home.review3meta': 'Abuja · Verified buyer',
      'home.promoTitle': 'Selling from abroad? List free this month.', 'home.promoText': 'Reach thousands of Nigerian buyers. We handle clearance, escrow and delivery. You just hand over the keys.', 'home.promoCta': 'Start Selling →',
      // Auth modal
      'auth.login': 'Login', 'auth.signup': 'Sign Up', 'auth.email': 'Email', 'auth.password': 'Password', 'auth.passwordPh': 'Your password',
      'auth.fullName': 'Full Name', 'auth.namePh': 'John Doe', 'auth.pwMin': 'Min. 6 characters', 'auth.forgot': 'Forgot password?',
      'auth.resend': 'Resend verification email', 'auth.enterEmail': 'Enter your email above first', 'toast.verifyResent': 'Verification email sent — check your inbox (and spam).',
      'auth.noAccountQ': 'No account?', 'auth.createOne': 'Create one', 'auth.iam': 'I am a', 'auth.buyer': 'Buyer', 'auth.seller': 'Seller',
      'auth.roleNote': `You're creating a <strong>seller</strong> account to list your car.`, 'auth.buyInstead': 'Sign up to buy instead',
      'auth.createBtn': 'Create Account', 'auth.haveAccountQ': 'Already have an account?', 'auth.signinLink': 'Sign in',
      // Contact + forgot modals
      'contact.title': 'Send us a message', 'contact.intro': "Questions, feedback, or help with a listing. We'll get back to you by email.",
      'contact.name': 'Your name', 'contact.message': 'Message', 'contact.msgPh': 'How can we help?', 'contact.send': 'Send message',
      'contact.sending': 'Sending…', 'contact.fillAll': 'Please fill in your name, email and message.',
      'forgot.title': 'Reset your password', 'forgot.intro': "Enter your account email and we'll send a reset link.", 'forgot.send': 'Send reset link',
      // Toasts
      'toast.welcomeBack': 'Welcome back! 🚗', 'toast.accountCreated': 'Account created! Welcome to 4Kautos 🚗',
      'toast.verifyEmail': 'Account created! Check your email to verify your address before signing in.',
      'toast.contactSent': "Message sent. We'll be in touch ✉️",
    },
    fr: {
      'nav.home': 'Accueil', 'nav.listings': 'Annonces', 'nav.clearance': 'Dédouanement',
      'nav.how': 'Comment ça marche', 'nav.signin': 'Connexion', 'nav.sell': 'Vendre ma voiture',
      'nav.search_ph': 'Rechercher marque, modèle…',
      'hero.eyebrow': 'Stock mondial · Dédouané & livré au Nigeria',
      'hero.title': 'Roulez vers la <em>voiture</em><br>de vos rêves sans vous ruiner',
      'hero.sub': "Achetez des véhicules d'occasion vérifiés auprès de vendeurs internationaux de confiance. Paiements sécurisés sous séquestre, rapports d'inspection complets et dédouanement pris en charge.",
      'search.buy': 'Acheter', 'search.sell': 'Vendre',
      'search.make': 'Marque', 'search.model': 'Modèle', 'search.maxprice': 'Prix max (₦)',
      'search.btn': 'Rechercher',
      'search.make_ph': 'Toute marque, ou saisissez la vôtre',
      'search.model_ph': "Choisissez d'abord une marque, ou saisissez un modèle",
      'newsletter.title': "L'actu hebdo",
      'newsletter.sub': 'Nouveautés et baisses de prix, directement dans votre boîte mail.',
      'newsletter.btn': "S'abonner", 'newsletter.email_ph': 'vous@exemple.com',
      'nav.dashboard': 'Mon tableau de bord', 'nav.signout': 'Déconnexion',
      'footer.tagline': "Une place de marché mondiale de voitures d'occasion. Achetez des véhicules vérifiés auprès de vendeurs internationaux, dédouanement et livraison gérés partout au Nigeria.",
      'footer.buy': 'Acheter', 'footer.sell': 'Vendre', 'footer.company': 'Entreprise', 'footer.support': 'Aide',
      'footer.browse': 'Voir les annonces', 'footer.premium': 'Voitures premium', 'footer.clearance': 'Dédouanement',
      'footer.dashboard': 'Espace vendeur', 'footer.photoguide': 'Guide photo', 'footer.shipping': 'Expédition & dédouanement',
      'footer.about': 'À propos', 'footer.community': 'Communauté', 'footer.careers': 'Carrières', 'footer.blog': 'Le blog 4K',
      'footer.help': "Centre d'aide", 'footer.faqs': 'FAQ', 'footer.contact': 'Nous contacter', 'footer.tos': "Conditions d'utilisation", 'footer.privacy': 'Politique de confidentialité',
      'footer.rights': '4Kautos. Tous droits réservés.', 'footer.terms_s': 'Conditions', 'footer.privacy_s': 'Confidentialité', 'footer.donotsell': 'Ne pas vendre mes infos',
      'card.view': 'Voir détails', 'card.verified': 'Vendeur vérifié', 'card.featured': 'En vedette', 'card.excellent': 'Excellent',
      'trust.escrow': 'Paiements sous séquestre', 'trust.verified': 'Vendeurs vérifiés, VIN contrôlés', 'trust.clearance': 'Droits et dédouanement gérés', 'trust.fx': 'Prix en direct en ₦ et $',
      'seller.verified': 'Vendeur vérifié', 'seller.unverified': 'Pas encore vérifié', 'seller.memberSince': 'Membre depuis', 'seller.listingsCount': 'annonces', 'seller.completedSales': 'ventes conclues',
      'seller.inventoryLabel': 'Inventaire', 'seller.listingsTitle': 'Annonces de ce vendeur', 'seller.browseAll': 'Voir toutes les voitures →', 'seller.noListings': 'Aucune annonce en ligne pour le moment', 'seller.browseOthers': "Voir d'autres voitures", 'seller.notFound': 'Vendeur introuvable',
      'seller.reviews': 'avis', 'seller.reviewsLabel': 'Réputation', 'seller.reviewsTitle': 'Ce que disent les acheteurs',
      'review.rate': 'Noter le vendeur', 'review.done': 'évalué', 'review.title': 'Notez le vendeur', 'review.ph': "Comment s'est passée la transaction ? (facultatif)", 'review.cancel': 'Annuler', 'review.submit': "Publier l'avis", 'review.thanks': 'Merci ! Votre avis est en ligne',
      'listings.filterTitle': '🔍 Filtrer', 'listings.make': 'Marque', 'listings.model': 'Modèle', 'listings.year': 'Année', 'listings.price': 'Prix (₦)', 'listings.condition': 'État',
      'cond.excellent': 'Excellent', 'cond.good': 'Bon', 'cond.fair': 'Correct',
      'listings.apply': 'Appliquer les filtres', 'listings.clear': 'Tout effacer',
      'listings.showing': 'Affichage de', 'listings.vehicles': 'véhicules', 'listings.grid': '▦ Grille', 'listings.map': '🗺 Carte', 'listings.sortLabel': 'Trier :',
      'listings.sortNew': 'Plus récentes', 'listings.sortPriceLow': 'Prix : croissant', 'listings.sortPriceHigh': 'Prix : décroissant', 'listings.sortMileage': 'Kilométrage le plus bas',
      'listings.emptyTitle': 'Aucune voiture trouvée', 'listings.emptyHint': 'Essayez d’ajuster vos filtres', 'listings.save': '🔖 Enregistrer la recherche', 'listings.recs': 'Vous pourriez aimer',
      'listings.filtersBtn': '🔍 Filtres', 'listings.hideFilters': '✕ Masquer',
      'detail.description': 'Description', 'detail.specs': 'Caractéristiques du véhicule', 'detail.location': 'Emplacement', 'detail.askingPrice': 'Prix demandé',
      'detail.buy': "Lancer l'achat", 'detail.ask': '💬 Demander à AutoBot', 'detail.clearance': '🛃 Estimer le dédouanement',
      'detail.message': '💬 Contacter le vendeur', 'detail.save': '♡ Enregistrer', 'detail.saved': '♥ Enregistré', 'detail.share': '🔗 Partager', 'detail.waShare': 'Partager sur WhatsApp',
      'detail.buyShort': 'Acheter', 'detail.priceOnRequest': 'Prix sur demande', 'listings.clearAll': 'Tout effacer',
      'detail.similar': 'Annonces similaires', 'detail.notFound': 'Voiture introuvable',
      'spec.make': 'Marque', 'spec.model': 'Modèle', 'spec.year': 'Année', 'spec.bodyType': 'Carrosserie', 'spec.mileage': 'Kilométrage', 'spec.condition': 'État',
      'spec.engine': 'Moteur', 'spec.transmission': 'Boîte de vitesses', 'spec.drivetrain': 'Roues motrices', 'spec.horsepower': 'Puissance', 'spec.fuel': 'Consommation',
      'spec.seats': 'Sièges', 'spec.exterior': 'Extérieur', 'spec.interior': 'Intérieur', 'spec.towing': 'Remorquage', 'spec.vin': 'VIN', 'spec.location': 'Emplacement', 'spec.listed': 'Publié',
      'clr.eyebrow': 'Importation simplifiée', 'clr.title': 'Dédouanement au Nigeria', 'clr.sub': "Estimez les droits d'importation sur tout véhicule et comparez des agents vérifiés selon leur tarif tout compris, pour payer moins et dédouaner plus vite au port.",
      'clr.estimator': 'Estimateur de droits', 'clr.cifLabel': 'Valeur du véhicule (CAF)', 'clr.cifHint': 'Coût + Assurance + Fret, la valeur évaluée par les douanes.', 'clr.yearLabel': 'Année de fabrication', 'clr.estimateBtn': 'Estimer & comparer', 'clr.partners': 'Agents de dédouanement partenaires',
      'cond.poor': 'Médiocre',
      // Tableau de bord
      'dash.overview': 'Aperçu', 'dash.listings': 'Mes annonces', 'dash.transactions': 'Transactions', 'dash.messages': 'Messages',
      'dash.saved': 'Recherches enregistrées', 'dash.addListing': 'Ajouter une annonce', 'dash.admin': 'Admin',
      'dash.welcome': 'Bon retour 👋', 'dash.welcomeSub': 'Votre tableau de bord 4Kautos. Gérez vos annonces, suivez vos transactions et tenez votre profil à jour.',
      'dash.yourLocation': 'Votre localisation', 'dash.locationPh': 'ex. Port Harcourt, Nigeria', 'dash.save': 'Enregistrer',
      'dash.locationHint': "Nous l'utilisons pour estimer la livraison et les droits jusqu'à votre porte.",
      'dash.savedSub': 'relancez une recherche à tout moment', 'dash.newListing': '+ Nouvelle annonce',
      'dash.savedCars': 'Voitures enregistrées', 'dash.savedCarsSub': 'les voitures que vous avez aimées', 'dash.noSavedCars': 'Aucune voiture enregistrée. Touchez le ♡ sur une annonce pour l’enregistrer ici.', 'dash.browseListings': 'Parcourir les annonces',
      'dash.payout': 'Coordonnées de paiement', 'dash.payoutSub': 'où vos ventes sont versées', 'dash.txHistory': 'Historique des transactions',
      'dash.gateTitle': 'Connectez-vous pour accéder à votre tableau de bord', 'dash.gateSub': 'Gérez vos annonces, suivez vos achats et mettez à jour votre profil.',
      // Espace admin
      'admin.operations': 'Opérations', 'admin.escrowLiq': 'Liquidité sous séquestre', 'admin.usd': '(USD)', 'admin.funnel': 'Entonnoir de conversion',
      'admin.risk': 'Risque & modération', 'admin.activity': 'Activité récente', 'admin.invMap': 'Carte du stock', 'admin.invMapSub': 'origines des annonces', 'admin.topBuyers': 'Principales localités acheteurs',
      'admin.users': 'Utilisateurs', 'admin.listings': 'Annonces', 'admin.pendingPayouts': 'Versements en attente',
      'admin.intlPayouts': 'Versements internationaux en attente', 'admin.intlPayoutsSub': 'payez via Wise, puis marquez réglé',
      'admin.allListings': 'Toutes les annonces', 'admin.contactMsgs': 'Messages de contact', 'admin.maintenance': 'Maintenance',
      'admin.security': 'Sécurité', 'admin.twofaP': "Protégez le compte admin avec la double authentification. Vous saisirez un code à 6 chiffres de votre application d'authentification à la connexion.", 'admin.twofaEnable': 'Activer la 2FA', 'admin.twofaOn': 'Double authentification ACTIVE', 'admin.twofaDisable': 'Désactiver la 2FA', 'admin.twofaDisableHint': 'Saisissez un code actuel pour la désactiver.', 'admin.twofaDisabled': 'Double authentification désactivée', 'admin.twofaEnabled': 'Double authentification activée 🔒', 'admin.twofaStep1': "Dans votre application d'authentification, ajoutez un compte et saisissez cette clé :", 'admin.twofaLink': "ou touchez pour ouvrir dans l'app", 'admin.twofaConfirm': 'Confirmer et activer', 'auth.totp': "Code d'authentification",
      'admin.maintenanceP': "Régénère les tailles d'image responsives pour les anciens téléversements afin qu'elles se chargent vite sur mobile (crée les variantes <code>_400/_800/_1600</code>). Sans risque à relancer ; les photos déjà optimisées sont ignorées.",
      'admin.preview': 'Aperçu des changements', 'admin.regen': 'Régénérer maintenant',
      // Assistant d'ajout d'annonce
      'wiz.addTitle': 'Ajouter une annonce', 'wiz.editTitle': "Modifier l'annonce",
      'wiz.standards': "<strong>Normes des annonces.</strong> Chaque voiture nécessite un VIN valide de 17 caractères, un kilométrage exact et des photos nettes des angles requis ci-dessous (minimum 800×600). Les annonces non conformes ne peuvent pas être publiées.",
      'wiz.basics': 'Bases', 'wiz.specs': 'Détails', 'wiz.location': 'Lieu', 'wiz.photos': 'Photos',
      'wiz.title': 'Titre', 'wiz.titlePh': 'ex. 2019 Toyota Camry XSE (facultatif)', 'wiz.makePh': 'Choisissez ou saisissez la vôtre',
      'wiz.price': 'Prix', 'wiz.mileage': 'Kilométrage (km)', 'wiz.vinPh': 'VIN à 17 caractères', 'wiz.vinHint': '17 caractères · les lettres I, O, Q ne sont pas autorisées',
      'wiz.bodyTypePh': 'Choisissez une carrosserie…', 'wiz.specsHead': 'Caractéristiques',
      'wiz.extColor': 'Couleur extérieure', 'wiz.extColorPh': 'ex. Blanc nacré', 'wiz.intColor': 'Couleur intérieure', 'wiz.intColorPh': 'ex. Cuir noir',
      'wiz.enginePh': 'ex. 2.0L Turbo I4', 'wiz.mpg': 'Consommation (MPG)', 'wiz.mpgPh': 'ex. 28 mixte',
      'wiz.select': 'Choisir…', 'wiz.trAuto': 'Automatique', 'wiz.trManual': 'Manuelle', 'wiz.trSemi': 'Semi-automatique', 'wiz.trDct': 'Double embrayage',
      'wiz.hpPh': 'ex. 200', 'wiz.seatsPh': 'ex. 5',
      'wiz.accident': "Antécédents d'accident", 'wiz.accidentNo': 'Aucun accident signalé', 'wiz.accidentYes': "A des antécédents d'accident",
      'wiz.accidentHint': "Nous aide à évaluer l'état du véhicule. Non affiché publiquement sur votre annonce.",
      'wiz.inspection': "Rapport d'inspection", 'wiz.uploadReport': '⬆ Téléverser le rapport',
      'wiz.inspectionHint': "Dernier rapport d'inspection (PDF ou photo). Critère d'état interne, non affiché publiquement.",
      'wiz.towing': 'Capacité de remorquage max', 'wiz.towingPh': 'ex. 3 500 kg', 'wiz.towingHint': 'Obligatoire pour les pick-up.',
      'wiz.extras': 'Options supplémentaires', 'wiz.comfort': 'Confort & commodités', 'wiz.comfortPh': 'Sièges chauffants, Toit ouvrant, Apple CarPlay (séparés par des virgules)',
      'wiz.safety': 'Sécurité', 'wiz.safetyPh': "Surveillance d'angle mort, Aide au maintien de voie, Caméra 360° (séparés par des virgules)",
      'wiz.mods': 'Modifications', 'wiz.modsPh': 'Kit de rehausse, Échappement sport (séparés par des virgules)',
      'wiz.locationLabel': 'Emplacement (où se trouve la voiture)', 'wiz.locationPh': 'ex. Atlanta, GA, USA', 'wiz.locate': '📍 Localiser',
      'wiz.locHint': 'Ville et pays. Nous le placerons sur la carte pour les acheteurs.',
      'wiz.descPh': "Décrivez l'historique, les équipements et les éventuels problèmes connus du véhicule…",
      'wiz.reqPhotos': 'Photos requises', 'wiz.addPhotos': 'Photos supplémentaires (facultatif, une URL par ligne)',
      'wiz.back': '← Retour', 'wiz.next': 'Suivant →', 'wiz.submit': "📋 Publier l'annonce",
      // Page À propos
      'about.label': 'Notre histoire', 'about.title': 'À propos de <em>4Kautos</em>',
      'about.sub': "Nous rendons l'achat d'une voiture à l'autre bout du monde aussi sûr que dans la rue d'à côté.",
      'about.intro': "4Kautos est une place de marché mondiale de voitures d'occasion conçue pour l'acheteur nigérian. Les vendeurs publient des véhicules vérifiés des États-Unis, du Royaume-Uni, d'Europe, du Golfe et d'Asie ; nous gérons les étapes qui tournent souvent mal : normes d'inspection, séquestre sécurisé, droits d'importation et dédouanement porte-à-porte, pour que vous connaissiez toujours le vrai coût rendu chez vous avant de vous engager.",
      'about.believe': 'Nos convictions',
      'about.v1h': 'Des prix honnêtes', 'about.v1p': 'Chaque annonce affiche son coût rendu tout compris en ₦ et $, droits et transport inclus. Aucune surprise au port.',
      'about.v2h': 'Stock vérifié', 'about.v2p': 'Les annonces exigent un VIN valide, un kilométrage exact et des photos nettes de chaque angle clé avant leur mise en ligne.',
      'about.v3h': 'Paiements protégés', 'about.v3p': "Les fonds sont placés sous séquestre et ne sont versés au vendeur qu'une fois que vous confirmez que le véhicule est conforme.",
      'about.v4h': 'Dédouanement réglé', 'about.v4p': "Comparez des agents de dédouanement vérifiés selon leur meilleur tarif, et suivez votre voiture du vendeur jusqu'à vous.",
      'about.started': 'Comment tout a commencé', 'about.startedP': "Importer une voiture au Nigeria a longtemps relevé du pari : droits flous, agents peu fiables et vendeurs invérifiables. 4Kautos a été créé pour remplacer ce pari par la transparence : taux de change en temps réel, estimateur de douane et une place de marché où chacun rend des comptes.",
      'about.join': 'Rejoignez-nous',
      'about.joinP': `Que vous achetiez votre première voiture ou expédiiez la dixième, nous serions ravis de vous compter parmi nous. <a href="#" data-act="auth" data-mode="signup">Créez un compte</a> ou <a href="listings.html">parcourez les dernières arrivées</a>.`,
      // Page Communauté
      'community.label': 'Mieux ensemble', 'community.title': 'La <em>communauté</em> 4Kautos',
      'community.sub': "Acheteurs, vendeurs et agents de dédouanement qui échangent savoir-faire d'import, fils de build et avis honnêtes.",
      'community.intro': "Importer et vendre des voitures est bien plus simple avec des gens qui l'ont déjà fait. Notre communauté est l'endroit où les membres partagent ce qu'ils ont appris : quels agents dédouanent le plus vite, comment budgétiser les droits, et quoi vérifier avant d'acheter à l'étranger.",
      'community.inside': 'Au programme',
      'community.c1h': "Guides d'importation", 'community.c1p': 'Tutoriels pas à pas sur les droits, le transport et les démarches pour les primo-importateurs.',
      'community.c2h': 'Avis sur les agents', 'community.c2p': 'De vraies notes des agents de dédouanement par les acheteurs qui les ont utilisés, pour choisir le meilleur tarif en confiance.',
      'community.c3h': 'Fils builds & possession', 'community.c3p': 'Des propriétaires partagent fiabilité, modifications et entretien sur les modèles qui vous intéressent.',
      'community.c4h': 'Alertes du marché', 'community.c4p': 'Soyez prévenu quand une voiture correspondant à votre recherche arrive, et suivez les variations de prix de votre sélection.',
      'community.involved': 'Participez',
      'community.involvedP': `Le hub communautaire arrive bientôt. En attendant, <a href="#" data-act="auth" data-mode="signup">créez un compte</a> pour enregistrer des voitures, contacter les vendeurs et être prioritaire à l'ouverture. Envie de nouvelles ? Abonnez-vous dans le pied de page ci-dessous.`,
      // Sections page d'accueil
      'home.tickerLabel': 'BONS PLANS',
      'cat.SUV': 'SUV', 'cat.Sedan': 'Berline', 'cat.Hatchback': 'Compacte', 'cat.Coupe': 'Coupé', 'cat.Pickup': 'Pick-up', 'cat.Convertible': 'Cabriolet', 'cat.Van': 'Fourgon',
      'home.statCarsL': 'Voitures publiées', 'home.statSatL': 'Satisfaction acheteurs', 'home.statFeesL': 'Frais cachés',
      'home.hotLabel': '🔥 Ventes flash', 'home.hotTitle': 'Des offres à saisir', 'home.viewAll': 'Voir toutes les voitures →',
      'home.freshLabel': 'Stock frais', 'home.latestTitle': 'Dernières arrivées',
      'home.findLabel': 'Trouvez plus vite', 'home.browseTitle': 'Parcourir par', 'home.browseType': 'Carrosserie', 'home.browseBudget': 'Budget', 'home.browseMileage': 'Kilométrage',
      'home.brandLabel': 'Parcourir les marques', 'home.brandTitle': 'Acheter par marque', 'home.allBrands': 'Toutes les marques →',
      'home.processLabel': 'Processus', 'home.howTitle': 'Comment fonctionne 4Kautos', 'home.howSub': 'Notre processus sécurisé protège acheteurs et vendeurs, de la mise en ligne à la remise des clés.',
      'home.step1t': 'Parcourir & rechercher', 'home.step1d': 'Filtrez par marque, modèle, année, prix et état pour trouver la perle rare dans notre stock vérifié.',
      'home.step2t': 'Demander une inspection', 'home.step2d': "Lancez un achat et nos inspecteurs certifiés vérifient l'état du véhicule avant que vous vous engagiez.",
      'home.step3t': 'Payer sous séquestre', 'home.step3d': 'Vos fonds sont conservés en toute sécurité sous séquestre, puis versés au vendeur seulement quand vous êtes satisfait.',
      'home.step4t': 'Prenez la route', 'home.step4d': 'Le titre est transféré, les clés remises. Votre nouvelle voiture est prête. Nous gérons toutes les démarches.',
      'home.whyLabel': 'Pourquoi 4Kautos', 'home.whyTitle': 'Conçu pour acheter <em>en confiance</em>', 'home.whySub': 'Stock vérifié, séquestre sécurisé et dédouanement porte-à-porte. Les étapes qui tournent mal, gérées pour vous.',
      'home.why1': 'Voitures livrées & dédouanées', 'home.why2': 'Annonces avec inspection', 'home.why3': 'Dédouanement moyen au port', 'home.why4': 'Frais cachés, jamais',
      'home.reviewsLabel': 'Plébiscité par les conducteurs', 'home.reviewsTitle': 'Ce que disent nos acheteurs',
      'home.review1': `« J'ai acheté une Lexus auprès d'un vendeur au Japon et 4Kautos a géré les droits et le transport. Le coût rendu annoncé était juste. Zéro surprise au port. »`, 'home.review1meta': 'Lagos · Acheteur vérifié',
      'home.review2': `« En tant que vendeur à Houston, publier a été un jeu d'enfant et j'ai été payé via le séquestre dès la confirmation de l'acheteur. De loin l'export le plus fluide que j'aie réalisé. »`, 'home.review2meta': 'Houston · Vendeur vérifié',
      'home.review3': `« La double tarification ₦/$ et l'estimateur de dédouanement m'ont aidé à bien budgétiser avant de m'engager. Livrée à Abuja dans les temps. »`, 'home.review3meta': 'Abuja · Acheteur vérifié',
      'home.promoTitle': "Vous vendez depuis l'étranger ? Publiez gratuitement ce mois-ci.", 'home.promoText': "Touchez des milliers d'acheteurs nigérians. Nous gérons dédouanement, séquestre et livraison. Vous remettez simplement les clés.", 'home.promoCta': 'Commencer à vendre →',
      // Fenêtre de connexion
      'auth.login': 'Connexion', 'auth.signup': "S'inscrire", 'auth.email': 'E-mail', 'auth.password': 'Mot de passe', 'auth.passwordPh': 'Votre mot de passe',
      'auth.fullName': 'Nom complet', 'auth.namePh': 'Jean Dupont', 'auth.pwMin': 'Min. 6 caractères', 'auth.forgot': 'Mot de passe oublié ?',
      'auth.resend': 'Renvoyer l’e-mail de vérification', 'auth.enterEmail': 'Saisissez d’abord votre e-mail ci-dessus', 'toast.verifyResent': 'E-mail de vérification envoyé — vérifiez votre boîte (et les spams).',
      'auth.noAccountQ': 'Pas de compte ?', 'auth.createOne': 'Créez-en un', 'auth.iam': 'Je suis', 'auth.buyer': 'Acheteur', 'auth.seller': 'Vendeur',
      'auth.roleNote': `Vous créez un compte <strong>vendeur</strong> pour publier votre voiture.`, 'auth.buyInstead': 'Inscrivez-vous plutôt pour acheter',
      'auth.createBtn': 'Créer un compte', 'auth.haveAccountQ': 'Vous avez déjà un compte ?', 'auth.signinLink': 'Connectez-vous',
      // Fenêtres contact + mot de passe oublié
      'contact.title': 'Envoyez-nous un message', 'contact.intro': 'Questions, retours ou aide sur une annonce. Nous vous répondrons par e-mail.',
      'contact.name': 'Votre nom', 'contact.message': 'Message', 'contact.msgPh': 'Comment pouvons-nous aider ?', 'contact.send': 'Envoyer le message',
      'contact.sending': 'Envoi…', 'contact.fillAll': 'Veuillez renseigner votre nom, votre e-mail et votre message.',
      'forgot.title': 'Réinitialiser le mot de passe', 'forgot.intro': "Saisissez l'e-mail de votre compte et nous vous enverrons un lien de réinitialisation.", 'forgot.send': 'Envoyer le lien',
      // Notifications
      'toast.welcomeBack': 'Bon retour ! 🚗', 'toast.accountCreated': 'Compte créé ! Bienvenue chez 4Kautos 🚗',
      'toast.verifyEmail': 'Compte créé ! Vérifiez votre e-mail pour confirmer votre adresse avant de vous connecter.',
      'toast.contactSent': 'Message envoyé. Nous vous recontacterons ✉️',
    },
  };

  const getLang = () => { const l = localStorage.getItem('4k_lang'); return I18N[l] ? l : 'en'; };
  const lookup  = key => { const d = I18N[getLang()] || I18N.en; return d[key] ?? I18N.en[key]; };

  window.t = (key, fallback) => lookup(key) ?? fallback ?? key;

  window.applyI18n = (root = document) => {
    root.querySelectorAll('[data-i18n]').forEach(el => { const v = lookup(el.getAttribute('data-i18n')); if (v != null) el.textContent = v; });
    root.querySelectorAll('[data-i18n-html]').forEach(el => { const v = lookup(el.getAttribute('data-i18n-html')); if (v != null) el.innerHTML = v; });
    root.querySelectorAll('[data-i18n-ph]').forEach(el => { const v = lookup(el.getAttribute('data-i18n-ph')); if (v != null) el.setAttribute('placeholder', v); });
    document.documentElement.lang = getLang();
  };

  window.setLang = lang => { if (!I18N[lang]) return; localStorage.setItem('4k_lang', lang); window.applyI18n(document); };

  function injectSwitcher() {
    const actions = document.querySelector('.nav-actions');
    if (!actions || document.getElementById('lang-switcher')) return;
    const sel = document.createElement('select');
    sel.id = 'lang-switcher';
    sel.className = 'lang-switcher';
    sel.setAttribute('aria-label', 'Language');
    sel.innerHTML = Object.entries(LANGS).map(([code, label]) => `<option value="${code}">${label}</option>`).join('');
    sel.value = getLang();
    sel.addEventListener('change', () => window.setLang(sel.value));
    actions.insertBefore(sel, actions.firstChild);
  }

  // Tag the shared nav by stable selectors so every page is covered without
  // editing each file's markup. Idempotent (re-tagging sets the same keys).
  function tagNav() {
    document.querySelectorAll('.nav-links a').forEach(a => {
      const h = a.getAttribute('href') || '';
      if (/how-it-works/.test(h))   a.setAttribute('data-i18n', 'nav.how');
      else if (/listings/.test(h))  a.setAttribute('data-i18n', 'nav.listings');
      else if (/clearance/.test(h)) a.setAttribute('data-i18n', 'nav.clearance');
      else if (/index\.html|^\/?$/.test(h)) a.setAttribute('data-i18n', 'nav.home');
    });
    document.getElementById('nav-login-btn')?.setAttribute('data-i18n', 'nav.signin');
    document.getElementById('nav-signup-btn')?.setAttribute('data-i18n', 'nav.sell');
    document.getElementById('nav-q')?.setAttribute('data-i18n-ph', 'nav.search_ph');
  }

  function init() { tagNav(); injectSwitcher(); window.applyI18n(document); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

/* ── BOOT ─────────────────────────────────── */
Money.load();                       // fetch live FX, then reprice
Landed.hydrate();                   // refresh duty pcts from the backend (no drift)
document.addEventListener('DOMContentLoaded', () => Money.repriceAll());

/* Progressive animation layer (anime.js v4). Optional & self-contained —
   loaded as a module so it can import anime.js; fails silently if offline. */
import('/js/anim.js').catch(() => {});
