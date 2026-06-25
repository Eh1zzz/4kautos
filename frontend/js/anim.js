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

  /* ── Bundle C — micro-interactions ─────────────────────────────────── */

  // ❤️ pop + particle burst when a car is saved.
  function heartBurst(btn) {
    if (btn.matches('.card-saves')) animate(btn, { scale: { from: 0.55, to: 1 }, duration: 440, ease: 'out(3)' });
    if (document.hidden) return;
    const r = btn.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;z-index:9999;pointer-events:none`;
    document.body.appendChild(layer);
    const N = 8;
    for (let i = 0; i < N; i++) {
      const d = document.createElement('span');
      d.textContent = '♥';
      d.style.cssText = 'position:absolute;left:0;top:0;font-size:11px;line-height:1;color:var(--accent,#8b7cff)';
      layer.appendChild(d);
      const ang = (i / N) * Math.PI * 2, dist = 20 + Math.random() * 16;
      animate(d, {
        translateX: { from: 0, to: Math.cos(ang) * dist },
        translateY: { from: 0, to: Math.sin(ang) * dist },
        scale: { from: 1, to: 0 }, opacity: { from: 1, to: 0 },
        duration: 600, ease: 'out(3)',
      });
    }
    setTimeout(() => layer.remove(), 850);
  }
  document.addEventListener('click', e => {
    const btn = e.target.closest?.('.card-saves, #save-btn');
    if (!btn) return;
    // app.js toggles .saved first; celebrate only when it's now ON.
    setTimeout(() => { if (btn.classList.contains('saved')) heartBurst(btn); }, 0);
  });

  // ✓ draw a checkmark into success toasts.
  const SVGNS = 'http://www.w3.org/2000/svg';
  function decorateToast(t) {
    if (!t || t.__an || !t.classList?.contains('success')) return; t.__an = true;
    if (document.hidden) return;
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '15'); svg.setAttribute('height', '15');
    svg.style.cssText = 'vertical-align:-2px;margin-right:7px;flex:0 0 auto';
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', 'M5 13l4 4L19 7'); p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2.6');
    p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p); t.insertBefore(svg, t.firstChild);
    let len; try { len = p.getTotalLength(); } catch { return; }
    p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
    animate(p, { strokeDashoffset: { from: len, to: 0 }, duration: 480, ease: 'out(3)' });
  }

  // Chat: spring the newest bubble in when a message arrives (the list is
  // re-rendered wholesale, so only animate when the bubble count grows).
  function watchChat(box) {
    if (!box || box.__an) return; box.__an = true;
    let prev = box.querySelectorAll('.tmsg').length;
    new MutationObserver(() => {
      const items = box.querySelectorAll('.tmsg'), n = items.length;
      if (n > prev && !document.hidden) animate(items[n - 1], { opacity: { from: 0, to: 1 }, translateY: { from: 10, to: 0 }, scale: { from: 0.96, to: 1 }, duration: 360, ease: 'out(3)' });
      prev = n;
    }).observe(box, { childList: true });
  }

  /* ── Bundle D — hero stats & wizard flow ───────────────────────────── */

  // Count a hero stat up from 0 once it receives a numeric value.
  function watchStat(el) {
    if (!el || el.__w) return; el.__w = true;
    const tryCount = () => {
      if (el.__counting || el.__done) return;
      const m = (el.textContent || '').trim().match(/^([\d,]+)(\+?)$/);
      if (!m) return;
      const target = +m[1].replace(/,/g, ''); if (!target) return;
      el.__done = true;
      if (document.hidden) return;                 // keep the real value as-is
      el.__counting = true;
      const suffix = m[2] || '', obj = { v: 0 };
      animate(obj, {
        v: target, duration: 1100, ease: 'out(3)',
        onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString('en-US') + suffix; },
        onComplete: () => { el.textContent = target.toLocaleString('en-US') + suffix; el.__counting = false; },
      });
    };
    new MutationObserver(() => { if (!el.__counting) tryCount(); }).observe(el, { childList: true, characterData: true, subtree: true });
    tryCount();                                     // in case it's already populated
  }

  // Pop the active wizard step indicator whenever the step changes.
  function watchWizard(steps) {
    if (!steps || steps.__w) return; steps.__w = true;
    const pop = () => {
      const active = steps.querySelector('.wstep.active');
      if (!active || active.__last) return;
      steps.querySelectorAll('.wstep').forEach(s => { s.__last = false; });
      active.__last = true;
      if (document.hidden) return;
      animate(active.querySelector('.wstep-n') || active, { scale: { from: 0.7, to: 1 }, duration: 420, ease: 'out(3)' });
    };
    new MutationObserver(pop).observe(steps, { attributes: true, attributeFilter: ['class'], subtree: true });
    pop();
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
    if (n.matches?.('.toast')) decorateToast(n);
    n.querySelectorAll?.('.toast').forEach(decorateToast);
    if (n.matches?.('#thread-msgs')) watchChat(n);
    else { const tb = n.querySelector?.('#thread-msgs'); if (tb) watchChat(tb); }
    return grids;
  }

  // Initial scan — anything already in the DOM when anim.js loads.
  document.querySelectorAll('.cars-grid').forEach(scheduleGrid);
  document.querySelectorAll('.price-eval').forEach(popBadge);
  { const dl = document.getElementById('specs-dl'); if (dl) staggerSpecs(dl); }
  { const g = document.querySelector('.gallery-main'); if (g) initGallery(g); }
  { const tb = document.getElementById('thread-msgs'); if (tb) watchChat(tb); }
  document.querySelectorAll('.hero-stat-n').forEach(watchStat);
  { const ws = document.getElementById('wizard-steps'); if (ws) watchWizard(ws); }

  // Watch for everything rendered later (async loads, pagination, filters…).
  new MutationObserver(muts => {
    const grids = new Set();
    muts.forEach(m => m.addedNodes.forEach(n => handleNode(n).forEach(g => g && grids.add(g))));
    grids.forEach(scheduleGrid);
  }).observe(document.body, { childList: true, subtree: true });

  Anim.revealCards = revealCards;
  Anim.popBadge = popBadge;
}
