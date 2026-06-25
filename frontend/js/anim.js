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
    fresh.forEach((c, i) => setTimeout(() => countUp(c), 140 + i * 25));
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

  // Cards present when we load (rendered before anim.js arrived).
  document.querySelectorAll('.cars-grid').forEach(scheduleGrid);

  // Cards added later — pagination, filters, recommendations, home "featured", etc.
  new MutationObserver(muts => {
    const grids = new Set();
    muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches?.('.car-card')) grids.add(n.closest('.cars-grid') || n.parentElement);
      else n.querySelectorAll?.('.car-card').forEach(c => grids.add(c.closest('.cars-grid') || c.parentElement));
    }));
    grids.forEach(scheduleGrid);
  }).observe(document.body, { childList: true, subtree: true });

  Anim.revealCards = revealCards;   // available for manual use if ever needed
}
