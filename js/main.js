/* ════════════════════════════════════════════════════════════════
   main.js · Melvern Mogens — portfolio interaction layer
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const doc = document;
  const body = doc.body;
  const $  = (s, r) => (r || doc).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || doc).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* every hidden-initial style is scoped to this class, so if the script dies
     the page still renders in full */
  doc.documentElement.classList.add('js-reveal');

  /* ══ TEXT SPLITTING ═══════════════════════════════════════ */
  function split(el) {
    const mode = el.dataset.split;
    if (!mode || el.dataset.splitDone) return;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el.dataset.splitDone = '1';
    el.textContent = '';

    if (mode === 'words') {
      text.split(' ').forEach((w, i) => {
        const wrap = doc.createElement('span');
        wrap.className = 'word-wrap';
        wrap.style.setProperty('--wi', i);
        const inner = doc.createElement('span');
        inner.textContent = w;
        wrap.appendChild(inner);
        el.appendChild(wrap);
        el.appendChild(doc.createTextNode(' '));
      });
    } else {
      let i = 0;
      text.split('').forEach(ch => {
        if (ch === ' ') { el.appendChild(doc.createTextNode(' ')); return; }
        const wrap = doc.createElement('span');
        wrap.className = 'char-wrap';
        wrap.style.setProperty('--ci', i++);
        const inner = doc.createElement('span');
        inner.textContent = ch;
        wrap.appendChild(inner);
        el.appendChild(wrap);
      });
      el.setAttribute('aria-label', text);
    }
  }

  $$('[data-split]').forEach(split);

  /* stagger sibling groups so they cascade instead of popping together */
  const stagger = (sel, stepMs, cap) => {
    $$(sel).forEach((el, i) => {
      if (el.dataset.delay) return;
      el.dataset.delay = String((i % (cap || 8)) * stepMs);
    });
  };
  stagger('#skillsGrid .skill', 45, 10);
  stagger('#workList .card', 90, 6);

  /* ══ REVEAL ═══════════════════════════════════════════════ */
  const pending = new Set($$('[data-reveal]'));

  function revealNow(el) {
    if (!pending.has(el)) return;
    pending.delete(el);
    const d = parseInt(el.dataset.delay || '0', 10);
    if (d) el.style.setProperty('--rd', d + 'ms');
    el.classList.add('is-in');
    revealIO.unobserve(el);
    if (el.classList.contains('stats')) runCounters(el);
  }

  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) revealNow(e.target); });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });

  pending.forEach(el => revealIO.observe(el));

  /* Backstop for the observer: a plain geometry check driven by scroll and
     resize. Observers can be starved (throttled tabs, restored sessions) and
     a missed callback here means a section stays invisible forever. */
  function sweep() {
    if (!pending.size) return;
    const h = innerHeight;
    Array.from(pending).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < h * 0.92 && r.bottom > 0) revealNow(el);
    });
  }
  let lastSweep = 0;
  function onScrollSweep() {
    if (!pending.size) return;
    const t = performance.now();
    if (t - lastSweep < 120) return;   // rect reads are cheap here, but not free
    lastSweep = t;
    sweep();
  }
  addEventListener('scroll', onScrollSweep, { passive: true });
  addEventListener('resize', sweep, { passive: true });
  addEventListener('load', sweep);

  /* ══ COUNTERS ═════════════════════════════════════════════ */
  function runCounters(scope) {
    const items = $$('[data-count]', scope).map((el, idx) => ({
      el,
      target: parseFloat(el.dataset.count),
      dec: parseInt(el.dataset.decimals || '0', 10),
      suffix: el.dataset.suffix || '',
      delay: idx * 90
    }));
    if (!items.length) return;

    if (reduced) {
      items.forEach(it => { it.el.textContent = it.target.toFixed(it.dec) + it.suffix; });
      return;
    }

    // one loop for the whole group: four independent rAF chains writing text
    // during a scroll is four layout invalidations per frame
    const dur = 1500;
    let t0 = null;
    function step(now) {
      if (t0 === null) t0 = now;
      let done = true;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const p = clamp((now - t0 - it.delay) / dur, 0, 1);
        const e = 1 - Math.pow(1 - p, 4);
        it.el.textContent = (it.target * e).toFixed(it.dec) + (p === 1 ? it.suffix : '');
        if (p < 1) done = false;
      }
      if (!done) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ══ SKILL METERS ═════════════════════════════════════════ */
  function fillMeters(scope) {
    $$('.skill__meter i', scope).forEach((bar, i) => {
      bar.style.setProperty('--md', (i % 10) * 55 + 'ms');
      bar.style.width = bar.dataset.percent + '%';
    });
  }
  const grid = $('#skillsGrid');
  if (grid) {
    const mIO = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) { fillMeters(grid); mIO.disconnect(); }
    }, { threshold: 0.12 });
    mIO.observe(grid);
  }

  /* ══ CURSOR ═══════════════════════════════════════════════ */
  const cursor = $('#cursor');
  const cursorState = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
  let cursorDot, cursorRing, cursorLabel;

  if (cursor && fine && !reduced) {
    cursorDot = $('.cursor__dot', cursor);
    cursorRing = $('.cursor__ring', cursor);
    cursorLabel = $('.cursor__label', cursor);

    addEventListener('mousemove', (e) => {
      cursorState.tx = e.clientX; cursorState.ty = e.clientY;
      if (!cursor.classList.contains('is-ready')) cursor.classList.add('is-ready');
    }, { passive: true });

    addEventListener('mousedown', () => cursor.classList.add('is-down'));
    addEventListener('mouseup', () => cursor.classList.remove('is-down'));
    addEventListener('mouseleave', () => cursor.classList.remove('is-ready'));

    const HOVER_SEL = 'a, button, [data-cursor], .card, .chip, .skill';
    doc.addEventListener('mouseover', (e) => {
      const t = e.target.closest(HOVER_SEL);
      if (!t) return;
      const label = t.dataset.cursor || (t.tagName === 'A' && t.hostname && t.hostname !== location.hostname ? 'Open' : '');
      cursorLabel.textContent = label;
      cursor.classList.add('is-hover');
      cursor.classList.toggle('has-label', !!label);
    });
    doc.addEventListener('mouseout', (e) => {
      if (!e.target.closest(HOVER_SEL)) return;
      if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(HOVER_SEL)) return;
      cursor.classList.remove('is-hover');
      cursorLabel.textContent = '';
    });
  } else if (cursor) {
    cursor.remove();
  }

  /* ══ MAGNETIC ═════════════════════════════════════════════ */
  const magnets = [];
  if (fine && !reduced) {
    $$('[data-magnetic]').forEach(el => {
      const m = { el, x: 0, y: 0, tx: 0, ty: 0, active: false };
      magnets.push(m);
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        m.tx = (e.clientX - (r.left + r.width / 2)) * 0.28;
        m.ty = (e.clientY - (r.top + r.height / 2)) * 0.4;
        m.active = true;
      });
      el.addEventListener('mouseleave', () => { m.tx = 0; m.ty = 0; m.active = false; });
    });
  }

  /* ══ MENU ═════════════════════════════════════════════════ */
  const menu = $('#menu');
  const menuToggle = $('#menuToggle');
  const menuLinks = $$('.menu__nav a');
  menuLinks.forEach((a, i) => { $('span', a).style.setProperty('--i', i); });

  let menuOpen = false, closeTimer = null;

  function openMenu() {
    if (menuOpen) return;
    menuOpen = true;
    clearTimeout(closeTimer);
    menu.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      body.classList.add('menu-open', 'is-locked');
    }));
    menuToggle.setAttribute('aria-expanded', 'true');
    $('.menu-toggle__label', menuToggle).textContent = 'Close';
  }

  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    body.classList.remove('menu-open', 'is-locked');
    menuToggle.setAttribute('aria-expanded', 'false');
    $('.menu-toggle__label', menuToggle).textContent = 'Menu';
    closeTimer = setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 900);
  }

  if (menuToggle) menuToggle.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));

  menuLinks.forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id && id.length > 1 ? $(id) : null;
      if (!target) return;
      e.preventDefault();
      closeMenu();
      setTimeout(() => {
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', id);
      }, reduced ? 0 : 430);
    });
  });

  /* ══ MODAL ════════════════════════════════════════════════ */
  const modal = $('#honorModal');
  let modalOpen = false, modalTimer = null, lastFocus = null;

  function openModal() {
    if (!modal || modalOpen) return;
    modalOpen = true;
    clearTimeout(modalTimer);
    lastFocus = doc.activeElement;
    modal.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      modal.classList.add('is-open');
      body.classList.add('is-locked');
      const c = $('.modal__close', modal);
      if (c) c.focus();
    }));
  }
  function closeModal() {
    if (!modal || !modalOpen) return;
    modalOpen = false;
    modal.classList.remove('is-open');
    body.classList.remove('is-locked');
    modalTimer = setTimeout(() => { if (!modalOpen) modal.hidden = true; }, 550);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  const openHonor = $('#openHonor');
  if (openHonor) openHonor.addEventListener('click', openModal);
  $$('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));

  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (modalOpen) closeModal();
    else if (menuOpen) closeMenu();
  });

  /* keep tab focus inside open overlays */
  addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const scope = modalOpen ? modal : (menuOpen ? menu : null);
    if (!scope) return;
    const f = $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', scope)
      .filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ══ FILTERS ══════════════════════════════════════════════ */
  function wireFilter(btnSel, itemSel, attr, onEmpty) {
    const btns = $$(btnSel);
    if (!btns.length) return;
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        const val = btn.dataset[attr];
        let shown = 0;
        $$(itemSel).forEach(item => {
          const cat = item.dataset[attr === 'filter' ? 'cat' : 'workCat'];
          const on = val === 'all' || cat === val;
          item.classList.toggle('is-hidden', !on);
          if (on) shown++;
        });
        if (onEmpty) onEmpty(shown);
      });
    });
  }

  wireFilter('.skills__filters .chip', '.skill', 'filter');

  const workEmpty = $('#workEmpty');
  wireFilter('.work__filters .chip', '.card', 'work', (n) => {
    if (workEmpty) workEmpty.hidden = n > 0;
  });

  /* ══ WORK LAYOUT ══════════════════════════════════════════ */
  const workList = $('#workList');
  const gridBtn = $('#gridView');
  const listBtn = $('#listView');

  function setLayout(mode) {
    if (!workList) return;
    workList.classList.toggle('is-grid', mode === 'grid');
    workList.classList.toggle('is-list', mode === 'list');
    if (gridBtn) { gridBtn.classList.toggle('is-active', mode === 'grid'); gridBtn.setAttribute('aria-pressed', String(mode === 'grid')); }
    if (listBtn) { listBtn.classList.toggle('is-active', mode === 'list'); listBtn.setAttribute('aria-pressed', String(mode === 'list')); }
    try { localStorage.setItem('mm-work-layout', mode); } catch (e) { /* ignore */ }
  }
  if (gridBtn) gridBtn.addEventListener('click', () => setLayout('grid'));
  if (listBtn) listBtn.addEventListener('click', () => setLayout('list'));
  try {
    const saved = localStorage.getItem('mm-work-layout');
    if (saved) setLayout(saved);
  } catch (e) { /* ignore */ }

  /* cursor-following preview in list mode */
  const peek = $('#workPeek');
  const peekState = { x: 0, y: 0, tx: 0, ty: 0, on: false };
  if (peek && fine && !reduced) {
    const peekImg = $('img', peek);
    $$('.card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        if (!workList.classList.contains('is-list')) return;
        peekImg.src = card.dataset.img || '';
        peekState.on = true;
        peek.classList.add('is-visible');
      });
      card.addEventListener('mouseleave', () => {
        peekState.on = false;
        peek.classList.remove('is-visible');
      });
    });
  }

  /* spotlight on cards */
  if (fine) {
    $$('.card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  /* ══ HERO ROLE ROLLER ═════════════════════════════════════ */
  const roles = $$('.hero__role');
  if (roles.length > 1 && !reduced) {
    let ri = 0;
    setInterval(() => {
      const cur = roles[ri];
      ri = (ri + 1) % roles.length;
      const next = roles[ri];
      cur.classList.remove('is-active');
      cur.classList.add('is-leaving');
      next.classList.add('is-active');
      setTimeout(() => cur.classList.remove('is-leaving'), 850);
    }, 2600);
  }

  /* ══ CLOCK ════════════════════════════════════════════════ */
  const clocks = [$('#localTime'), $('#menuTime')].filter(Boolean);
  function tick() {
    const s = new Date().toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    clocks.forEach(c => { c.textContent = s; });
  }
  if (clocks.length) { tick(); setInterval(tick, 1000); }

  /* ══ RAIL + CHROME ════════════════════════════════════════ */
  const rail = $('#rail');
  const railLinks = $$('.rail a');
  const chrome = $('#chrome');
  const progressBar = $('#scrollProgress');

  const sections = $$('main [data-section]');
  if (sections.length && rail) {
    const secIO = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const id = e.target.id;
        railLinks.forEach(a => a.classList.toggle('is-active', a.dataset.rail === id));
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    sections.forEach(s => secIO.observe(s));
  }

  railLinks.forEach(a => {
    a.addEventListener('click', (e) => {
      const t = $(a.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* ══ HERO SCENE ═══════════════════════════════════════════ */
  const heroEl = $('#hero');
  const canvas = $('#iceCanvas');
  let scene = null;

  function initScene() {
    if (!canvas || !window.IceScene) return;
    scene = window.IceScene.mount(canvas, {
      center: () => (innerWidth > 1024 ? [0.30, 0.0] : [0, 0.04]),
      dist: () => (innerWidth > 1024 ? 3.30 : innerWidth > 700 ? 3.9 : 4.7)
    });
    if (!scene) return;
    heroEl.classList.add('has-webgl');
    canvas.classList.add('is-live');
    if (reduced) { scene.renderOnce(); return; }
    scene.start();

    const heroIO = new IntersectionObserver((e) => {
      scene.setVisible(e[0].isIntersecting);
    }, { threshold: 0 });
    heroIO.observe(heroEl);

    if (fine) {
      addEventListener('mousemove', (e) => {
        scene.pointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
      }, { passive: true });
    }
  }

  /* ══ TICKER ═══════════════════════════════════════════════ */
  const tickers = $$('.ticker__row').map(row => {
    const track = $('.ticker__track', row);
    return { track, dir: parseFloat(row.dataset.speed || '1'), x: 0, w: 0 };
  }).filter(t => t.track);

  function measureTickers() {
    tickers.forEach(t => {
      // the track holds the sequence twice; loop on the exact offset of the
      // second copy, not scrollWidth/2, which lands half a gap short
      const kids = t.track.children;
      const half = Math.floor(kids.length / 2);
      t.w = (kids[half] && kids[0])
        ? kids[half].offsetLeft - kids[0].offsetLeft
        : (t.track.scrollWidth / 2 || 1);
      if (!t.w) t.w = 1;
    });
  }

  /* ══ PARALLAX ═════════════════════════════════════════════ */
  const parallax = $$('[data-parallax]').map(el => ({
    el, amt: parseFloat(el.dataset.parallax) || 0.1, y: 0, centre: 0, skip: false
  }));

  /* ══ MASTER LOOP ══════════════════════════════════════════ */
  let lastScroll = scrollY;
  let velocity = 0;
  let lastFrame = performance.now();
  let chromeHidden = false;
  let pastHero = false;

  /* layout reads are expensive mid-frame — cache them and refresh on demand */
  const metrics = { docH: 1, heroH: innerHeight };
  function measure() {
    metrics.docH = Math.max(1, doc.documentElement.scrollHeight - innerHeight);
    metrics.heroH = heroEl ? heroEl.offsetHeight : innerHeight;
  }
  measure();
  let sinceMeasure = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(now - lastFrame, 50);
    lastFrame = now;
    const k = 1 - Math.pow(0.0015, dt / 1000);

    /* ── READ PHASE ──────────────────────────────────────────
       Every layout read happens before the first style write. Interleaving
       them forces a synchronous reflow on every single frame, which is what
       makes a scroll-triggered animation stutter. */
    const y = scrollY;
    const vh = innerHeight;

    sinceMeasure += dt;
    if (sinceMeasure > 500) { sinceMeasure = 0; measure(); }

    for (let i = 0; i < parallax.length; i++) {
      const p = parallax[i];
      const r = p.el.getBoundingClientRect();
      p.skip = r.bottom < -200 || r.top > vh + 200;
      if (!p.skip) p.centre = r.top + r.height / 2 - vh / 2;
    }

    /* ── COMPUTE ─────────────────────────────────────────── */
    const dy = y - lastScroll;
    lastScroll = y;
    velocity = lerp(velocity, dy, 0.12);

    if (cursor && cursorDot) {
      cursorState.x = lerp(cursorState.x, cursorState.tx, clamp(k * 1.6, 0, 1));
      cursorState.y = lerp(cursorState.y, cursorState.ty, clamp(k * 1.6, 0, 1));
    }
    for (let i = 0; i < magnets.length; i++) {
      const m = magnets[i];
      m.x = lerp(m.x, m.tx, clamp(k * 0.9, 0, 1));
      m.y = lerp(m.y, m.ty, clamp(k * 0.9, 0, 1));
    }
    if (peek) {
      if (peekState.on) {
        peekState.x = lerp(peekState.x, cursorState.tx, clamp(k * 0.55, 0, 1));
        peekState.y = lerp(peekState.y, cursorState.ty, clamp(k * 0.55, 0, 1));
      } else {
        peekState.x = cursorState.tx;
        peekState.y = cursorState.ty;
      }
    }
    if (!reduced) {
      const boost = clamp(Math.abs(velocity) * 0.06, 0, 3.2);
      for (let i = 0; i < tickers.length; i++) {
        const t = tickers[i];
        if (!t.w) continue;
        t.x -= (0.028 * dt * (1 + boost)) * t.dir;
        if (t.x <= -t.w) t.x += t.w;
        if (t.x >= 0) t.x -= t.w;
      }
    }
    for (let i = 0; i < parallax.length; i++) {
      const p = parallax[i];
      if (p.skip) continue;
      p.y = lerp(p.y, -p.centre * p.amt, clamp(k * 0.6, 0, 1));
    }

    /* ── WRITE PHASE ─────────────────────────────────────── */
    if (progressBar) progressBar.style.transform = 'scaleX(' + clamp(y / metrics.docH, 0, 1).toFixed(4) + ')';

    if (chrome && !menuOpen) {
      const shouldHide = dy > 2 && y > 260;
      const shouldShow = dy < -2 || y < 160;
      if (shouldHide && !chromeHidden) { chrome.classList.add('is-hidden'); chromeHidden = true; }
      else if (shouldShow && chromeHidden) { chrome.classList.remove('is-hidden'); chromeHidden = false; }
    }

    const isPast = y > metrics.heroH * 0.55;
    if (isPast !== pastHero) {
      pastHero = isPast;
      body.classList.toggle('is-past-hero', pastHero);
    }

    if (scene) scene.setScroll(clamp(y / metrics.heroH, 0, 1.2));

    if (cursor && cursorDot) {
      cursorDot.style.transform = `translate3d(${cursorState.tx}px, ${cursorState.ty}px, 0)`;
      cursorRing.style.transform = `translate3d(${cursorState.x}px, ${cursorState.y}px, 0)`;
    }

    for (let i = 0; i < magnets.length; i++) {
      const m = magnets[i];
      if (Math.abs(m.x) > 0.05 || Math.abs(m.y) > 0.05 || m.active) {
        m.el.style.transform = `translate3d(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px, 0)`;
      }
    }

    if (peek && peekState.on) {
      const tilt = clamp((peekState.x - cursorState.tx) * 0.12, -8, 8);
      peek.style.transform = `translate3d(${peekState.x}px, ${peekState.y}px, 0) translate(-50%, -50%) rotate(${tilt}deg)`;
    }

    if (!reduced) {
      for (let i = 0; i < tickers.length; i++) {
        const t = tickers[i];
        if (!t.w) continue;
        t.track.style.transform = `translate3d(${t.x.toFixed(2)}px, 0, 0)`;
      }
    }

    for (let i = 0; i < parallax.length; i++) {
      const p = parallax[i];
      if (p.skip) continue;
      p.el.style.transform = `translate3d(0, ${p.y.toFixed(2)}px, 0)`;
    }
  }

  /* ══ PRELOADER ════════════════════════════════════════════ */
  const preloader = $('#preloader');
  const plBar = $('#preloaderBar');
  const plCount = $('#preloaderCount');

  function preload() {
    // lazy images never resolve before they scroll into view — don't wait on them
    const imgs = $$('img').filter(i => i.getAttribute('src') && i.loading !== 'lazy');
    const total = imgs.length + 1;
    let done = 0;
    let displayed = 0;
    const started = performance.now();
    const MIN = reduced ? 350 : 1650;

    function bump() { done++; }

    imgs.forEach(img => {
      if (img.complete && img.naturalWidth) { bump(); return; }
      img.addEventListener('load', bump, { once: true });
      img.addEventListener('error', bump, { once: true });
    });

    (doc.fonts ? doc.fonts.ready : Promise.resolve()).then(bump, bump);
    setTimeout(() => { done = total; }, 3500);   // hard cap

    function step(now) {
      const elapsed = now - started;
      const real = done / total;
      const timed = clamp(elapsed / MIN, 0, 1);
      const target = Math.min(real, timed) * 100;
      displayed = lerp(displayed, target, 0.09);
      if (target - displayed < 0.4) displayed = target;

      const shown = Math.floor(displayed);
      if (plCount) plCount.textContent = String(shown).padStart(3, '0');
      if (plBar) plBar.style.width = displayed.toFixed(2) + '%';

      if (shown >= 100 && elapsed >= MIN) { finish(); return; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    if (plCount) plCount.textContent = '100';
    if (plBar) plBar.style.width = '100%';

    initScene();
    measureTickers();
    measure();
    sweep();

    setTimeout(() => {
      if (preloader) preloader.classList.add('is-done');
      body.classList.remove('is-loading');
      const reveal = () => body.classList.add('is-revealed');
      requestAnimationFrame(reveal);
      setTimeout(reveal, 500);          // rAF is throttled in background tabs
      if (rail) rail.classList.add('is-ready');
      sweep();
      setTimeout(() => { if (preloader) preloader.classList.add('is-removed'); }, 1400);
    }, 280);
  }

  /* ══ BOOT ═════════════════════════════════════════════════ */
  addEventListener('resize', () => { measureTickers(); measure(); }, { passive: true });
  addEventListener('load', () => { measureTickers(); measure(); });

  requestAnimationFrame(loop);
  preload();

  /* graceful escape hatch: never leave the site stuck behind the loader */
  setTimeout(finish, 9000);
})();
