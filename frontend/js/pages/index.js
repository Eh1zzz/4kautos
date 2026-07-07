  // Hero search tab switch
  document.querySelectorAll('.search-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.search-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.type === 'sell') {
        openAuth('signup', { role: 'seller' });
        document.querySelectorAll('.search-tab')[0].classList.add('active');
        btn.classList.remove('active');
      }
    });
  });

  // Cascading model list — repopulate the Model suggestions from the chosen Make.
  // Free-typed custom makes (the "Other" path) just yield no suggestions.
  const sfMake = document.getElementById('sf-make');
  const sfModelList = document.getElementById('sf-models-list');
  const refreshModels = () => window.fillModelList?.(sfMake.value, sfModelList);
  sfMake.addEventListener('input', refreshModels);
  sfMake.addEventListener('change', refreshModels);
  refreshModels();

  // Hero search
  document.getElementById('hero-search-btn').addEventListener('click', () => {
    const make  = document.getElementById('sf-make').value;
    const model = document.getElementById('sf-model').value;
    const price = document.getElementById('sf-price').value;
    const p = new URLSearchParams();
    if (make)  p.set('make', make);
    if (model) p.set('model', model);
    if (price) p.set('maxPrice', price);
    location.href = 'listings.html?' + p.toString();
  });

  // Nav quick search
  document.getElementById('nav-q').addEventListener('keydown', e => {
    if (e.key === 'Enter') location.href = `listings.html?q=${encodeURIComponent(e.target.value)}`;
  });

  // Load featured listings (carCard + card interactions are shared in app.js)
  async function loadFeatured() {
    const grid = document.getElementById('featured-grid');
    document.getElementById('featured-spinner').classList.add('hidden');
    grid.classList.remove('hidden');
    grid.innerHTML = window.skeletonCards ? window.skeletonCards(8) : '';   // shimmer while loading
    try {
      const cars = await API.getCars({ limit: 8 });
      document.getElementById('stat-cars').textContent = cars.length >= 8 ? '500+' : cars.length;

      if (!cars.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 17H3v-4l2-5h14l2 5v4h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>
          <h3>No Listings Yet</h3><p>Be the first to list a car!</p>
        </div>`;
        return;
      }

      grid.innerHTML = cars.slice(0,8).map(c => carCard(c)).join('');
      initHeroSlideshow(cars);
    } catch {
      grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1">Could not load listings. Start the backend server.</p>';
    }
  }

  // 🔥 Hot Sales — admin-featured cars; the section stays hidden when there are none.
  async function loadHotSales() {
    try {
      const cars = await API.getCars({ featured: 1, limit: 8 });
      if (!cars.length) return;
      document.getElementById('hotsales-grid').innerHTML = cars.map(c => carCard(c)).join('');
      document.getElementById('hotsales-section').hidden = false;
      window.observeReveals?.();
      Money.repriceAll?.();
    } catch { /* non-critical */ }
  }

  // 🏁 Featured spotlight — one standout car shown large above the grids.
  // Prefers an admin-featured car, falls back to the latest listing.
  function spotlightCard(c) {
    const native = c.currency || 'NGN';
    const img = c.photos?.[0] || `https://placehold.co/1200x800/12121f/8b7cff?text=${encodeURIComponent(c.make || 'Car')}`;
    const srcset = window.imgSrcset?.(img);
    const title = c.title || `${c.year || ''} ${c.make || ''} ${c.model || ''}`.trim();
    const specs = [
      c.mileage ? `${Number(c.mileage).toLocaleString()} km` : '',
      c.transmission, c.body_type, c.year,
    ].filter(Boolean);
    const priceHtml = (c.price != null && c.price !== '')
      ? `<div class="spotlight-price js-price" data-amount="${esc(c.price)}" data-native="${esc(native)}">${Money.fmt(c.price, native)}</div>`
      : `<div class="spotlight-price">Price on request</div>`;
    return `
      <a class="spotlight-card reveal" href="detail.html?id=${esc(c.id)}">
        <div class="spotlight-media">
          <img src="${esc(img)}"${srcset ? ` srcset="${esc(srcset)}" sizes="(max-width:900px) 100vw, 58vw"` : ''} alt="${esc(title)}" loading="lazy" data-fallback="https://placehold.co/1200x800/12121f/8b7cff?text=No+Photo">
          <span class="spotlight-tag">★ Featured</span>
        </div>
        <div class="spotlight-info">
          <div class="spotlight-eyebrow">Spotlight of the week</div>
          <h3 class="spotlight-title">${esc(title)}</h3>
          ${c.seller?.verified ? `<div class="spotlight-verified">✓ Verified seller</div>` : ''}
          ${c.location ? `<div class="spotlight-loc">📍 ${esc(c.location)}</div>` : ''}
          <div class="spotlight-specs">${specs.map(s => `<span>${esc(s)}</span>`).join('')}</div>
          ${priceHtml}
          <span class="spotlight-cta">View Details →</span>
        </div>
      </a>`;
  }
  async function loadSpotlight() {
    const el = document.getElementById('spotlight');
    if (!el) return;
    try {
      let cars = await API.getCars({ featured: 1, limit: 1 });
      if (!cars.length) cars = await API.getCars({ limit: 1 }); // newest as fallback
      if (!cars.length) return;
      el.innerHTML = spotlightCard(cars[0]);
      document.getElementById('spotlight-section').hidden = false;
      window.observeReveals?.();
      Money.repriceAll?.();
    } catch { /* non-critical */ }
  }

  // Hot ticker — latest listings + value props as a scrolling marquee.
  async function loadTicker() {
    const track = document.getElementById('ticker-track');
    if (!track) return;
    let items = [];
    try {
      const cars = await API.getCars({ limit: 6 });
      items = cars.map(c => {
        const sym = (c.currency === 'USD') ? '$' : '₦';
        const price = (c.price != null && c.price !== '') ? `${sym}${Number(c.price).toLocaleString('en-US')}` : 'Enquire';
        const km = c.mileage ? ` · ${Number(c.mileage).toLocaleString()} km` : '';
        return `${c.year || ''} ${c.make || ''} ${c.model || ''} · ${price}${km}`.replace(/\s+/g, ' ').trim();
      });
    } catch { /* offline — fall back to promos only */ }
    const promos = ['Escrow-protected payments', 'Customs clearance handled', 'Free inspection reports', '150-point checks on every car'];
    const all = [...items, ...promos];
    if (!all.length) return;
    const row = all.map(t => `<span class="ticker-item">${esc(t)}</span>`).join('');
    track.innerHTML = row + row;   // duplicate for a seamless loop
  }

  // Category quick-nav — body-type launcher with the Figma red top-indicator bar.
  function renderCatNav() {
    const host = document.getElementById('cat-nav-inner');
    if (!host || !window.bodyIcon) return;
    const cats = ['SUV', 'Sedan', 'Hatchback', 'Coupe', 'Pickup', 'Convertible', 'Van'];
    host.innerHTML = cats.map(c =>
      `<a class="cat-link" href="listings.html?type=${encodeURIComponent(c)}">${window.bodyIcon(c)}<span data-i18n="cat.${c}">${window.t ? window.t('cat.' + c, c) : c}</span></a>`
    ).join('');
  }

  // Rotating hero showcase — live inventory photos behind the headline, with
  // progress dots + a featured-car caption (Figma rotating-hero treatment).
  function initHeroSlideshow(cars){
    const host = document.getElementById('hero-slideshow');
    const dotsHost = document.getElementById('hero-dots');
    const cap = document.getElementById('hero-caption');
    if (!host) return;
    const feat = (cars || []).filter(c => c.photos && c.photos[0]).slice(0, 6);
    if (!feat.length) return;
    host.innerHTML = feat.map((c, i) =>
      `<div class="hero-slide${i === 0 ? ' on' : ''}" style="background-image:url('${String(c.photos[0]).replace(/'/g, '%27')}')"></div>`).join('');
    const slides = host.querySelectorAll('.hero-slide');
    if (dotsHost) dotsHost.innerHTML = feat.map((c, i) =>
      `<button class="hero-dot${i === 0 ? ' on' : ''}" type="button" role="tab" aria-label="${esc((c.title || `${c.make || ''} ${c.model || ''}`).trim())}" data-i="${i}"></button>`).join('');
    const dots = dotsHost ? [...dotsHost.querySelectorAll('.hero-dot')] : [];
    let i = 0, timer = null;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const show = n => {
      slides[i]?.classList.remove('on'); dots[i]?.classList.remove('on');
      i = (n + feat.length) % feat.length;
      slides[i]?.classList.add('on'); dots[i]?.classList.add('on');
      const c = feat[i];
      if (cap) {
        const name = (c.title || `${c.year || ''} ${c.make || ''} ${c.model || ''}`).replace(/\s+/g, ' ').trim();
        cap.innerHTML = `<span class="hero-cap-name">${esc(name)}</span><span class="hero-cap-go">View →</span>`;
        cap.href = 'detail.html?id=' + encodeURIComponent(c.id);
        cap.hidden = false;
      }
    };
    const restart = () => { if (timer) clearInterval(timer); if (!reduce && feat.length > 1) timer = setInterval(() => show(i + 1), 6000); };
    show(0); restart();
    dots.forEach(d => d.addEventListener('click', () => { show(+d.dataset.i); restart(); }));
  }

  // Browse By: type / budget / mileage → deep links into listings filters
  const carIco = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3v-4l2-5h14l2 5v4h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M5 13h14"/></svg>`;
  const BROWSE = {
    type: ['SUV','Sedan','Hatchback','Coupe','Pickup','Convertible','Wagon','Van'].map(t => ({ label: t, q: 'type=' + encodeURIComponent(t) })),
    budget: [
      { label: 'Under $5k',   q: 'maxUsd=5000' },
      { label: '$5k – $10k',  q: 'minUsd=5000&maxUsd=10000' },
      { label: '$10k – $20k', q: 'minUsd=10000&maxUsd=20000' },
      { label: '$20k – $40k', q: 'minUsd=20000&maxUsd=40000' },
      { label: '$40k & up',   q: 'minUsd=40000' },
    ],
    mileage: [
      { label: 'Under 30,000 km',  q: 'maxMileage=30000' },
      { label: '30k – 60k km',     q: 'minMileage=30000&maxMileage=60000' },
      { label: '60k – 100k km',    q: 'minMileage=60000&maxMileage=100000' },
      { label: 'Over 100,000 km',  q: 'minMileage=100000' },
    ],
  };
  function renderBrowse(kind){
    document.getElementById('browse-grid').innerHTML = BROWSE[kind].map(b => {
      const ico = (kind === 'type' && window.bodyIcon) ? window.bodyIcon(b.label) : carIco;
      return `<a class="browse-tile" href="listings.html?${b.q}"><span class="browse-ico">${ico}</span><span class="browse-label">${b.label}</span></a>`;
    }).join('');
  }
  document.querySelectorAll('.browse-tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.browse-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active'); renderBrowse(t.dataset.browse);
  }));
  renderBrowse('type');

  renderBrandStrip('#brand-strip');
  loadFeatured();
  loadSpotlight();
  loadHotSales();
  loadTicker();
  renderCatNav();
