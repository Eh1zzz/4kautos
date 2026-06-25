/* =========================================================================
   4kautos — anim.js   ·   progressive animation layer (anime.js v4)
   -------------------------------------------------------------------------
   Loaded dynamically by app.js. PURE ENHANCEMENT: if anime.js fails to load,
   or the browser prefers reduced motion, the site behaves exactly as before
   (the CSS .reveal system still runs). Nothing here touches data or the API.

   Bundle A (this file): staggered car-grid reveals + price count-up.
   (Bundles B/C/D — detail page, micro-interactions, flows — added later.)
   ========================================================================= */
import { animate, stagger } from 'https://esm.sh/animejs@4';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Expose a small handle for page scripts / later bundles.
const Anim = { animate, stagger, enabled: !reduce };
window.Anim = Anim;

// Reduced motion → let the existing CSS reveal handle everything, do nothing.
if (!reduce) {

  const animated = new WeakSet();   // cards we've already revealed

  const gridCols = grid => {
    try { return Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length); }
    catch { return 4; }
  };

  // Roll the headline price up to its value as the card appears.
  function countUp(card) {
    const el = card.querySelector('.price-main');
    if (!el) return;
    const raw = el.textContent || '';
    const m = raw.match(/^(\D*)([\d,]+)(.*)$/);          // symbol + number + rest
    if (!m) return;
    const target = +m[2].replace(/,/g, '');
    if (!isFinite(target) || target < 1000) return;       // skip tiny/odd values
    const pre = m[1], post = m[3], obj = { v: 0 };
    animate(obj, {
      v: target, duration: 850, ease: 'out(3)',
      onUpdate: () => { el.textContent = pre + Math.round(obj.v).toLocaleString('en-US') + post; },
      onComplete: () => { el.textContent = raw; },         // restore exact original text
    });
  }

  // Stagger a set of cards into view (grid-aware, from the centre).
  function revealCards(cards) {
    const fresh = cards.filter(c => !animated.has(c));
    if (!fresh.length) return;
    const cols = gridCols(fresh[0].closest('.cars-grid') || fresh[0].parentElement || document.body);
    fresh.forEach(c => { animated.add(c); c.style.opacity = '0'; c.classList.remove('reveal'); });
    animate(fresh, {
      opacity:    { from: 0, to: 1 },
      translateY: { from: 28, to: 0 },
      scale:      { from: 0.96, to: 1 },
      delay: stagger(55, { grid: [cols, Math.ceil(fresh.length / cols)], from: 'center' }),
      duration: 640, ease: 'out(3)',
      onComplete: () => fresh.forEach(c => { c.classList.add('in'); c.style.opacity = ''; c.style.transform = ''; }),
    });
    fresh.forEach((c, i) => setTimeout(() => { countUp(c); drawIcon(c); }, 140 + i * 25));
    // Safety net — never leave a card invisible if anything misbehaves.
    fresh.forEach(c => setTimeout(() => {
      if (c.style.opacity === '0') { c.style.opacity = ''; c.style.transform = ''; c.classList.add('in'); }
    }, 1600));
  }

  // Below-the-fold grids reveal as they scroll into view.
  const gridIO = new IntersectionObserver(ents => {
    ents.forEach(e => { if (e.isIntersecting) { gridIO.unobserve(e.target); revealCards([...e.target.querySelectorAll('.car-card')]); } });
  }, { rootMargin: '0px 0px -6% 0px' });

  function scheduleGrid(grid) {
    if (!grid || !grid.querySelectorAll) return;
    const fresh = [...grid.querySelectorAll('.car-card')].filter(c => !animated.has(c));
    if (!fresh.length) return;
    // Hide immediately. This runs in the MutationObserver microtask (before the
    // browser paints the freshly-inserted cards), so there is no visible flash.
    fresh.forEach(c => { c.style.opacity = '0'; c.classList.remove('reveal'); });
    const r = grid.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) revealCards(fresh);
    else gridIO.observe(grid);
  }

  /* ── Bundle B — detail page & card detail flourishes ───────────────── */

  // Line-draw a card's body-type icon as it appears (subtle "drawn" detail).
  function drawIcon(card) {
    if (document.hidden) return;                  // don't hide icons we can't animate yet
    card.querySelectorAll('.card-type svg path, .card-type svg circle').forEach(p => {
      let len; try { len = p.getTotalLength(); } catch { return; }
      if (!len) return;
      const clear = () => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; };
      p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      animate(p, { strokeDashoffset: { from: len, to: 0 }, duration: 650, ease: 'out(3)', onComplete: clear });
      setTimeout(clear, 1400);                     // safety net: never leave the icon hidden
    });
  }

  // Spring-pop the "Great/Good price" verdict badge when it appears.
  // (Only standalone badges — on cards it just rides in with the card.)
  function popBadge(el) {
    if (!el || el.__an || el.closest('.car-card')) return; el.__an = true;
    if (document.hidden) return;   // leave it in its natural (visible) state
    // Quick scale-in "pop". Uses only the proven out(3) ease + {from,to} form
    // (verified in bundle A) so nothing here can throw on the live site.
    animate(el, { scale: { from: 0, to: 1 }, opacity: { from: 0, to: 1 }, duration: 520, ease: 'out(3)' });
  }

  // Stagger the spec rows in on the detail page.
  function staggerSpecs(dl) {
    if (!dl) return;
    const rows = [...dl.querySelectorAll('.spec-row')].filter(r => !r.__an);
    if (!rows.length) return; rows.forEach(r => r.__an = true);
    if (document.hidden) return;   // leave rows visible if we can't animate them
    animate(rows, { opacity: { from: 0, to: 1 }, translateX: { from: -14, to: 0 }, delay: stagger(40), duration: 460, ease: 'out(3)' });
  }

  // Gallery: cross-fade on photo change + swipe/drag to navigate (snaps back).
  function initGallery(main) {
    if (!main || main.__an) return; main.__an = true;
    const img = main.querySelector('img'); if (!img) return;
    let lastSrc = img.getAttribute('src');
    new MutationObserver(() => {
      const s = img.getAttribute('src');
      if (s === lastSrc) return; lastSrc = s;
      if (document.hidden) return;
      animate(img, { opacity: { from: 0.25, to: 1 }, scale: { from: 1.04, to: 1 }, duration: 380, ease: 'out(3)' });
    }).observe(img, { attributes: true, attributeFilter: ['src'] });

    const prev = document.getElementById('gal-prev'), next = document.getElementById('gal-next');
    let startX = 0, dx = 0, dragging = false;
    main.style.touchAction = 'pan-y';
    main.addEventListener('pointerdown', e => { startX = e.clientX; dx = 0; dragging = true; });
    main.addEventListener('pointermove', e => { if (dragging) { dx = e.clientX - startX; img.style.transform = `translateX(${dx * 0.4}px)`; } });
    const end = () => {
      if (!dragging) return; dragging = false;
      animate(img, { translateX: { to: 0 }, duration: 360, ease: 'out(3)' });
      if (dx <= -50 && next) next.click();
      else if (dx >= 50 && prev) prev.click();
    };
    main.addEventListener('pointerup', end);
    main.addEventListener('pointercancel', end);
    main.addEventListener('pointerleave', end);
  }

  // Route an added node to the right enhancement; returns any grids to schedule.
  function handleNode(n) {
    const grids = [];
    if (n.nodeType !== 1) return grids;
    if (n.matches?.('.car-card')) grids.push(n.closest('.cars-grid') || n.parentElement);
    n.querySelectorAll?.('.car-card').forEach(c => grids.push(c.closest('.cars-grid') || c.parentElement));
    if (n.matches?.('.price-eval')) popBadge(n);
    n.querySelectorAll?.('.price-eval').forEach(popBadge);
    if (n.matches?.('.spec-row')) staggerSpecs(n.closest('#specs-dl') || n.parentElement);
    else if (n.querySelector?.('.spec-row')) staggerSpecs(n.querySelector('#specs-dl') || n);
    if (n.matches?.('.gallery-main')) initGallery(n);
    else { const g = n.querySelector?.('.gallery-main'); if (g) initGallery(g); }
    return grids;
  }

  // Initial scan — anything already in the DOM when anim.js loads.
  document.querySelectorAll('.cars-grid').forEach(scheduleGrid);
  document.querySelectorAll('.price-eval').forEach(popBadge);
  { const dl = document.getElementById('specs-dl'); if (dl) staggerSpecs(dl); }
  { const g = document.querySelector('.gallery-main'); if (g) initGallery(g); }

  // Watch for everything rendered later (async loads, pagination, filters…).
  new MutationObserver(muts => {
    const grids = new Set();
    muts.forEach(m => m.addedNodes.forEach(n => handleNode(n).forEach(g => g && grids.add(g))));
    grids.forEach(scheduleGrid);
  }).observe(document.body, { childList: true, subtree: true });

  Anim.revealCards = revealCards;
  Anim.popBadge = popBadge;
}
