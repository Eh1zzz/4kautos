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

  function addBotMsg(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg bot';
    el.innerHTML = `
      <div class="msg-avatar bot-avatar-sm">🤖</div>
      <div class="msg-bubble">${text.replace(/\n/g,'<br>')}</div>`;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addUserMsg(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg user';
    el.innerHTML = `
      <div class="msg-avatar user-avatar-sm">You</div>
      <div class="msg-bubble">${text}</div>`;
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
      <span class="logo-autos">Premium Marketplace</span>
    </div>`;
});
