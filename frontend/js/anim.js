/* =========================================================================
   4kautos — anim.js   ·   progressive animation layer (anime.js v4)
   -------------------------------------------------------------------------
   Loaded dynamically by app.js. PURE ENHANCEMENT: if anime.js fails to load,
   or the browser prefers reduced motion, the site behaves exactly as before
   (the CSS .reveal system still runs). Nothing here touches data or the API.

   Bundle A (this file): staggered car-grid reveals + price count-up.
   (Bundles B/C/D — detail page, micro-interactions, flows — added later.)
   ========================================================================= */
import { animate, stagger, createTimeline, spring, splitText, onScroll } from 'https://esm.sh/animejs@4';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Expose a small handle for page scripts / later bundles.
const Anim = { animate, stagger, enabled: !reduce };
window.Anim = Anim;

// Reduced motion → let the existing CSS reveal handle everything, do nothing.
if (!reduce) {

  const animated = new WeakSet();   // cards we've already revealed

  // Real spring physics for the "pop" moments (slight overshoot, then settle).
  // A spring supplies its own duration, so `duration` is ignored where used.
  const springPop = spring({ stiffness: 210, damping: 13 });

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
    animate(el, { scale: { from: 0, to: 1 }, opacity: { from: 0, to: 1 }, ease: springPop });
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
    if (btn.matches('.card-saves')) animate(btn, { scale: { from: 0.55, to: 1 }, ease: springPop });
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
      animate(active.querySelector('.wstep-n') || active, { scale: { from: 0.7, to: 1 }, ease: springPop });
    };
    new MutationObserver(pop).observe(steps, { attributes: true, attributeFilter: ['class'], subtree: true });
    pop();
  }

  /* ── Bundle E — choreographed hero entrance ────────────────────────── */
  // One timeline: eyebrow → headline words → sub → search card → stats.
  // Only runs while the page is still "fresh" (fast loads); on a slow first
  // visit the hero has long been visible, and re-hiding it would look broken.
  function heroIntro() {
    const title = document.querySelector('.hero-title');
    if (!title || title.__an || performance.now() > 1200) return;
    title.__an = true;
    const eyebrow = document.querySelector('.hero-eyebrow');
    const sub     = document.querySelector('.hero-sub');
    const card    = document.querySelector('.hero-search-card');
    const stats   = [...document.querySelectorAll('.hero-stats > div')];

    // Split the headline into word spans; if the splitter dislikes the markup
    // (<em>/<br> inside), fall back to animating the whole heading.
    let words = null;
    try { const s = splitText(title, { words: true, chars: false }); if (s.words?.length) words = s.words; }
    catch { /* fallback below */ }

    const rest = [eyebrow, sub, card, ...stats].filter(Boolean);
    rest.forEach(el => { el.style.opacity = '0'; });

    const tl = createTimeline({ defaults: { ease: 'out(3)' } });
    if (eyebrow) tl.add(eyebrow, { opacity: { from: 0, to: 1 }, translateY: { from: 12, to: 0 }, duration: 420 });
    if (words) {
      tl.add(words, {
        opacity: { from: 0, to: 1 }, translateY: { from: '0.6em', to: 0 }, rotate: { from: 4, to: 0 },
        delay: stagger(46), duration: 620,
      }, '-=180');
    } else {
      tl.add(title, { opacity: { from: 0, to: 1 }, translateY: { from: 18, to: 0 }, duration: 620 }, '-=180');
    }
    if (sub)  tl.add(sub,  { opacity: { from: 0, to: 1 }, translateY: { from: 14, to: 0 }, duration: 460 }, '-=340');
    if (card) tl.add(card, { opacity: { from: 0, to: 1 }, translateY: { from: 22, to: 0 }, scale: { from: 0.985, to: 1 }, duration: 520 }, '-=260');
    if (stats.length) tl.add(stats, { opacity: { from: 0, to: 1 }, translateY: { from: 12, to: 0 }, delay: stagger(70), duration: 420 }, '-=300');
    // Safety net: whatever happens, nothing stays hidden.
    setTimeout(() => rest.concat(title).forEach(el => { el.style.opacity = ''; }), 2600);
  }
  heroIntro();

  /* ── Bundle F — scroll-driven car journey (How it works) ──────────── */
  // A small car drives across the steps grid as the section scrolls through
  // the viewport; each step lights up as the car reaches it.
  function journey() {
    const grid = document.querySelector('.how-section .steps-grid');
    if (!grid || grid.__an) return; grid.__an = true;
    const steps = [...grid.querySelectorAll('.step-card')];
    if (steps.length < 2) return;

    const car = document.createElement('div');
    car.className = 'journey-car';
    car.setAttribute('aria-hidden', 'true');
    car.innerHTML = `<svg viewBox="0 0 48 26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19V15q0-2 3-2h36q3 0 3 2v4"/><path d="M12 13 16 8h14l4 5"/><circle cx="14" cy="20" r="3.2"/><circle cx="34" cy="20" r="3.2"/></svg>`;
    grid.appendChild(car);

    // Horizontal when the cards share a row, vertical when they stack.
    const horizontal = () => steps[0].offsetTop === steps[steps.length - 1].offsetTop;
    const span = () => {
      const a = steps[0], b = steps[steps.length - 1];
      return horizontal()
        ? { axis: 'translateX', from: a.offsetLeft, to: b.offsetLeft + b.offsetWidth - 46 }
        : { axis: 'translateY', from: a.offsetTop, to: b.offsetTop + 8 };
    };

    const light = progress => {
      const lit = Math.floor(progress * steps.length + 0.15);
      steps.forEach((s, i) => s.classList.toggle('lit', i < lit));
    };

    let anim = null;
    const build = () => {
      if (anim) { try { anim.revert(); } catch { /* keep going */ } }
      const s = span();
      car.style.transform = '';
      try {
        anim = animate(car, {
          [s.axis]: { from: s.from, to: s.to },
          ease: 'linear',
          onUpdate: self => light(self.progress ?? 0),
          autoplay: onScroll({ target: grid, enter: 'bottom-=60 top', leave: 'top+=120 bottom', sync: 0.28 }),
        });
      } catch {
        // Scroll-sync unavailable → one-shot drive across when the grid appears.
        new IntersectionObserver((ents, io) => ents.forEach(e => {
          if (!e.isIntersecting) return; io.disconnect();
          const obj = { p: 0 };
          animate(obj, { p: 1, duration: 1600, ease: 'inOut(2)', onUpdate: () => {
            const q = span();
            car.style.transform = `${q.axis}(${q.from + (q.to - q.from) * obj.p}px)`;
            light(obj.p);
          } });
        }), { threshold: 0.35 }).observe(grid);
      }
    };
    build();
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 300); });
  }
  journey();

  /* ── Bundle G — draggable strips (grab, throw, glide) ─────────────── */
  // Mouse drag-to-scroll with thrown momentum for the horizontal scrollers
  // (listings brand strip, gallery thumbs). Touch keeps native scrolling —
  // this only adds the desktop "grab" feel, so wheel/scrollbar still work.
  function dragScroll(el) {
    if (!el || el.__drag) return; el.__drag = true;
    el.classList.add('drag-scroll');
    el.addEventListener('dragstart', e => e.preventDefault()); // no image ghost-drag
    let down = false, lastX = 0, moved = 0, vel = 0, lastT = 0, glide = null;
    el.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = 0; vel = 0; lastX = e.clientX; lastT = e.timeStamp;
      if (glide) { try { glide.pause(); } catch { /* ok */ } glide = null; }
      el.classList.add('dragging');
    });
    el.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - lastX;
      try { if (Math.abs(dx) > 2 && !el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId); }
      catch { /* capture is best-effort — never let it stop the drag */ }
      el.scrollLeft -= dx;
      moved += Math.abs(dx);
      const dt = Math.max(1, e.timeStamp - lastT);
      vel = 0.8 * vel + 0.2 * (dx / dt) * 16;      // px per frame, smoothed
      lastX = e.clientX; lastT = e.timeStamp;
    });
    const release = () => {
      if (!down) return; down = false;
      el.classList.remove('dragging');
      if (Math.abs(vel) > 2) {                      // throw → glide out
        const target = el.scrollLeft - vel * 14;
        const obj = { s: el.scrollLeft };
        glide = animate(obj, {
          s: Math.max(0, Math.min(target, el.scrollWidth - el.clientWidth)),
          duration: 700, ease: 'out(3)',
          onUpdate: () => { el.scrollLeft = obj.s; },
        });
      }
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    // A real drag must not fire the tile's click when the mouse is released.
    el.addEventListener('click', e => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
  }
  const DRAG_SEL = '.listings-main .brand-strip-sm, .gallery-thumbs';
  document.querySelectorAll(DRAG_SEL).forEach(dragScroll);

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
    if (n.matches?.(DRAG_SEL)) dragScroll(n);
    n.querySelectorAll?.(DRAG_SEL).forEach(dragScroll);
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
