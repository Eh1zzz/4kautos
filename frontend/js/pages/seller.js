/* Public seller profile: header card + the seller's live inventory.
   Data: GET /sellers/:id (safe projection) + the existing GET /cars?sellerId=. */
(function () {
  const id = new URLSearchParams(location.search).get('id');
  const show = el => el.classList.remove('hidden');
  const hide = el => el.classList.add('hidden');

  async function load() {
    const spinner = document.getElementById('seller-spinner');
    if (!id) { location.href = 'listings.html'; return; }
    try {
      const s = await API.getSeller(id);
      document.title = `${s.name} | 4Kautos`;

      document.getElementById('s-ava').textContent =
        s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
      document.getElementById('s-name').textContent = s.name;
      document.getElementById('s-badge').innerHTML = s.verified
        ? `<span class="seller-hero-verified"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ${esc(window.t('seller.verified', 'Verified seller'))}</span>`
        : `<span class="seller-hero-unverified">${esc(window.t('seller.unverified', 'Not yet verified'))}</span>`;

      const since = s.memberSince
        ? new Date(s.memberSince).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : null;
      document.getElementById('s-meta').textContent = [
        since ? `${window.t('seller.memberSince', 'Member since')} ${since}` : null,
        `${s.listings} ${window.t('seller.listingsCount', 'listings')}`,
        s.completedSales ? `${s.completedSales} ${window.t('seller.completedSales', 'completed sales')}` : null,
      ].filter(Boolean).join(' · ');

      // Average rating next to the verified badge (only once reviews exist).
      if (s.rating?.count) {
        document.getElementById('s-badge').insertAdjacentHTML('beforeend',
          ` <span class="stars" title="${s.rating.avg}/5">★</span> <b>${esc(s.rating.avg)}</b>` +
          ` <span style="color:var(--text3);font-size:.8rem">(${s.rating.count} ${esc(window.t('seller.reviews', 'reviews'))})</span>`);
      }
      loadReviews();

      const cars = await API.getCars({ sellerId: id, limit: 48 }).catch(() => []);
      const grid = document.getElementById('seller-grid');
      if (cars.length) {
        grid.innerHTML = cars.map(c => window.carCard(c)).join('');
        window.observeReveals?.();
        Money.repriceAll?.();
      } else {
        hide(grid); show(document.getElementById('seller-empty'));
      }

      hide(spinner); show(document.getElementById('seller-content'));
    } catch {
      hide(spinner); show(document.getElementById('seller-notfound'));
    }
  }
  async function loadReviews() {
    try {
      const reviews = await API.getSellerReviews(id);
      if (!reviews.length) return;   // section stays hidden until there's something to show
      const stars = n => `<span class="stars" aria-label="${n}/5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
      document.getElementById('reviews-list').innerHTML = reviews.map(r => `
        <div class="review-card">
          <div class="review-head">
            <span>${stars(r.rating)} <b style="color:var(--text)">${esc(r.buyer_name)}</b>${r.car_title ? ` · ${esc(r.car_title)}` : ''}</span>
            <span>${new Date(r.created_at).toLocaleDateString()}</span>
          </div>
          ${r.comment ? `<div class="review-body">${esc(r.comment)}</div>` : ''}
        </div>`).join('');
      show(document.getElementById('reviews-section'));
    } catch { /* non-critical — leave the section hidden */ }
  }

  load();
})();
