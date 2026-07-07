  // Read URL params
  const urlP = new URLSearchParams(location.search);
  if (urlP.get('make'))  document.getElementById('f-make').value = urlP.get('make');
  if (urlP.get('model')) document.getElementById('f-model').value = urlP.get('model');
  if (urlP.get('maxPrice')) document.getElementById('f-price-max').value = urlP.get('maxPrice');
  if (urlP.get('q'))    document.getElementById('f-model').value = urlP.get('q');

  const PAGE_SIZE = 12;
  let currentPage = 1, totalPages = 1;

  // Filters/sort/budget are all applied server-side now.
  function buildParams() {
    const p = {};
    const make = document.getElementById('f-make').value;
    const model = document.getElementById('f-model').value;
    const priceMin = document.getElementById('f-price-min').value;
    const priceMax = document.getElementById('f-price-max').value;
    const conditions = [...document.querySelectorAll('.filter-check input:checked')].map(c => c.value);
    if (make) p.make = make;
    if (model) p.model = model;
    if (priceMin) p.minPrice = priceMin;
    if (priceMax) p.maxPrice = priceMax;
    if (conditions.length) p.condition = conditions.join(',');
    ['q', 'type', 'minMileage', 'maxMileage', 'minUsd', 'maxUsd'].forEach(k => { if (urlP.get(k)) p[k] = urlP.get(k); });
    p.sort = document.getElementById('sort-select').value;
    return p;
  }

  async function loadListings(page = 1) {
    currentPage = page;
    const spinner = document.getElementById('listings-spinner');
    const grid = document.getElementById('listings-grid');
    const empty = document.getElementById('listings-empty');
    const pag = document.getElementById('pagination');
    spinner.classList.add('hidden'); empty.classList.add('hidden'); pag.classList.add('hidden');
    grid.classList.remove('hidden');
    grid.innerHTML = window.skeletonCards ? window.skeletonCards(8) : '';   // shimmer while loading
    document.getElementById('recs-wrap')?.remove();

    try {
      const { cars, total, pages } = await API.getCarsPage({ ...buildParams(), page, limit: PAGE_SIZE });
      totalPages = pages;
      const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
      const to = (page - 1) * PAGE_SIZE + cars.length;
      document.getElementById('results-count').textContent = total ? `${from}–${to} of ${total}` : '0';
      if (!cars.length) { grid.classList.add('hidden'); empty.classList.remove('hidden'); renderRecommendations(); return; }
      grid.innerHTML = cars.map(c => carCard(c)).join('');   // carCard + clicks/saves are shared (app.js)
      renderPagination();
    } catch (e) {
      grid.innerHTML = `<p class="empty-state" style="grid-column:1/-1">Backend offline. Start the server with <code>npm start</code></p>`;
    }
  }

  // When a search returns nothing, suggest cars — matched to the buyer's saved
  // searches if they have any, otherwise the latest listings.
  async function renderRecommendations() {
    const empty = document.getElementById('listings-empty');
    try {
      let recs = [], heading = window.t('listings.recs', 'You might like these');
      if (API.isLoggedIn()) {
        const saved = await API.getSavedSearches().catch(() => []);
        for (const s of saved) {
          const got = await API.getCars({ ...(s.filters || {}), limit: 4 }).catch(() => []);
          if (got.length) { recs = got; heading = `From your saved search · ${esc(s.label)}`; break; }
        }
      }
      if (!recs.length) recs = await API.getCars({ limit: 4 }).catch(() => []);
      recs = recs.slice(0, 4);
      if (!recs.length) return;
      const wrap = document.createElement('div');
      wrap.id = 'recs-wrap';
      wrap.innerHTML = `<h3 class="recs-title">${heading}</h3><div class="cars-grid">${recs.map(c => carCard(c)).join('')}</div>`;
      empty.insertAdjacentElement('afterend', wrap);
      window.observeReveals?.();
      Money.repriceAll?.();
    } catch { /* non-critical */ }
  }

  function renderPagination() {
    const pag = document.getElementById('pagination');
    if (totalPages <= 1) { pag.classList.add('hidden'); return; }
    const btn = (label, page, o = {}) =>
      `<button class="pg-btn ${o.active ? 'active' : ''}" ${o.disabled ? 'disabled' : ''} data-page="${page}">${label}</button>`;
    let html = btn('‹', currentPage - 1, { disabled: currentPage === 1 });
    const start = Math.max(1, currentPage - 2), end = Math.min(totalPages, currentPage + 2);
    if (start > 1) { html += btn('1', 1); if (start > 2) html += '<span class="pg-ellipsis">…</span>'; }
    for (let i = start; i <= end; i++) html += btn(i, i, { active: i === currentPage });
    if (end < totalPages) { if (end < totalPages - 1) html += '<span class="pg-ellipsis">…</span>'; html += btn(totalPages, totalPages); }
    html += btn('›', currentPage + 1, { disabled: currentPage === totalPages });
    pag.innerHTML = html;
    pag.classList.remove('hidden');
    pag.querySelectorAll('.pg-btn[data-page]').forEach(b => b.addEventListener('click', () => {
      const p = +b.dataset.page;
      if (p >= 1 && p <= totalPages && p !== currentPage) {
        loadListings(p);
        window.scrollTo({ top: document.querySelector('.listings-main').offsetTop - 80, behavior: 'smooth' });
      }
    }));
  }

  document.getElementById('f-apply').addEventListener('click', () => loadListings(1));
  document.getElementById('f-reset').addEventListener('click', () => { location.href = 'listings.html'; });
  document.getElementById('sort-select').addEventListener('change', () => loadListings(1));

  /* ── Save this search (server-side) ── */
  function searchLabel(f) {
    const parts = [];
    if (f.make) parts.push(f.make);
    if (f.model) parts.push(f.model);
    if (f.type) parts.push(f.type);
    if (f.condition) parts.push(f.condition);
    if (f.q) parts.push(`"${f.q}"`);
    if (f.minUsd || f.maxUsd) parts.push(`$${f.minUsd || '0'}–${f.maxUsd || '∞'}`);
    else if (f.minPrice || f.maxPrice) parts.push(`₦${f.minPrice || '0'}–${f.maxPrice || '∞'}`);
    if (f.minMileage || f.maxMileage) parts.push(`${f.minMileage || '0'}–${f.maxMileage || '∞'} km`);
    return parts.join(' · ') || 'All listings';
  }
  async function saveCurrentSearch() {
    if (!API.isLoggedIn()) { toast('Sign in to save searches', 'info'); if (window.openAuth) openAuth('login'); return; }
    const f = buildParams(); delete f.sort;
    try { await API.saveSearch(searchLabel(f), f); toast('Search saved. Find it in your dashboard', 'success'); }
    catch (e) { toast(e.message || 'Could not save search', 'error'); }
  }
  (function () {
    const sort = document.getElementById('sort-select');
    if (!sort) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'save-search-btn'; btn.className = 'nav-btn nav-btn-ghost';
    btn.style.cssText = 'padding:6px 12px;font-size:.8rem;margin-right:.5rem';
    btn.textContent = window.t('listings.save', '🔖 Save search');
    btn.addEventListener('click', saveCurrentSearch);
    sort.insertAdjacentElement('beforebegin', btn);
  })();

  /* Mobile: collapse the filter panel behind a toggle so cars show first. */
  (function () {
    const layout = document.querySelector('.listings-layout');
    const sidebar = document.querySelector('.filter-sidebar');
    if (!layout || !sidebar) return;
    const btn = document.createElement('button');
    btn.className = 'filters-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = window.t('listings.filtersBtn', '🔍 Filters');
    layout.prepend(btn);
    const setOpen = (open) => {
      sidebar.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? window.t('listings.hideFilters', '✕ Hide filters') : window.t('listings.filtersBtn', '🔍 Filters');
    };
    btn.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
    // Collapse again after applying so the results are immediately visible.
    document.getElementById('f-apply').addEventListener('click', () => setOpen(false));
  })();
  document.getElementById('nav-q').addEventListener('keydown', e => {
    if (e.key === 'Enter') { urlP.set('q', e.target.value); location.href = `listings.html?${urlP}`; }
  });

  /* ── Map view: every matching car as a pin ── */
  let mapInstance = null, carLayer = null;
  const tileUrl = () => document.documentElement.getAttribute('data-theme') !== 'light'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  async function showMap() {
    setView('map');
    document.getElementById('listings-grid').classList.add('hidden');
    document.getElementById('pagination').classList.add('hidden');
    document.getElementById('listings-empty').classList.add('hidden');
    const mapEl = document.getElementById('listings-map');
    mapEl.classList.remove('hidden');
    if (typeof L === 'undefined') { mapEl.innerHTML = '<p class="empty-state">Map unavailable.</p>'; return; }

    let cars = [];
    try { cars = (await API.getCarsPage({ ...buildParams(), page: 1, limit: 100 })).cars; } catch { return; }
    const located = cars.filter(c => c.latitude != null && c.longitude != null);
    document.getElementById('results-count').textContent =
      `${located.length} on map` + (cars.length > located.length ? ` (${cars.length - located.length} without a location)` : '');

    if (!mapInstance) {
      mapInstance = L.map('listings-map', { scrollWheelZoom: true, attributionControl: true });
      L.tileLayer(tileUrl(), { maxZoom: 18, attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(mapInstance);
    }
    if (carLayer) mapInstance.removeLayer(carLayer);
    carLayer = L.featureGroup();
    located.forEach(c => {
      const icon = L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 26] });
      const title = c.title || `${c.year || ''} ${c.make || ''} ${c.model || ''}`.trim();
      const img = (c.photos && c.photos[0]) || 'https://placehold.co/160x90/12121f/8b7cff?text=Car';
      const price = c.price != null ? Money.fmt(c.price, c.currency || 'NGN') : 'Price on request';
      L.marker([c.latitude, c.longitude], { icon }).bindPopup(
        `<div class="map-pop"><img src="${esc(img)}" alt=""><div class="map-pop-t">${esc(title)}</div>` +
        `<div class="map-pop-p">${price}</div><a href="detail.html?id=${esc(c.id)}">View →</a></div>`
      ).addTo(carLayer);
    });
    carLayer.addTo(mapInstance);
    if (located.length) mapInstance.fitBounds(carLayer.getBounds().pad(0.25));
    else mapInstance.setView([9, 8], 3);
    setTimeout(() => mapInstance.invalidateSize(), 200);
  }
  function showGrid() {
    setView('grid');
    document.getElementById('listings-map').classList.add('hidden');
    loadListings(currentPage);
  }
  function setView(v) { document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v)); }
  document.getElementById('view-grid').addEventListener('click', showGrid);
  document.getElementById('view-map').addEventListener('click', showMap);

  renderBrandStrip('#brand-strip');
  loadListings(1);
