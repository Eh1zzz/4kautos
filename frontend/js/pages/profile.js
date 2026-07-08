  function switchTab(name) {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.toggle('active', t.id === `tab-${name}`));
    document.querySelectorAll('.profile-tab').forEach(t => { if (t.id !== `tab-${name}`) t.classList.add('hidden'); else t.classList.remove('hidden'); });
    document.querySelectorAll('.profile-nav-link').forEach(l => l.classList.toggle('active', l.dataset.tab === name));
  }

  document.querySelectorAll('.profile-nav-link[data-tab]').forEach(link => {
    link.addEventListener('click', () => {
      switchTab(link.dataset.tab);
      if (link.dataset.tab === 'add-car')      resetListingForm();
      if (link.dataset.tab === 'listings')     loadMyListings();
      if (link.dataset.tab === 'transactions') loadTransactions();
      if (link.dataset.tab === 'messages')     loadThreads();
      if (link.dataset.tab === 'saved')        loadSavedSearches();
      if (link.dataset.tab === 'saved-cars')   loadSavedCars();
      if (link.dataset.tab === 'admin')        loadAdmin();
    });
  });

  async function init() {
    const user = API.getUser();
    if (!API.isLoggedIn() || !user) {
      document.getElementById('auth-gate').style.display = 'flex';
      return;
    }
    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('profile-layout').classList.remove('hidden');
    document.getElementById('logout-btn').style.display = '';
    document.getElementById('nav-login-btn').classList.add('hidden');
    document.getElementById('nav-signup-btn').classList.add('hidden');

    const initials = user.name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) || '?';
    document.getElementById('p-ava').textContent  = initials;
    document.getElementById('p-name').textContent = user.name || '—';
    document.getElementById('p-role').textContent = user.role?.toUpperCase() || 'BUYER';

    // ── Role-scoped dashboard (strict RBAC) ─────────────────────────────
    // Admin  → system-wide ops only (no personal listings/tx/messages/saved/overview)
    // Seller → Overview, My Listings, Add Listing, Transactions, Messages
    // Buyer  → Overview, Saved searches, Transactions, Messages
    const navLink = tab => document.querySelector(`.profile-nav-link[data-tab="${tab}"]`);
    const hideTab = tab => { const l = navLink(tab); if (l) l.style.display = 'none'; };

    if (user.role === 'admin') {
      ['overview', 'listings', 'transactions', 'messages', 'saved', 'saved-cars'].forEach(hideTab);
      document.getElementById('admin-nav').style.display = 'flex';
      switchTab('admin'); loadAdmin();
    } else if (user.role === 'seller') {
      document.getElementById('add-car-nav').style.display = 'flex';
      document.getElementById('new-listing-btn').style.display = '';
      hideTab('saved');                 // saved searches is a buyer feature
      hideTab('saved-cars');            // saved cars too
    } else { // buyer
      hideTab('listings');              // "My Listings" is seller inventory
      setupBuyerLocation();             // saved location card in the overview
    }

    // Load overview counts (skip for admin — overview is hidden). The first card
    // is sellers' listing count, repurposed to saved-searches count for buyers.
    if (user.role !== 'admin') {
      try {
        if (user.role === 'seller') {
          const [listings, txs] = await Promise.allSettled([API.getCars({ sellerId: user.id }), API.getMyTx()]);
          document.getElementById('stat-listings').textContent = listings.value?.length ?? '—';
          document.getElementById('stat-tx').textContent = txs.value?.length ?? '—';
        } else {
          document.getElementById('stat-listings-lbl').textContent = 'Saved searches';
          const [saved, txs] = await Promise.allSettled([API.getSavedSearches?.(), API.getMyTx()]);
          document.getElementById('stat-listings').textContent = saved.value?.length ?? '0';
          document.getElementById('stat-tx').textContent = txs.value?.length ?? '—';
        }
      } catch {}
    }

    // Deep-link from a listing's detail page: ?edit=<id> opens that car in the edit form.
    const editId = new URLSearchParams(location.search).get('edit');
    if (editId && user.role === 'seller') editListing(editId);
  }

  // Buyer's saved location (overview card) — loads current value + wires Save.
  async function setupBuyerLocation() {
    const card = document.getElementById('buyer-loc-card');
    if (!card) return;
    card.style.display = '';
    const input = document.getElementById('buyer-location');
    const hint  = document.getElementById('buyer-location-hint');
    try { const { user } = await API.getMe(); input.value = user?.location || ''; } catch {}
    document.getElementById('buyer-location-save').onclick = async () => {
      const loc = input.value.trim();
      hint.className = 'field-hint'; hint.textContent = 'Saving…';
      try {
        const { user } = await API.updateLocation(loc);
        try { const u = API.getUser() || {}; u.location = user?.location ?? loc; localStorage.setItem('4k_user', JSON.stringify(u)); } catch {}
        hint.className = 'field-hint ok'; hint.textContent = loc ? '✓ Saved' : '✓ Cleared';
        toast('Location saved', 'success');
      } catch (e) { hint.className = 'field-hint bad'; hint.textContent = e.message || 'Could not save'; }
    };
  }

  async function loadMyListings() {
    const el = document.getElementById('my-listings-content');
    el.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    try {
      const user = API.getUser();
      const cars = await API.getCars({ sellerId: user?.id });
      if (!cars.length) { el.innerHTML = `<div class="empty-state" style="padding:2.5rem"><p>You have no active listings. <a href="#" data-act="switch-tab" data-tab="add-car" style="color:var(--accent)">Add one!</a></p></div>`; return; }
      el.innerHTML = cars.map(c => `
        <div class="tx-row">
          <div>
            <div class="tx-car">${esc(c.title || `${c.year} ${c.make} ${c.model}`)}</div>
            <div class="tx-meta"><span class="js-price" data-amount="${esc(c.price)}" data-native="${esc(c.currency||'NGN')}">${Money.fmt(c.price, c.currency||'NGN')}</span> · ${esc(c.condition)} · ${Number(c.mileage||0).toLocaleString()} km</div>
          </div>
          <a href="detail.html?id=${esc(c.id)}" class="card-cta" style="text-decoration:none;font-size:.75rem">View</a>
          <button data-act="edit-listing" data-id="${esc(c.id)}" style="color:var(--accent);font-size:.78rem;padding:4px 10px;border-radius:6px;background:rgba(139,124,255,.1);border:1px solid rgba(139,124,255,.28);cursor:pointer">Edit</button>
          <button data-act="delete-car" data-id="${esc(c.id)}" style="color:var(--red);font-size:.78rem;padding:4px 10px;border-radius:6px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2)">Delete</button>
        </div>`).join('');
    } catch(e) { el.innerHTML = `<p class="empty-state">Failed: ${e.message}</p>`; }
  }

  async function deleteCar(id) {
    if (!confirm('Delete this listing?')) return;
    try { await API.deleteCar(id); toast('Listing deleted', 'success'); loadMyListings(); }
    catch(e) { toast(e.message, 'error'); }
  }

  async function loadSavedSearches() {
    const el = document.getElementById('saved-content');
    el.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    try {
      const items = await API.getSavedSearches();
      if (!items.length) { el.innerHTML = `<div class="empty-state" style="padding:2.5rem"><p>No saved searches yet. Browse <a href="listings.html" style="color:var(--accent)">listings</a> and tap “🔖 Save search”.</p></div>`; return; }
      el.innerHTML = items.map(s => {
        const qs = new URLSearchParams(s.filters || {}).toString();
        return `<div class="tx-row">
          <div>
            <div class="tx-car">${esc(s.label)}</div>
            <div class="tx-meta">Saved ${new Date(s.created_at).toLocaleDateString()}</div>
          </div>
          <a href="listings.html${qs ? '?' + esc(qs) : ''}" class="card-cta" style="text-decoration:none;font-size:.75rem">View results</a>
          <button data-act="remove-saved-search" data-id="${esc(s.id)}" style="color:var(--red);font-size:.78rem;padding:4px 10px;border-radius:6px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2)">Delete</button>
        </div>`;
      }).join('');
    } catch (e) { el.innerHTML = `<p class="empty-state">Failed: ${esc(e.message)}</p>`; }
  }

  // Saved cars: server-synced hearts, rendered with the shared card grid.
  async function loadSavedCars() {
    const el = document.getElementById('saved-cars-content');
    el.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    try {
      const cars = await API.getSavedCars(true); // full=1 → full car rows
      if (!cars.length) {
        el.innerHTML = `<div class="empty-state" style="padding:2.5rem"><p>${esc(window.t('dash.noSavedCars', 'No saved cars yet. Tap the ♡ on any listing to save it here.'))} <a href="listings.html" style="color:var(--accent)">${esc(window.t('dash.browseListings', 'Browse listings'))}</a></p></div>`;
        return;
      }
      el.innerHTML = `<div class="cars-grid">${cars.map(c => window.carCard(c)).join('')}</div>`;
      window.observeReveals?.();
      Money.repriceAll?.();
    } catch (e) { el.innerHTML = `<p class="empty-state">Failed: ${esc(e.message)}</p>`; }
  }
  // When a heart is toggled elsewhere while this tab is open, keep it fresh.
  window.addEventListener('saved-sync', () => {
    if (document.getElementById('tab-saved-cars')?.classList.contains('active')) loadSavedCars();
  });
  // Un-hearting a card on THIS tab should drop it from the grid. app.js's shared
  // handler toggles first (document-level, runs after this bubble), so re-check
  // on the next tick and remove any card that's no longer saved.
  document.getElementById('saved-cars-content')?.addEventListener('click', e => {
    const save = e.target.closest('.card-saves'); if (!save) return;
    const card = save.closest('.car-card');
    setTimeout(() => { if (card && !API.isSaved(save.dataset.save)) card.remove(); }, 0);
  });

  async function removeSavedSearch(id) {
    if (!confirm('Delete this saved search?')) return;
    try { await API.deleteSavedSearch(id); toast('Saved search removed', 'success'); loadSavedSearches(); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function loadTransactions() {
    if (API.getUser()?.role === 'seller') { document.getElementById('payout-panel').classList.remove('hidden'); loadPayout(); }
    const el = document.getElementById('tx-content');
    el.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    try {
      const txs = await API.getMyTx();
      if (!txs.length) { el.innerHTML = '<div class="empty-state" style="padding:2.5rem"><p>No transactions yet.</p></div>'; return; }
      const me = API.getUser();
      el.innerHTML = txs.map(t => {
        const car   = t.car;
        const other = me?.id === t.buyer_id ? t.seller?.name : t.buyer?.name;
        const isBuyer   = me?.id === t.buyer_id;
        const canPay    = isBuyer && ['initiated','pending_inspection'].includes(t.status);
        const canSettle = (isBuyer || me?.role === 'admin') && t.status === 'payment_in_escrow';
        const canReview = isBuyer && t.status === 'completed' && !t.review_id;
        return `<div class="tx-row">
          <div>
            <div class="tx-car">${esc(car?.title || 'Car Listing')}</div>
            <div class="tx-meta">${other ? `${isBuyer ? 'Purchase from' : 'Sale to'} ${esc(other)}` : ''} · <span class="js-price" data-amount="${esc(car?.price ?? '')}" data-native="${esc(car?.currency||'NGN')}">${car?.price!=null ? Money.fmt(car.price, car.currency||'NGN') : '—'}</span></div>
          </div>
          <span class="tx-status status-${t.status}">${t.status.replace(/_/g,' ')}</span>
          ${t.payout_status ? `<span class="tx-status" style="background:rgba(139,124,255,.14);color:var(--accent)">${t.payout_status === 'pending' ? 'payout pending' : t.payout_status === 'paid' ? 'paid out' : 'sent to seller'}</span>` : ''}
          <div class="tx-actions">
            ${canPay ? `<button class="pay-btn" data-act="pay-escrow" data-id="${t.id}">💳 Pay into escrow</button>` : ''}
            ${canSettle ? `<button class="pay-btn" data-act="release-tx" data-id="${t.id}">✓ Confirm &amp; release</button>` : ''}
            ${canSettle ? `<button class="adm-btn danger" data-act="refund-tx" data-id="${t.id}">Cancel &amp; refund</button>` : ''}
            ${canReview ? `<button class="pay-btn" data-act="review-tx" data-id="${t.id}">★ ${esc(window.t('review.rate', 'Rate seller'))}</button>` : ''}
            ${isBuyer && t.status === 'completed' && t.review_id ? `<span class="tx-status" style="background:rgba(240,180,41,.14);color:#f0b429">★ ${esc(window.t('review.done', 'reviewed'))}</span>` : ''}
            <select data-chg="update-tx" data-id="${t.id}" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:6px;font-size:.75rem">
              <option value="">Update…</option>
              <option value="pending_inspection">Inspection</option>
              <option value="cancelled">Cancel</option>
            </select>
            ${t.status === 'cancelled' ? `<button class="adm-btn danger" data-act="remove-tx" data-id="${t.id}">🗑 Delete</button>` : ''}
          </div>
        </div>`;
      }).join('');
    } catch(e) { el.innerHTML = `<p class="empty-state">Failed: ${e.message}</p>`; }
  }

  // Post-purchase review: 5 tappable stars + optional comment in a small modal.
  function openReviewModal(txId) {
    document.getElementById('review-modal')?.remove();
    const m = document.createElement('div');
    m.id = 'review-modal'; m.className = 'rv-overlay';
    m.innerHTML = `
      <div class="rv-card" role="dialog" aria-modal="true" aria-label="${esc(window.t('review.title', 'Rate the seller'))}">
        <h3>${esc(window.t('review.title', 'Rate the seller'))}</h3>
        <div class="rv-stars">${[1, 2, 3, 4, 5].map(i =>
          `<button type="button" data-star="${i}" aria-label="${i}/5">★</button>`).join('')}</div>
        <textarea id="rv-comment" maxlength="600" placeholder="${esc(window.t('review.ph', 'How was the deal? (optional)'))}"></textarea>
        <div class="rv-actions">
          <button class="adm-btn" type="button" id="rv-cancel">${esc(window.t('review.cancel', 'Cancel'))}</button>
          <button class="pay-btn" type="button" id="rv-submit" disabled>${esc(window.t('review.submit', 'Submit review'))}</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    let rating = 0;
    m.addEventListener('click', e => {
      const s = e.target.closest('[data-star]');
      if (s) {
        rating = +s.dataset.star;
        m.querySelectorAll('[data-star]').forEach(b => b.classList.toggle('on', +b.dataset.star <= rating));
        m.querySelector('#rv-submit').disabled = !rating;
        return;
      }
      if (e.target === m || e.target.id === 'rv-cancel') m.remove();
    });
    m.querySelector('#rv-submit').addEventListener('click', async () => {
      try {
        await API.createReview(txId, rating, m.querySelector('#rv-comment').value.trim());
        toast(window.t('review.thanks', 'Thanks! Your review is live'), 'success');
        m.remove();
        loadTransactions();
      } catch (e) { toast(e.message || 'Could not post the review', 'error'); }
    });
  }

  async function updateTx(id, status) {
    if (!status) return;
    try { await API.updateTxStatus(id, status); toast('Status updated', 'success'); loadTransactions(); }
    catch(e) { toast(e.message, 'error'); }
  }

  // Start the escrow payment → redirect to Flutterwave's hosted checkout.
  async function payEscrow(id, btn) {
    btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Starting…';
    try {
      const { link } = await API.initiatePayment(id);
      window.location.href = link;
    } catch (e) {
      toast(e.message || 'Could not start payment', 'error');
      btn.disabled = false; btn.textContent = orig;
    }
  }

  // Reverse an escrowed payment (buyer or admin) → buyer is credited.
  async function refundTx(id, btn) {
    if (!confirm('Refund this payment? The buyer is credited and the transaction is cancelled.')) return;
    btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Refunding…';
    try { await API.refundPayment(id); toast('Refund issued', 'success'); loadTransactions(); }
    catch (e) { toast(e.message || 'Refund failed', 'error'); btn.disabled = false; btn.textContent = orig; }
  }

  // Buyer confirms receipt → release escrowed funds to the seller.
  async function releaseTx(id, btn) {
    if (!confirm('Confirm you’ve received the vehicle and release the funds to the seller? This cannot be undone.')) return;
    btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Releasing…';
    try { await API.releasePayment(id); toast('Funds released to the seller', 'success'); loadTransactions(); }
    catch (e) { toast(e.message || 'Release failed', 'error'); btn.disabled = false; btn.textContent = orig; }
  }

  // Delete a cancelled (dead) transaction from history. Backend enforces
  // status='cancelled' + that you're a participant.
  async function removeTx(id, btn) {
    if (!confirm('Delete this cancelled transaction from your history? This can’t be undone.')) return;
    btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Deleting…';
    try { await API.deleteTx(id); toast('Transaction removed', 'success'); loadTransactions(); }
    catch (e) { toast(e.message || 'Delete failed', 'error'); btn.disabled = false; btn.textContent = orig; }
  }

  // Seller payout details — two rails: a Nigerian bank (auto via Flutterwave) or
  // an international account (settled manually / via Wise for now).
  let _payoutBanks = [];
  const COUNTRIES = ['United States','United Kingdom','Canada','Germany','France','Netherlands','Belgium','Spain','Italy','Ireland','Sweden','Switzerland','Austria','Denmark','Norway','Finland','Portugal','Poland','Greece','Japan','China','South Korea','Hong Kong','Singapore','United Arab Emirates','Saudi Arabia','Qatar','India','Pakistan','South Africa','Ghana','Kenya','Egypt','Australia','New Zealand','Brazil','Mexico','Turkey','Nigeria'];
  const CURRENCIES = ['USD','EUR','GBP','JPY','CNY','AED','SAR','QAR','CAD','AUD','NZD','CHF','SEK','ZAR','GHS','KES','INR','NGN','BRL','TRY'];
  async function loadPayout() {
    const el = document.getElementById('payout-content');
    const fld = 'background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:.85rem';
    try {
      const [payout, banks] = await Promise.all([
        API.getPayout().catch(() => ({})),
        API.getBanks().catch(() => []),
      ]);
      _payoutBanks = banks;
      const m = payout?.payout_method || 'ng_bank';
      const savedNg = payout?.payout_method === 'ng_bank' && payout.account_number;
      const savedIntl = payout?.payout_method === 'international';
      const savedBankName = savedNg ? (banks.find(b => b.code === payout.bank_code)?.name || '') : '';
      const bankOpts = banks.map(b => `<option value="${esc(b.name)}"></option>`).join('');
      const countryOpts = COUNTRIES.map(c => `<option value="${esc(c)}" ${savedIntl && payout.payout_country === c ? 'selected' : ''}>${esc(c)}</option>`).join('');
      const currencyOpts = CURRENCIES.map(c => `<option value="${esc(c)}" ${savedIntl && payout.payout_currency === c ? 'selected' : ''}>${esc(c)}</option>`).join('');
      const summary = payout?.payout_method
        ? `<p style="color:var(--text2);font-size:.85rem;margin-bottom:.85rem">Paying out to <b>${esc(payout.account_name || '')}</b>${savedIntl ? ` · ${esc(payout.payout_country || '')} (international)` : payout.account_number ? ` · ${esc(payout.account_number)}` : ''}</p>`
        : `<p style="color:var(--text3);font-size:.85rem;margin-bottom:.85rem">Add where we should pay you so buyers can release funds.</p>`;
      el.innerHTML = `
        ${summary}
        <div class="payout-tabs" style="display:flex;gap:.5rem;margin-bottom:.9rem">
          <button type="button" class="po-tab ${m === 'ng_bank' ? 'pay-btn' : 'adm-btn'}" data-m="ng_bank">🇳🇬 Nigerian bank</button>
          <button type="button" class="po-tab ${m === 'international' ? 'pay-btn' : 'adm-btn'}" data-m="international">🌍 International</button>
        </div>
        <form id="payout-form">
          <div class="po-fields ${m === 'ng_bank' ? '' : 'hidden'}" data-m="ng_bank" style="display:flex;flex-wrap:wrap;gap:.6rem">
            <input id="po-bank" list="bank-list" autocomplete="off" placeholder="Type your bank…" value="${esc(savedBankName)}" style="flex:1 1 180px;${fld}">
            <datalist id="bank-list">${bankOpts}</datalist>
            <input id="po-acct" inputmode="numeric" placeholder="Account number" value="${savedNg ? esc(payout.account_number) : ''}" style="flex:1 1 150px;${fld}">
          </div>
          <div class="po-fields ${m === 'international' ? '' : 'hidden'}" data-m="international" style="display:flex;flex-wrap:wrap;gap:.6rem">
            <input id="po-name" placeholder="Account holder name" value="${savedIntl ? esc(payout.account_name || '') : ''}" style="flex:1 1 180px;${fld}">
            <select id="po-country" style="flex:1 1 150px;${fld}"><option value="">Country…</option>${countryOpts}</select>
            <select id="po-currency" style="flex:0 1 110px;${fld}"><option value="">Currency…</option>${currencyOpts}</select>
            <input id="po-details" placeholder="IBAN / SWIFT / account + routing" value="${savedIntl ? esc(payout.payout_details || '') : ''}" style="flex:1 1 100%;${fld}">
          </div>
          <button type="submit" class="pay-btn" style="margin-top:.7rem">Save payout</button>
        </form>
        ${banks.length === 0 ? '<p style="color:var(--text3);font-size:.72rem;margin-top:.5rem">Nigerian bank list unavailable. Payments may not be configured yet.</p>' : ''}`;
      el.querySelectorAll('.po-tab').forEach(tab => tab.addEventListener('click', () => {
        const method = tab.dataset.m;
        el.querySelectorAll('.po-tab').forEach(t => { t.classList.toggle('pay-btn', t.dataset.m === method); t.classList.toggle('adm-btn', t.dataset.m !== method); });
        el.querySelectorAll('.po-fields').forEach(f => f.classList.toggle('hidden', f.dataset.m !== method));
      }));
      document.getElementById('payout-form').addEventListener('submit', savePayoutDetails);
    } catch (e) {
      el.innerHTML = `<p style="color:var(--red);font-size:.85rem">${esc(e.message || 'Could not load payout settings')}</p>`;
    }
  }

  async function savePayoutDetails(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const method = document.querySelector('.po-fields:not(.hidden)')?.dataset.m || 'ng_bank';
    let payload;
    if (method === 'ng_bank') {
      const typed = document.getElementById('po-bank').value.trim();
      const accountNumber = document.getElementById('po-acct').value.trim();
      const bank = _payoutBanks.find(b => b.name.toLowerCase() === typed.toLowerCase());
      if (!bank) { toast('Pick your bank from the list', 'error'); return; }
      if (!accountNumber) { toast('Enter your account number', 'error'); return; }
      payload = { method: 'ng_bank', bankCode: bank.code, accountNumber };
    } else {
      const accountName = document.getElementById('po-name').value.trim();
      const country = document.getElementById('po-country').value.trim();
      const currency = document.getElementById('po-currency').value.trim();
      const details = document.getElementById('po-details').value.trim();
      if (!accountName || !country || !details) { toast('Name, country and bank details are required', 'error'); return; }
      payload = { method: 'international', accountName, country, currency, details };
    }
    btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Saving…';
    try {
      const { payout } = await API.savePayout(payload);
      toast(payout?.account_name ? `Saved: ${payout.account_name}` : 'Payout details saved', 'success');
      loadPayout();
    } catch (err) { toast(err.message || 'Could not save', 'error'); btn.disabled = false; btn.textContent = orig; }
  }

  async function loadThreads() {
    const el = document.getElementById('threads-content');
    el.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    try {
      const threads = await API.getThreads();
      const me = API.getUser();
      if (!threads.length) {
        const emptyMsg = me?.role === 'seller'
          ? 'No conversations yet. Awaiting an interested buyer.'
          : 'No conversations yet. Message a seller from any car page to start one.';
        el.innerHTML = `<div class="empty-state" style="padding:2.5rem"><p>${emptyMsg}</p></div>`;
        return;
      }
      el.innerHTML = '<div class="thread-list">' + threads.map(t => {
        const other = (me.id === t.buyer_id ? t.seller_name : t.buyer_name) || 'User';
        const initials = other.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return `<div class="thread-row" data-car="${esc(t.car_id)}" data-buyer="${esc(t.buyer_id)}" data-name="${esc(other)}" data-cartitle="${esc(t.car_title || 'Listing')}">
          <div class="thread-ava">${esc(initials)}</div>
          <div class="thread-row-main">
            <div class="thread-row-name">${esc(other)}</div>
            <div class="thread-row-car">${esc(t.car_title || 'Listing')}</div>
            <div class="thread-row-last">${esc(t.last_body || '')}</div>
          </div>
          ${t.unread > 0 ? `<span class="thread-unread">${t.unread}</span>` : ''}
        </div>`;
      }).join('') + '</div>';
      el.querySelectorAll('.thread-row').forEach(row => row.addEventListener('click', () => {
        row.querySelector('.thread-unread')?.remove();   // optimistic: clear the unread badge on open
        openChatThread({ carId: +row.dataset.car, buyerId: +row.dataset.buyer, title: row.dataset.name, sub: row.dataset.cartitle });
      }));
    } catch (e) {
      el.innerHTML = `<p class="empty-state">Failed: ${e.message}</p>`;
    }
  }
  // Let the chat panel re-sync this list (authoritative unread counts) after it
  // opens a thread and marks it read server-side.
  window.refreshThreads = loadThreads;

  /* ── Admin: users + listings management ── */
  // Admin: international payouts awaiting manual settlement.
  async function loadPendingPayouts() {
    const el = document.getElementById('admin-payouts');
    try {
      const rows = await API.adminPendingPayouts();
      if (!rows.length) { el.innerHTML = '<p style="color:var(--text3);font-size:.85rem;padding:.4rem 0">No payouts awaiting settlement. 🎉</p>'; return; }
      el.innerHTML = rows.map(r => `
        <div class="tx-row admin-row">
          <div>
            <div class="tx-car">${esc(r.payout_name || r.seller_name)}</div>
            <div class="tx-meta">${esc(r.car_title || 'Listing')} · ${Money.fmt(r.amount, r.currency || 'NGN')} → ${esc(r.payout_country || '')} ${esc(r.payout_currency || '')}</div>
            <div class="tx-meta" style="margin-top:.25rem;color:var(--text2)">${esc(r.payout_details || '')}</div>
          </div>
          <div class="admin-actions">
            <button class="adm-btn" data-act="mark-paid" data-id="${esc(r.id)}">Mark paid</button>
          </div>
        </div>`).join('');
    } catch (e) { el.innerHTML = `<p class="empty-state">Failed: ${esc(e.message)}</p>`; }
  }

  async function markPaid(id, btn) {
    if (!confirm('Mark this international payout as settled? Only after you have actually sent the funds.')) return;
    btn.disabled = true; btn.textContent = 'Saving…';
    try { await API.adminMarkPayoutPaid(id); toast('Marked as paid', 'success'); loadPendingPayouts(); }
    catch (e) { toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Mark paid'; }
  }

  // Wire the Maintenance → image-backfill buttons (idempotent via .onclick).
  function wireBackfill() {
    const dry = document.getElementById('backfill-dry');
    const ap  = document.getElementById('backfill-apply');
    const out = document.getElementById('backfill-out');
    if (!dry || !ap) return;
    const renderSummary = (s, apply) =>
      `${s.mode === 'apply' ? 'Image backfill complete' : 'Dry run complete'} (store: ${s.store})\n`
      + `scanned ${s.scanned} · ${apply ? 'updated' : 'to update'} ${s.carsChanged} cars · `
      + `${apply ? 'converted' : 'to convert'} ${s.converted} photos · already ok ${s.alreadyOk} · skipped ${s.skipped} · failed ${s.failed}`;

    // Runs detached on the server (won't time out on a large library); poll status.
    const run = async (apply) => {
      if (apply && !confirm('Regenerate image sizes now? This updates listing photos in place. Safe to run repeatedly.')) return;
      dry.disabled = ap.disabled = true;
      out.textContent = apply ? 'Starting regeneration…' : 'Starting preview…';
      try {
        await API.adminBackfillImages(apply, true); // async=1
        const poll = async () => {
          let j;
          try { j = await API.adminBackfillStatus(); }
          catch (e) { out.textContent = '✖ ' + (e.message || 'Failed'); dry.disabled = ap.disabled = false; return; }
          if (j.state === 'running') {
            const p = j.progress || {};
            out.textContent = `${j.mode === 'apply' ? 'Regenerating' : 'Checking'}… ${p.converted || 0} processed`
              + (p.failed ? ` · ${p.failed} failed` : '') + ' …';
            return void setTimeout(poll, 1500);
          }
          if (j.state === 'error') { out.textContent = '✖ ' + (j.error || 'Failed'); toast('Backfill failed', 'error'); }
          else if (j.state === 'done' && j.summary) { out.textContent = renderSummary(j.summary, apply); toast(apply ? 'Image sizes regenerated' : 'Preview ready', 'success'); }
          else { out.textContent = 'No backfill has run yet.'; }
          dry.disabled = ap.disabled = false;
        };
        poll();
      } catch (e) {
        out.textContent = '✖ ' + (e.message || 'Failed');
        toast(e.message || 'Backfill failed', 'error');
        dry.disabled = ap.disabled = false;
      }
    };
    dry.onclick = () => run(false);
    ap.onclick  = () => run(true);
  }

  async function loadAdmin() {
    loadAdminStats();
    loadAdminFlags();
    loadAdminActivity();
    loadAdminMap();
    loadPendingPayouts();
    loadAdminTransactions();
    loadContactMessages();
    wireBackfill();
    // Dashboard stat tiles
    try {
      const [u, c, p, m] = await Promise.all([
        API.adminUsers().catch(() => []),
        API.adminCars().catch(() => []),
        API.adminPendingPayouts().catch(() => []),
        API.adminContactMessages().catch(() => []),
      ]);
      const setTile = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n; };
      setTile('stat-users', u.length); setTile('stat-listings-admin', c.length);
      setTile('stat-payouts', p.length); setTile('stat-messages', m.length);
    } catch {}
    const usersEl = document.getElementById('admin-users');
    const carsEl  = document.getElementById('admin-cars');
    usersEl.innerHTML = carsEl.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    const me = API.getUser();
    try {
      const users = await API.adminUsers();
      document.getElementById('admin-user-count').textContent = users.length + ' total';
      usersEl.innerHTML = users.map(u => `
        <div class="tx-row admin-row">
          <div>
            <div class="tx-car">${esc(u.name)}<span class="role-chip role-${esc(u.role)}">${esc(u.role)}</span>${u.verified ? '<span class="verif-chip">✓ verified</span>' : ''}</div>
            <div class="tx-meta">${esc(u.email)} · joined ${u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}</div>
          </div>
          <div class="admin-actions">
            ${!u.verified ? `<button class="adm-btn" data-act="admin-verify" data-id="${esc(u.id)}">Verify</button>` : ''}
            ${u.id === me.id ? '<span style="font-size:.72rem;color:var(--text3)">you</span>' : `<button class="adm-btn danger" data-act="admin-delete-user" data-id="${esc(u.id)}" data-name="${esc(u.name)}">Delete</button>`}
          </div>
        </div>`).join('');
    } catch (e) { usersEl.innerHTML = `<p class="empty-state">Failed: ${e.message}</p>`; }
    try {
      const cars = await API.adminCars();
      carsEl.innerHTML = cars.length ? cars.map(c => `
        <div class="tx-row admin-row">
          <div>
            <div class="tx-car">${esc(c.title || `${c.make || ''} ${c.model || ''}`)}</div>
            <div class="tx-meta">${esc(c.seller?.name || '—')} · ${esc(c.location || 'no location')}</div>
          </div>
          <div class="admin-actions">
            <a href="detail.html?id=${esc(c.id)}" class="adm-btn" style="text-decoration:none">View</a>
            ${c.inspection_report ? `<a href="${esc(c.inspection_report)}" target="_blank" rel="noopener" class="adm-btn" style="text-decoration:none">📄 Report</a>` : ''}
            <button class="adm-btn" data-act="admin-feature" data-id="${esc(c.id)}" data-featured="${c.featured ? 0 : 1}">${c.featured ? '★ Unfeature' : '☆ Feature'}</button>
            <button class="adm-btn danger" data-act="admin-delete-car" data-id="${esc(c.id)}">Delete</button>
          </div>
        </div>`).join('') : '<div class="empty-state" style="padding:2rem"><p>No listings.</p></div>';
    } catch (e) { carsEl.innerHTML = `<p class="empty-state">Failed: ${e.message}</p>`; }
  }
  async function adminVerify(id) { try { await API.adminVerifyUser(id); toast('User verified', 'success'); loadAdmin(); } catch (e) { toast(e.message, 'error'); } }
  async function adminDeleteUser(id, name) {
    if (!confirm(`Delete user "${name}"?\nThis permanently removes their listings, messages and transactions.`)) return;
    try { await API.adminDeleteUser(id); toast('User deleted', 'success'); loadAdmin(); } catch (e) { toast(e.message, 'error'); }
  }
  async function adminDeleteCar(id) { if (!confirm('Delete this listing?')) return; try { await API.adminDeleteCar(id); toast('Listing removed', 'success'); loadAdmin(); } catch (e) { toast(e.message, 'error'); } }
  async function adminFeature(id, featured, btn) {
    btn.disabled = true;
    try { await API.adminSetFeatured(id, !!featured); toast(featured ? 'Added to Hot Sales 🔥' : 'Removed from Hot Sales', 'success'); loadAdmin(); }
    catch (e) { btn.disabled = false; toast(e.message, 'error'); }
  }
  async function loadAdminStats() {
    const tiles = document.getElementById('ops-tiles');
    if (!tiles) return;
    const usd = n => '$' + Math.round(n || 0).toLocaleString('en-US');
    try {
      const s = await API.adminStats();
      document.getElementById('ops-fx').textContent = `FX $1 = ₦${Math.round(s.fx.usdToNgn).toLocaleString('en-US')}`;
      const tile = (label, value, sub) => `<div class="ops-tile"><div class="ops-tile-v">${esc(String(value))}</div><div class="ops-tile-l">${esc(label)}</div>${sub ? `<div class="ops-tile-s">${esc(sub)}</div>` : ''}</div>`;
      tiles.innerHTML =
        tile('In escrow', usd(s.escrow.inEscrowUsd), `${s.funnel.inEscrow} live`) +
        tile('Completed', usd(s.escrow.completedUsd), `${s.funnel.completed} deals`) +
        tile('Pending payouts', usd(s.escrow.pendingPayoutUsd), `${s.escrow.pendingPayoutCount} queued`) +
        tile('Today', s.transactions.today, 'new transactions') +
        tile('Listings', s.counts.listings, `${s.counts.featured} featured`) +
        tile('Users', s.counts.users, `${s.counts.buyers} buyers · ${s.counts.sellers} sellers`);

      // Escrow liquidity — proportional segmented bar.
      const liq = [
        { k: 'In escrow', v: s.escrow.inEscrowUsd, c: 'var(--accent)' },
        { k: 'Completed', v: s.escrow.completedUsd, c: 'var(--green)' },
        { k: 'Pending payout', v: s.escrow.pendingPayoutUsd, c: 'var(--hot)' },
      ];
      const liqTotal = liq.reduce((a, x) => a + x.v, 0);
      document.getElementById('ops-liquidity').innerHTML = liqTotal > 0
        ? liq.filter(x => x.v > 0).map(x => `<span class="ops-seg" style="width:${(x.v / liqTotal * 100).toFixed(1)}%;background:${x.c}" title="${x.k}: ${usd(x.v)}"></span>`).join('')
        : '<span class="ops-seg" style="width:100%;background:var(--surface2)"></span>';
      document.getElementById('ops-liquidity-legend').innerHTML = liq.map(x => `<span class="ops-leg"><i style="background:${x.c}"></i>${esc(x.k)} ${usd(x.v)}</span>`).join('');

      // Conversion funnel.
      const f = s.funnel; const fmax = Math.max(f.initiated, f.inEscrow, f.completed, 1);
      const frow = (label, n) => `<div class="ops-frow"><span class="ops-flabel">${esc(label)}</span><span class="ops-ftrack"><span class="ops-fbar" style="width:${(n / fmax * 100).toFixed(0)}%"></span></span><span class="ops-fn">${n}</span></div>`;
      document.getElementById('ops-funnel').innerHTML = frow('Initiated', f.initiated) + frow('In escrow', f.inEscrow) + frow('Completed', f.completed);
    } catch (e) { tiles.innerHTML = `<p class="empty-state">Failed: ${esc(e.message)}</p>`; }
  }

  let _adminMap, _adminMapMarkers = [];
  async function loadAdminMap() {
    const box = document.getElementById('admin-map');
    if (!box || typeof L === 'undefined') return;
    try {
      const { points, buyerLocations } = await API.adminMap();
      document.getElementById('map-buyers').innerHTML = buyerLocations.length
        ? buyerLocations.map(b => `<span class="map-loc-chip">${esc(b.location)} <b>${b.count}</b></span>`).join('')
        : '<span style="color:var(--text3);font-size:.82rem">No buyer locations yet.</span>';

      if (!_adminMap) {
        _adminMap = L.map('admin-map', { scrollWheelZoom: false, attributionControl: false }).setView([9.08, 8.68], 4);
        const light = document.documentElement.getAttribute('data-theme') === 'light';
        L.tileLayer(`https://{s}.basemaps.cartocdn.com/${light ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png`, { subdomains: 'abcd', maxZoom: 19 }).addTo(_adminMap);
      }
      _adminMapMarkers.forEach(m => _adminMap.removeLayer(m));
      _adminMapMarkers = points.map(p => L.circleMarker([p.lat, p.lng], { radius: 7, color: '#8b7cff', fillColor: '#8b7cff', fillOpacity: .55, weight: 2 })
        .addTo(_adminMap).bindPopup(`<b>${esc(p.label)}</b><br>${esc(p.location || '')}`));
      if (points.length) _adminMap.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])).pad(0.3));
      setTimeout(() => _adminMap.invalidateSize(), 120); // correct sizing once the tab is visible
    } catch (e) { box.innerHTML = `<p class="empty-state">Failed: ${esc(e.message)}</p>`; }
  }

  async function loadAdminActivity() {
    const el = document.getElementById('admin-activity');
    if (!el) return;
    el.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    const ago = d => {
      const s = Math.max(1, Math.floor((Date.now() - new Date(d)) / 1000));
      if (s < 60) return s + 's ago';
      const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
      const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
      return Math.floor(h / 24) + 'd ago';
    };
    const ICON = { listing: '🚗', transaction: '💳', contact: '✉️', user: '👤' };
    try {
      const { items } = await API.adminActivity();
      if (!items.length) { el.innerHTML = '<div class="empty-state" style="padding:2rem"><p>No recent activity.</p></div>'; return; }
      el.innerHTML = '<div class="feed">' + items.map(i => {
        const text = i.link ? `<a href="${esc(i.link)}" target="_blank" rel="noopener" style="color:inherit">${esc(i.text)}</a>` : esc(i.text);
        return `<div class="feed-row"><span class="feed-ico feed-${esc(i.type)}">${ICON[i.type] || '•'}</span><span class="feed-text">${text}</span><span class="feed-time">${esc(ago(i.at))}</span></div>`;
      }).join('') + '</div>';
    } catch (e) { el.innerHTML = `<p class="empty-state">Failed: ${esc(e.message)}</p>`; }
  }

  async function loadAdminFlags() {
    const el = document.getElementById('admin-flags');
    if (!el) return;
    el.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    try {
      const f = await API.adminFlags();
      const cnt = document.getElementById('flags-count'); if (cnt) cnt.textContent = f.total ? `${f.total} to review` : 'all clear ✓';
      const group = (title, rows) => rows.length ? `<div class="flags-group"><div class="flags-group-title">${title} <span class="flags-badge">${rows.length}</span></div>${rows.join('')}</div>` : '';
      const row = (main, meta, action) => `<div class="tx-row admin-row"><div><div class="tx-car">${main}</div><div class="tx-meta">${meta}</div></div><div class="admin-actions">${action || ''}</div></div>`;
      const money = n => '$' + Number(n || 0).toLocaleString('en-US');

      const under = f.underpriced.map(c => row(
        `${esc(c.title || `${c.make} ${c.model}`)} <span class="flag-pill flag-warn">${esc(String(c.pct_below))}% below avg</span>`,
        `${money(c.car_usd)} vs ${money(c.avg_usd)} avg · ${c.comparables} comps · ${esc(c.seller_name)}`,
        `<a href="detail.html?id=${esc(c.id)}" target="_blank" rel="noopener" class="adm-btn" style="text-decoration:none">View</a>`));
      const dups = f.duplicateVins.map(d => row(
        `VIN ${esc(d.vin)} <span class="flag-pill flag-bad">${d.count}× listed</span>`,
        `Listings: ${d.carIds.map(id => '#' + id).join(', ')}`,
        d.carIds.map(id => `<a href="detail.html?id=${esc(id)}" target="_blank" rel="noopener" class="adm-btn" style="text-decoration:none">#${esc(id)}</a>`).join(' ')));
      const unver = f.unverifiedSellers.map(s => row(
        `${esc(s.name)} <span class="flag-pill">${s.listings} listings</span>`,
        `${esc(s.email)} · unverified seller`,
        `<button class="adm-btn" data-act="admin-verify" data-id="${esc(s.id)}">Verify</button>`));
      const stalled = f.stalledBuyers.map(b => row(
        `${esc(b.name)} <span class="flag-pill flag-warn">${b.open_unpaid} unpaid</span>`,
        `${esc(b.email)} · opened ${b.open_unpaid} transactions, never paid`, ''));

      const html = group('Under-market listings', under) + group('Duplicate VINs', dups)
                 + group('Unverified sellers', unver) + group('Buyers not completing', stalled);
      el.innerHTML = html || '<div class="empty-state" style="padding:2rem"><p>✓ No risk signals. All clear.</p></div>';
    } catch (e) { el.innerHTML = `<p class="empty-state">Failed: ${esc(e.message)}</p>`; }
  }

  async function loadAdminTransactions() {
    const el = document.getElementById('admin-tx');
    if (!el) return;
    el.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    try {
      const txs = await API.adminTransactions();
      const pending = txs.filter(t => ['initiated', 'pending_inspection', 'payment_in_escrow'].includes(t.status)).length;
      const cnt = document.getElementById('admin-tx-count');
      if (cnt) cnt.textContent = `${txs.length} total · ${pending} pending`;
      el.innerHTML = txs.length ? txs.map(t => {
        const amt = (t.amount != null && t.amount !== '') ? `${esc(t.currency || 'NGN')} ${Number(t.amount).toLocaleString()}` : '—';
        const payout = t.payout_status ? ` · payout ${esc(t.payout_status)}` : '';
        return `<div class="tx-row admin-row">
          <div>
            <div class="tx-car">${esc(t.car?.title || 'Listing')} <span class="tx-status">${esc((t.status || '').replace(/_/g, ' '))}</span></div>
            <div class="tx-meta">${esc(t.buyer?.name || '?')} → ${esc(t.seller?.name || '?')} · #${esc(t.id)} · ${t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}${payout}</div>
          </div>
          <div class="admin-actions"><span style="font-weight:700">${amt}</span></div>
        </div>`;
      }).join('') : '<div class="empty-state" style="padding:2rem"><p>No transactions yet.</p></div>';
    } catch (e) { el.innerHTML = `<p class="empty-state">Failed: ${esc(e.message)}</p>`; }
  }

  async function loadContactMessages() {
    const el = document.getElementById('admin-contact');
    if (!el) return;
    el.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
    try {
      const msgs = await API.adminContactMessages();
      el.innerHTML = msgs.length ? msgs.map(m => `
        <div class="tx-row admin-row">
          <div>
            <div class="tx-car">${esc(m.name)} · <a href="mailto:${esc(m.email)}" style="color:var(--accent)">${esc(m.email)}</a></div>
            <div class="tx-meta" style="white-space:pre-wrap">${esc(m.message)}</div>
            <div class="tx-meta" style="color:var(--text3)">${new Date(m.created_at).toLocaleString()}</div>
          </div>
          <div class="admin-actions">
            <button class="adm-btn danger" data-act="remove-contact" data-id="${esc(m.id)}">Delete</button>
          </div>
        </div>`).join('') : '<div class="empty-state" style="padding:2rem"><p>No messages yet.</p></div>';
    } catch (e) { el.innerHTML = `<p class="empty-state">Failed: ${esc(e.message)}</p>`; }
  }
  async function removeContact(id) {
    if (!confirm('Delete this message?')) return;
    try { await API.adminDeleteContact(id); toast('Message deleted', 'success'); loadContactMessages(); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* ── Add Listing: standards-enforced form ── */
  const REQUIRED_SHOTS = [
    { key:'front',    label:'Front 3/4 view' },
    { key:'rear',     label:'Rear 3/4 view' },
    { key:'interior', label:'Interior / seats' },
    { key:'odometer', label:'Dashboard / odometer' },
    { key:'engine',   label:'Engine bay' },
  ];
  const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
  const val = id => (document.getElementById(id)?.value || '').trim();
  const csv = id => (val(id) || '').split(',').map(s => s.trim()).filter(Boolean);
  let editingId = null;   // null = creating a new listing; a car id = editing that one

  /* Location geocoding + map preview */
  let geo = { lat: null, lng: null, display: null };
  let uploadMap = null, uploadMarker = null;
  const tileUrlP = () => document.documentElement.getAttribute('data-theme') !== 'light'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  async function geocodeLocation(q){
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
    const d = await res.json();
    return d && d[0] ? { lat: +d[0].lat, lng: +d[0].lon, display: d[0].display_name } : null;
  }

  document.getElementById('locate-btn').addEventListener('click', async () => {
    const q = val('car-location'); const hint = document.getElementById('loc-hint');
    if (!q) { hint.className = 'field-hint bad'; hint.textContent = 'Enter a city and country first.'; return; }
    hint.className = 'field-hint'; hint.textContent = 'Searching…';
    let g = null; try { g = await geocodeLocation(q); } catch {}
    if (!g) { hint.className = 'field-hint bad'; hint.textContent = 'Couldn’t find that. Try "City, Country".'; return; }
    geo = g; hint.className = 'field-hint ok'; hint.textContent = '✓ ' + g.display;
    const mapEl = document.getElementById('upload-map'); mapEl.style.display = '';
    if (typeof L !== 'undefined') {
      if (!uploadMap) {
        uploadMap = L.map('upload-map', { scrollWheelZoom: false, attributionControl: true }).setView([g.lat, g.lng], 9);
        L.tileLayer(tileUrlP(), { maxZoom: 18, attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(uploadMap);
      } else { uploadMap.setView([g.lat, g.lng], 9); }
      if (uploadMarker) uploadMarker.remove();
      const icon = L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 26] });
      uploadMarker = L.marker([g.lat, g.lng], { icon }).addTo(uploadMap);
      setTimeout(() => uploadMap.invalidateSize(), 200);
    }
    refreshForm();
  });

  document.getElementById('photo-checklist').innerHTML = REQUIRED_SHOTS.map(s => `
    <div class="shot-row" data-key="${s.key}">
      <div class="shot-label"><span class="shot-dot"></span>${s.label}</div>
      <input class="form-input shot-url" id="shot-${s.key}" type="url" placeholder="paste a URL or upload →">
      <label class="shot-file-btn" title="Upload a photo (auto-optimized)">⬆ Upload<input type="file" id="file-${s.key}" accept="image/jpeg,image/png,image/webp" hidden></label>
      <span class="shot-badge" id="badge-${s.key}"></span>
    </div>`).join('');

  // Upload a chosen file → optimized WebP URL fills the slot
  document.getElementById('photo-checklist').addEventListener('change', async e => {
    if (e.target.type !== 'file' || !e.target.files || !e.target.files.length) return;
    const key = e.target.id.replace('file-', '');
    const badge = document.getElementById('badge-' + key);
    const file = e.target.files[0];
    e.target.value = '';
    if (file.size > 8 * 1024 * 1024) { badge.className = 'shot-badge bad'; badge.textContent = '✗ over 8MB'; return; }
    badge.className = 'shot-badge checking'; badge.textContent = 'Uploading…';
    try {
      const { urls } = await API.uploadPhotos([file]);
      document.getElementById('shot-' + key).value = urls[0];
      badge.className = 'shot-badge ok'; badge.textContent = '✓ uploaded';
      refreshForm();
    } catch (err) {
      badge.className = 'shot-badge bad'; badge.textContent = '✗ ' + (err.message || 'upload failed');
    }
  });

  // Inspection report (PDF or image) → its own document upload slot.
  document.getElementById('file-inspection')?.addEventListener('change', async e => {
    const file = e.target.files?.[0]; if (!file) return;
    const badge = document.getElementById('badge-inspection');
    e.target.value = '';
    if (file.size > 8 * 1024 * 1024) { badge.className = 'shot-badge bad'; badge.textContent = '✗ over 8MB'; return; }
    badge.className = 'shot-badge checking'; badge.textContent = 'Uploading…';
    try {
      const { url } = await API.uploadDoc(file);
      document.getElementById('car-inspection').value = url;
      badge.className = 'shot-badge ok'; badge.innerHTML = `✓ uploaded · <a href="${esc(url)}" target="_blank" rel="noopener" style="color:var(--accent)">view</a>`;
      refreshForm();
    } catch (err) {
      badge.className = 'shot-badge bad'; badge.textContent = '✗ ' + (err.message || 'upload failed');
    }
  });

  // Verify a photo actually loads and meets a minimum resolution (quality gate).
  function checkImageQuality(url, badge) {
    if (!url) { badge.className = 'shot-badge'; badge.textContent = ''; return; }
    badge.className = 'shot-badge checking'; badge.textContent = '…';
    const img = new Image();
    img.onload = () => {
      const ok = img.naturalWidth >= 800 && img.naturalHeight >= 600;
      badge.className = 'shot-badge ' + (ok ? 'ok' : 'warn');
      badge.textContent = ok ? `✓ ${img.naturalWidth}×${img.naturalHeight}` : `⚠ low-res ${img.naturalWidth}×${img.naturalHeight}`;
    };
    img.onerror = () => { badge.className = 'shot-badge bad'; badge.textContent = '✗ can’t load'; };
    img.src = url;
  }

  function collectPhotos() {
    const required = REQUIRED_SHOTS.map(s => val('shot-' + s.key)).filter(Boolean);
    const extra = (document.getElementById('car-photos-extra').value || '')
      .split('\n').map(u => u.trim()).filter(Boolean);
    return [...required, ...extra];
  }

  function formState() {
    const year = parseInt(val('car-year'), 10);
    const mileage = val('car-mileage');
    const price = parseFloat(val('car-price'));
    const vin = val('car-vin').toUpperCase();
    const shotsFilled = REQUIRED_SHOTS.every(s => val('shot-' + s.key));
    const checks = [
      ['Make', !!val('car-make')],
      ['Model', !!val('car-model')],
      ['Valid year (1980–2027)', Number.isInteger(year) && year >= 1980 && year <= 2027],
      ['Mileage entered', mileage !== '' && Number(mileage) >= 0],
      ['Valid 17-char VIN', VIN_RE.test(vin)],
      ['Price greater than 0', price > 0],
      ['Location entered', !!val('car-location')],
      [`All ${REQUIRED_SHOTS.length} required photos`, shotsFilled],
    ];
    // New listings must include the full spec sheet; existing listings are grandfathered.
    if (!editingId) {
      checks.push(
        ['Exterior colour', !!val('car-extcolor')],
        ['Interior colour', !!val('car-intcolor')],
        ['Engine', !!val('car-engine')],
        ['Transmission', !!document.getElementById('car-transmission').value],
        ['Drivetrain', !!document.getElementById('car-drivetrain').value],
        ['Fuel economy', !!val('car-mpg')],
        ['Horsepower', val('car-hp') !== '' && Number(val('car-hp')) >= 0],
        ['Seats', val('car-seats') !== '' && Number(val('car-seats')) >= 1],
        ['Accident history', !!document.getElementById('car-accident').value],
        ['Inspection report', !!val('car-inspection')],
      );
      if (document.getElementById('car-bodytype').value === 'Pickup')
        checks.push(['Max towing (pickup)', !!val('car-towing')]);
    }
    return { checks, valid: checks.every(c => c[1]) };
  }

  function updateTowingVisibility() {
    const tg = document.getElementById('towing-group');
    if (tg) tg.style.display = (document.getElementById('car-bodytype').value === 'Pickup') ? '' : 'none';
  }

  function refreshForm() {
    updateTowingVisibility();
    const { checks, valid } = formState();
    document.getElementById('req-summary').innerHTML = checks.map(([label, ok]) =>
      `<span class="req-item ${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${label}</span>`).join('');
    document.getElementById('submit-car-btn').disabled = !valid;
    const vin = val('car-vin').toUpperCase();
    const hint = document.getElementById('vin-hint');
    hint.className = 'field-hint ' + (vin === '' ? '' : (VIN_RE.test(vin) ? 'ok' : 'bad'));
    hint.textContent = vin === '' ? '17 characters · letters I, O, Q are not allowed'
      : (VIN_RE.test(vin) ? '✓ Valid VIN format' : `✗ ${vin.length}/17, check length & characters`);
  }

  let vinTimer;
  async function autoDecodeVin(vin) {
    const hint = document.getElementById('vin-hint');
    hint.className = 'field-hint'; hint.textContent = 'Decoding VIN…';
    try {
      const d = await API.decodeVin(vin);
      if (!d.make) { hint.className = 'field-hint ok'; hint.textContent = '✓ Valid VIN format'; return; }
      const fill = (id, v) => { const el = document.getElementById(id); if (el && !el.value && v) el.value = v; };
      fill('car-make', d.make); fill('car-model', d.model); fill('car-year', d.year);
      if (d.bodyType) { const bt = document.getElementById('car-bodytype'); if (bt && !bt.value) bt.value = d.bodyType; }
      hint.className = 'field-hint ok';
      hint.textContent = '✓ Decoded: ' + [d.make, d.model, d.year].filter(Boolean).join(' ') + (d.bodyType ? ' · ' + d.bodyType : '');
      refreshForm();
    } catch { const h = document.getElementById('vin-hint'); h.className = 'field-hint ok'; h.textContent = '✓ Valid VIN format'; }
  }

  document.getElementById('tab-add-car').addEventListener('input', e => {
    if (e.target.id === 'car-location') geo = { lat: null, lng: null, display: null }; // re-locate after edits
    if (e.target.id === 'car-vin') {
      const vin = val('car-vin').toUpperCase();
      clearTimeout(vinTimer);
      if (VIN_RE.test(vin)) vinTimer = setTimeout(() => autoDecodeVin(vin), 600);
    }
    refreshForm();
    if (e.target.classList.contains('shot-url')) {
      const key = e.target.id.replace('shot-', '');
      clearTimeout(e.target._t);
      e.target._t = setTimeout(() => checkImageQuality(e.target.value.trim(), document.getElementById('badge-' + key)), 500);
    }
  });
  refreshForm();

  /* ── Create vs Edit: one form does both, toggled by editingId ── */
  function resetListingForm() {
    editingId = null;
    ['car-title','car-make','car-model','car-year','car-price','car-mileage','car-vin','car-desc','car-location','car-photos-extra',
     'car-extcolor','car-intcolor','car-engine','car-mpg','car-hp','car-seats','car-towing','car-comfort','car-safety','car-mods']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('car-currency').value  = 'NGN';
    document.getElementById('car-condition').value = 'good';
    document.getElementById('car-bodytype').value  = '';
    document.getElementById('car-transmission').value = '';
    document.getElementById('car-drivetrain').value   = '';
    document.getElementById('car-accident').value     = '';
    document.getElementById('car-inspection').value   = '';
    { const b = document.getElementById('badge-inspection'); if (b) { b.className = 'shot-badge'; b.textContent = ''; } }
    updateTowingVisibility();
    REQUIRED_SHOTS.forEach(s => {
      const el = document.getElementById('shot-' + s.key); if (el) el.value = '';
      const b  = document.getElementById('badge-' + s.key); if (b) { b.className = 'shot-badge'; b.textContent = ''; }
    });
    geo = { lat: null, lng: null, display: null };
    const vh = document.getElementById('vin-hint'); vh.className = 'field-hint'; vh.textContent = '17 characters · letters I, O, Q are not allowed';
    const lh = document.getElementById('loc-hint'); lh.className = 'field-hint'; lh.textContent = "City and country. We'll pin it on the map for buyers.";
    document.getElementById('upload-map').style.display = 'none';
    document.getElementById('add-car-title').textContent  = 'Add New Listing';
    document.getElementById('submit-car-btn').textContent = '📋 Submit Listing';
    document.getElementById('car-form-error').classList.add('hidden');
    showStep(1);
    refreshForm();
  }

  function fillListingForm(car) {
    editingId = car.id;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = (v ?? ''); };
    set('car-title', car.title); set('car-make', car.make);     set('car-model', car.model);
    set('car-year', car.year);   set('car-price', car.price);   set('car-mileage', car.mileage);
    set('car-vin', car.vin);     set('car-desc', car.description); set('car-location', car.location);
    document.getElementById('car-currency').value  = (car.currency === 'USD' ? 'USD' : 'NGN');
    document.getElementById('car-condition').value = (['excellent','good','fair','poor'].includes(car.condition) ? car.condition : 'good');
    document.getElementById('car-bodytype').value  = car.body_type || '';
    set('car-extcolor', car.ext_color); set('car-intcolor', car.int_color);
    set('car-engine', car.engine);      set('car-mpg', car.mpg);
    set('car-hp', car.horsepower);      set('car-seats', car.seats); set('car-towing', car.towing_capacity);
    document.getElementById('car-transmission').value = car.transmission || '';
    document.getElementById('car-drivetrain').value   = car.drivetrain || '';
    document.getElementById('car-accident').value     = car.accident_history || '';
    document.getElementById('car-inspection').value   = car.inspection_report || '';
    { const b = document.getElementById('badge-inspection'); if (b) { if (car.inspection_report) { b.className = 'shot-badge ok'; b.innerHTML = `✓ on file · <a href="${esc(car.inspection_report)}" target="_blank" rel="noopener" style="color:var(--accent)">view</a>`; } else { b.className = 'shot-badge'; b.textContent = ''; } } }
    set('car-comfort', (car.comfort_features || []).join(', '));
    set('car-safety',  (car.safety_features || []).join(', '));
    set('car-mods',    (car.modifications || []).join(', '));
    updateTowingVisibility();
    geo = { lat: car.latitude ?? null, lng: car.longitude ?? null, display: car.location || null };
    // Existing photos: first N fill the required-angle slots, the rest go to "additional".
    const photos = Array.isArray(car.photos) ? car.photos : [];
    REQUIRED_SHOTS.forEach((s, i) => {
      const el = document.getElementById('shot-' + s.key);
      if (el) { el.value = photos[i] || ''; checkImageQuality(el.value, document.getElementById('badge-' + s.key)); }
    });
    document.getElementById('car-photos-extra').value = photos.slice(REQUIRED_SHOTS.length).join('\n');
    const vh = document.getElementById('vin-hint'); vh.className = 'field-hint ok'; vh.textContent = '✓ Valid VIN format';
    document.getElementById('add-car-title').textContent  = 'Edit Listing';
    document.getElementById('submit-car-btn').textContent = '💾 Save Changes';
    document.getElementById('car-form-error').classList.add('hidden');
    showStep(1);
    refreshForm();
  }

  async function editListing(id) {
    try {
      const car = await API.getCar(id);
      fillListingForm(car);
      switchTab('add-car');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast(e.message || 'Could not load that listing', 'error'); }
  }

  function newListing() { resetListingForm(); switchTab('add-car'); }

  /* ── Listing wizard (stepped form) ── */
  let wizStep = 1;
  function showStep(n) {
    wizStep = Math.max(1, Math.min(4, n));
    document.querySelectorAll('#tab-add-car .wizard-step').forEach(s => s.classList.toggle('active', Number(s.dataset.step) === wizStep));
    document.querySelectorAll('#tab-add-car .wstep').forEach(b => {
      const k = Number(b.dataset.go);
      b.classList.toggle('active', k === wizStep);
      b.classList.toggle('done', k < wizStep);
    });
    const back = document.getElementById('wiz-back'), next = document.getElementById('wiz-next'), sub = document.getElementById('submit-car-btn');
    if (back) back.style.display = wizStep > 1 ? '' : 'none';
    if (next) next.style.display = wizStep < 4 ? '' : 'none';
    if (sub)  sub.style.display  = wizStep === 4 ? '' : 'none';
  }
  document.getElementById('wiz-next')?.addEventListener('click', () => showStep(wizStep + 1));
  document.getElementById('wiz-back')?.addEventListener('click', () => showStep(wizStep - 1));
  document.querySelectorAll('#tab-add-car .wstep').forEach(b => b.addEventListener('click', () => showStep(Number(b.dataset.go))));
  showStep(1);

  document.getElementById('submit-car-btn').addEventListener('click', async () => {
    const errEl = document.getElementById('car-form-error');
    errEl.classList.add('hidden');
    if (!formState().valid) {
      errEl.textContent = 'Please complete all required fields and the required photos.';
      errEl.classList.remove('hidden'); return;
    }
    const data = {
      title:       val('car-title') || undefined,
      make:        val('car-make'),
      model:       val('car-model'),
      year:        parseInt(val('car-year'), 10),
      price:       parseFloat(val('car-price')),
      currency:    document.getElementById('car-currency').value,
      mileage:     parseInt(val('car-mileage'), 10),
      vin:         val('car-vin').toUpperCase(),
      condition:   document.getElementById('car-condition').value,
      bodyType:    document.getElementById('car-bodytype').value || undefined,
      description: val('car-desc') || undefined,
      extColor:    val('car-extcolor') || undefined,
      intColor:    val('car-intcolor') || undefined,
      engine:      val('car-engine') || undefined,
      transmission: document.getElementById('car-transmission').value || undefined,
      drivetrain:  document.getElementById('car-drivetrain').value || undefined,
      accidentHistory: document.getElementById('car-accident').value || undefined,
      inspectionReport: val('car-inspection') || undefined,
      mpg:         val('car-mpg') || undefined,
      horsepower:  val('car-hp') || undefined,
      seats:       val('car-seats') || undefined,
      towingCapacity: val('car-towing') || undefined,
      comfortFeatures: csv('car-comfort'),
      safetyFeatures:  csv('car-safety'),
      modifications:   csv('car-mods'),
      location:    val('car-location'),
      latitude:    geo.lat,
      longitude:   geo.lng,
      photos:      collectPhotos(),
    };
    const btn = document.getElementById('submit-car-btn');
    btn.disabled = true;
    btn.textContent = editingId ? 'Saving…' : 'Submitting…';
    try {
      if (editingId) {
        await API.updateCar(editingId, data);
        toast('Listing updated ✓', 'success');
      } else {
        await API.createCar(data);
        toast('Listing created! 🚗', 'success');
      }
      resetListingForm();            // clears the form + restores create-mode labels
      switchTab('listings'); loadMyListings();
    } catch(e) {
      errEl.textContent = e.message; errEl.classList.remove('hidden');
      btn.textContent = editingId ? '💾 Save Changes' : '📋 Submit Listing';
      refreshForm();
    }
  });

  init();

/* ── Delegated actions (CSP: no inline handlers) ─────────────
   Dynamic rows carry data-act/data-chg + data-* args; the shared dispatcher in
   app.js routes clicks here. Handlers get (dataset, element). */
Object.assign(window.ACTIONS, {
  'new-listing':         () => newListing(),
  'switch-tab':          d => switchTab(d.tab),
  'edit-listing':        d => editListing(d.id),
  'delete-car':          d => deleteCar(d.id),
  'remove-saved-search': d => removeSavedSearch(d.id),
  'pay-escrow':          (d, el) => payEscrow(d.id, el),
  'release-tx':          (d, el) => releaseTx(d.id, el),
  'review-tx':           d => openReviewModal(d.id),
  'refund-tx':           (d, el) => refundTx(d.id, el),
  'remove-tx':           (d, el) => removeTx(d.id, el),
  'mark-paid':           (d, el) => markPaid(d.id, el),
  'admin-verify':        d => adminVerify(d.id),
  'admin-delete-user':   d => adminDeleteUser(d.id, d.name),
  'admin-feature':       (d, el) => adminFeature(d.id, Number(d.featured), el),
  'admin-delete-car':    d => adminDeleteCar(d.id),
  'remove-contact':      d => removeContact(d.id),
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-chg="update-tx"]');
  if (el) updateTx(el.dataset.id, el.value);
});
