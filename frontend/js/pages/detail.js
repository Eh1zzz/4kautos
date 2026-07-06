  const id = new URLSearchParams(location.search).get('id');
  let photos = [], currentPhoto = 0, car = null;

  function setPhoto(i) {
    if (!photos.length) return;
    currentPhoto = (i + photos.length) % photos.length;
    const main = document.getElementById('gallery-main-img');
    const url = photos[currentPhoto];
    main.src = url;
    const ss = window.imgSrcset?.(url);
    if (ss) { main.srcset = ss; main.sizes = '(max-width:900px) 100vw, 760px'; }
    else { main.removeAttribute('srcset'); main.removeAttribute('sizes'); }
    document.querySelectorAll('.gallery-thumb').forEach((t,j) => t.classList.toggle('active', j === currentPhoto));
  }

  document.getElementById('gal-prev').addEventListener('click', () => setPhoto(currentPhoto - 1));
  document.getElementById('gal-next').addEventListener('click', () => setPhoto(currentPhoto + 1));

  async function load() {
    if (!id) { location.href = 'listings.html'; return; }
    try {
      car = await API.getCar(id);
      document.title = `${car.title || car.make + ' ' + car.model} — 4Kautos`;
      document.getElementById('bc-title').textContent = car.title || `${car.year} ${car.make} ${car.model}`;
      document.getElementById('d-title').textContent  = car.title || `${car.year} ${car.make} ${car.model}`;
      const priceEl = document.getElementById('d-price');
      if (car.price != null) {
        priceEl.classList.add('js-price');
        priceEl.dataset.amount = car.price;
        priceEl.dataset.native = car.currency || 'NGN';
        priceEl.innerHTML = Money.fmt(car.price, car.currency || 'NGN');
      } else { priceEl.textContent = 'Price on Request'; }
      // Prefill the clearance estimator with this car's value.
      document.getElementById('clearance-btn').href =
        `clearance.html?cif=${encodeURIComponent(car.price || '')}&cur=${encodeURIComponent(car.currency || 'NGN')}`;
      document.getElementById('d-condition').textContent = car.condition || 'N/A';
      document.getElementById('d-year').textContent   = car.year || '';
      document.getElementById('car-desc').textContent = car.description || 'No description provided.';

      // Seller
      const seller = car.seller;
      const initials = seller?.name ? seller.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) : '?';
      document.getElementById('seller-ava').textContent  = initials;
      document.getElementById('seller-name').textContent = seller?.name || 'Unknown Seller';
      if (!seller?.verified) document.getElementById('seller-badge').innerHTML = '<span style="color:var(--text3)">Unverified</span>';

      // If the logged-in user owns this listing, the buyer-facing actions
      // (Buy, Save, Message, Ask AutoBot, comparable listings, escrow note) are
      // pointless — hide them and offer owner actions (Edit, Share) instead.
      const me = API.getUser();
      const isOwner = !!(me && seller && me.id === seller.id);
      if (isOwner) {
        ['buy-btn', 'save-btn', 'message-btn', 'chat-enquire-btn'].forEach(id =>
          document.getElementById(id)?.style.setProperty('display', 'none'));
        document.querySelector('.safety-note')?.style.setProperty('display', 'none');
        const actions = document.createElement('div');
        actions.className = 'owner-actions';
        actions.innerHTML =
          `<a class="cta-btn cta-btn-primary" href="profile.html?edit=${encodeURIComponent(car.id)}">✎ Edit listing</a>` +
          `<button class="cta-btn cta-btn-secondary" type="button" id="share-btn">${window.t('detail.share', '🔗 Share listing')}</button>`;
        document.getElementById('buy-btn').insertAdjacentElement('beforebegin', actions);
        document.getElementById('share-btn').addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(location.href); toast('Listing link copied', 'success'); }
          catch { toast('Copy this link: ' + location.href, 'info'); }
        });
      }

      // Gallery
      photos = car.photos?.length ? car.photos : [`https://placehold.co/800x500/12121f/8b7cff?text=${encodeURIComponent(car.make||'Car')}`];
      setPhoto(0);
      const thumbsEl = document.getElementById('gallery-thumbs');
      if (photos.length > 1) {
        thumbsEl.innerHTML = photos.map((p,i) =>
          `<div class="gallery-thumb ${i===0?'active':''}" data-i="${i}"><img src="${esc(p)}" ${window.imgSrcset?.(p) ? `srcset="${esc(window.imgSrcset(p))}" sizes="90px"` : ''} alt="Photo ${i+1}" loading="lazy"></div>`
        ).join('');
        thumbsEl.querySelectorAll('.gallery-thumb').forEach(t =>
          t.addEventListener('click', () => setPhoto(+t.dataset.i))
        );
      }

      // Specs table (values escaped — they come from seller-supplied data)
      const specs = [
        ['Make',         car.make],
        ['Model',        car.model],
        ['Year',         car.year],
        ['Body type',    car.body_type],
        ['Mileage',      car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null],
        ['Condition',    car.condition],
        ['Engine',       car.engine],
        ['Transmission', car.transmission],
        ['Drivetrain',   car.drivetrain],
        ['Horsepower',   car.horsepower ? `${car.horsepower} hp` : null],
        ['Fuel economy', car.mpg],
        ['Seats',        car.seats],
        ['Exterior',     car.ext_color],
        ['Interior',     car.int_color],
        ['Towing',       car.towing_capacity],
        ['VIN',          car.vin],
        ['Location',     car.location],
        ['Listed',       car.createdAt ? new Date(car.createdAt).toLocaleDateString() : null],
      ].filter(([,v]) => v);

      const SPEC_KEYS = { 'Make':'spec.make','Model':'spec.model','Year':'spec.year','Body type':'spec.bodyType','Mileage':'spec.mileage','Condition':'spec.condition','Engine':'spec.engine','Transmission':'spec.transmission','Drivetrain':'spec.drivetrain','Horsepower':'spec.horsepower','Fuel economy':'spec.fuel','Seats':'spec.seats','Exterior':'spec.exterior','Interior':'spec.interior','Towing':'spec.towing','VIN':'spec.vin','Location':'spec.location','Listed':'spec.listed' };
      document.getElementById('specs-dl').innerHTML = specs.map(([k,v]) =>
        `<div class="spec-row"><dt${SPEC_KEYS[k] ? ` data-i18n="${SPEC_KEYS[k]}"` : ''}>${esc(window.t(SPEC_KEYS[k] || '', k))}</dt><dd>${esc(v)}</dd></div>`
      ).join('');

      // Optional extras (comfort / safety / modifications) as chip groups
      const extras = [
        ['Comfort & convenience', car.comfort_features],
        ['Safety', car.safety_features],
        ['Modifications', car.modifications],
      ].filter(([, items]) => Array.isArray(items) && items.length);
      document.querySelector('.extras-wrap')?.remove();
      if (extras.length) {
        const html = extras.map(([label, items]) =>
          `<div class="extras-group"><h5>${esc(label)}</h5><div class="extras-chips">${items.map(i => `<span class="extra-chip">${esc(i)}</span>`).join('')}</div></div>`
        ).join('');
        document.getElementById('specs-dl').insertAdjacentHTML('afterend', `<div class="extras-wrap">${html}</div>`);
      }

      // Save button state
      const saveBtn = document.getElementById('save-btn');
      const renderSave = () => {
        const on = API.isSaved(car.id);
        saveBtn.classList.toggle('saved', on);
        saveBtn.textContent = on ? window.t('detail.saved', '♥ Saved') : window.t('detail.save', '♡ Save this car');
      };
      renderSave();
      saveBtn.addEventListener('click', () => { API.toggleSaved(car.id); renderSave(); });

      document.getElementById('detail-spinner').classList.add('hidden');
      document.getElementById('detail-content').classList.remove('hidden');

      // Give AutoBot this listing so it answers about THIS exact car.
      if (window.AutoBot) window.AutoBot.setCar(car);

      renderLanded(car);
      loadCustoms(car);
      initMap(car);
      if (!isOwner) loadSimilar(car.id);   // owners don't need the comparables strip
      loadValuation(car.id);
    } catch(e) {
      document.getElementById('detail-spinner').innerHTML = `<div class="spinner-wrap"><div class="empty-state"><h3>${window.t('detail.notFound', 'Car Not Found')}</h3><p><a href="listings.html" style="color:var(--accent)">Browse all listings</a></p></div></div>`;
    }
  }

  // Comparable inventory strip — same query AutoBot uses for price comparison.
  async function loadSimilar(id) {
    try {
      const cars = await API.getSimilar(id, 4);
      if (!cars || !cars.length) return;
      const grid = document.getElementById('similar-grid');
      grid.innerHTML = cars.map(c => window.carCard(c)).join('');
      document.getElementById('similar-section').hidden = false;
      window.observeReveals?.();   // animate the injected cards in
      Money.repriceAll?.();        // show prices in the active currency
    } catch (e) { /* non-critical — leave the section hidden */ }
  }

  // "Good price" verdict vs comparable listings — shown under the price.
  async function loadValuation(id) {
    try {
      const v = await API.getValuation(id);
      if (!v || !v.verdict) return;
      const LBL = { great: 'Great price', good: 'Good price', fair: 'Fair price', high: 'Above market' };
      const chip = document.createElement('span');
      chip.className = 'price-eval eval-' + v.verdict;
      chip.title = `vs. ${v.sampleSize} similar listings`;
      chip.textContent = LBL[v.verdict] || '';
      document.getElementById('d-price').insertAdjacentElement('afterend', chip);
    } catch { /* non-critical */ }
  }

  // Buy button
  document.getElementById('buy-btn').addEventListener('click', async () => {
    if (!API.isLoggedIn()) { openAuth('login'); return; }
    const user = API.getUser();
    if (user.role !== 'buyer') { toast('Only buyers can initiate purchases', 'error'); return; }
    try {
      await API.initTx(car.id, car.seller?.id);
      toast('Purchase initiated! Check your profile for status.', 'success');
    } catch(e) {
      toast(e.message, 'error');
    }
  });

  // Message the seller
  document.getElementById('message-btn').addEventListener('click', () => {
    if (!API.isLoggedIn()) { openAuth('login'); return; }
    if (!car) return;
    const me = API.getUser();
    if (me && car.seller && me.id === car.seller.id) { toast('This is your own listing', 'info'); return; }
    openChatThread({
      carId: car.id,
      title: 'Chat with ' + (car.seller?.name || 'the seller'),
      sub: car.title || `${car.year||''} ${car.make||''} ${car.model||''}`.trim(),
    });
  });

  // Ask AutoBot about this car — open the assistant and ask in one click.
  // AutoBot already has the listing context (set in load()), so it replies with
  // this car's real details plus general facts about the model.
  document.getElementById('chat-enquire-btn').addEventListener('click', () => {
    if (window.AutoBot) {
      if (car) window.AutoBot.setCar(car);
      window.AutoBot.ask('Tell me about this car');
    }
  });

  /* ── Landed cost + location map ── */
  function renderLanded(car){
    const box = document.getElementById('landed-box');
    if (!box || car.price == null) { if (box) box.innerHTML = ''; return; }
    const r = Landed.calc(car.price, car.currency || 'NGN', car.location);
    if (r.inCountry) {
      box.innerHTML = `<div class="landed-head">In Nigeria — no import needed</div>
        <div class="landed-note">✓ Already in-country. No customs duty or shipping — ready for local handover.</div>`;
      return;
    }
    const row = (label, usd) => `<div class="landed-row"><span>${label}</span><span class="js-usd" data-usd="${usd}">${Money.one(usd)}</span></div>`;
    box.innerHTML = `
      <div class="landed-head">Est. landed cost in Nigeria</div>
      ${row('Vehicle price', r.priceUsd)}
      ${row('Import duty &amp; taxes', r.dutyUsd)}
      ${row('Shipping (RoRo est.)', r.shippingUsd)}
      <div class="landed-total"><span>To your door</span><span class="js-usd" data-usd="${r.totalUsd}">${Money.one(r.totalUsd)}</span></div>
      <a class="landed-link" href="clearance.html?cif=${encodeURIComponent(car.price)}&cur=${encodeURIComponent(car.currency||'NGN')}">Full customs breakdown →</a>`;
  }

  // Upgrade the quick local estimate above with the ACCURATE server breakdown:
  // every customs fee with its rate %, the all-in duty total, and the effective
  // percentage of the car's value — computed with the live FX rate.
  async function loadCustoms(car){
    const box = document.getElementById('landed-box');
    if (!box || car.price == null) return;
    try {
      const c = await API.getCustoms(car.id, API.getUser()?.location || '');
      if (!c || !c.available || c.inCountry) return;   // in-country note already rendered
      const ship = Landed.calc(car.price, car.currency || 'NGN', car.location).shippingUsd;
      const row = (label, usd, cls='landed-row') =>
        `<div class="${cls}"><span>${esc(label)}</span><span class="js-usd" data-usd="${usd}">${Money.one(usd)}</span></div>`;
      box.innerHTML = `
        <div class="landed-head">Import duty &amp; fees — ${esc(c.destination.country)}</div>
        ${row('Vehicle price', c.input.cifValueUsd)}
        ${c.charges.lineItems.map(li => row(`${li.label} (${li.ratePct}%)`, li.amountUsd)).join('')}
        ${row(`Total import charges (≈${c.charges.effectivePct}% of value)`, c.charges.totalUsd, 'landed-row landed-subtotal')}
        ${row('Shipping (RoRo est.)', ship)}
        <div class="landed-total"><span>To your door</span><span class="js-usd" data-usd="${c.input.cifValueUsd + c.charges.totalUsd + ship}">${Money.one(c.input.cifValueUsd + c.charges.totalUsd + ship)}</span></div>
        ${(c.notes || []).map(n => `<div class="landed-note">${esc(n)}</div>`).join('')}
        <a class="landed-link" href="clearance.html?cif=${encodeURIComponent(car.price)}&cur=${encodeURIComponent(car.currency||'NGN')}">Compare clearing agents →</a>`;
    } catch { /* non-critical — the quick estimate stays */ }
  }

  function tileUrl(){
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    return dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  }

  async function initMap(car){
    const card = document.getElementById('map-card');
    if (!card || typeof L === 'undefined') return;
    let lat = car.latitude, lng = car.longitude;
    if (lat == null || lng == null) {
      if (!car.location) return;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(car.location)}`, { headers: { Accept: 'application/json' } });
        const d = await res.json();
        if (d && d[0]) { lat = +d[0].lat; lng = +d[0].lon; }
      } catch {}
    }
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;
    card.style.display = '';
    document.getElementById('map-loc').textContent = car.location ? `· ${car.location}` : '';
    const map = L.map('car-map', { scrollWheelZoom: false, attributionControl: true }).setView([lat, lng], 9);
    L.tileLayer(tileUrl(), { maxZoom: 18, attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(map);
    const icon = L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 26] });
    L.marker([lat, lng], { icon }).addTo(map);
    setTimeout(() => map.invalidateSize(), 200);
  }

  load();
