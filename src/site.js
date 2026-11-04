// mzn.af — the page's few moving parts. No framework: every section reads fine without this file.
document.documentElement.classList.add('js');   // set here, not in the head: if this file never loads, nothing stays hidden
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rtl = document.documentElement.dir === 'rtl';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ------------------------------------------------------------ header + mobile action bar
  const top = $('[data-top]'), hero = $('[data-hero]'), mbar = $('[data-mbar]');
  if (hero) new IntersectionObserver(([e]) => {
    top.classList.toggle('scrolled', !e.isIntersecting);
    mbar?.classList.toggle('show', !e.isIntersecting);
  }, { rootMargin: '-72px 0px 0px 0px' }).observe(hero);

  const menuBtn = $('[data-menu]'), nav = $('#nav');
  const setMenu = open => { menuBtn.setAttribute('aria-expanded', open); nav.classList.toggle('open', open); };
  menuBtn?.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  nav?.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && nav?.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });

  // ------------------------------------------------------------ one-shot reveals
  const once = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); once.unobserve(e.target); }
  }), { threshold: .3 });
  $$('[data-reveal]').forEach(el => once.observe(el));

  // ------------------------------------------------------------ the scale
  // A damped spring pulls the beam toward the tilt the loads ask for, so it swings and settles
  // like a real balance instead of easing to a stop.
  const scale = $('[data-scale]');
  if (scale) {
    const beam = $('[data-beam]', scale), stamp = $('[data-stamp]', scale);
    const pans = { l: $('[data-pan-svg=l]', scale), r: $('[data-pan-svg=r]', scale) };
    const loads = { l: $('[data-load=l]', scale), r: $('[data-load=r]', scale) };
    const tpl = $('[data-tags]', scale).content;
    const weigh = JSON.parse(scale.dataset.weigh);
    const svg = $('.scale-svg', scale);
    const sold = rtl ? 'r' : 'l', paid = rtl ? 'l' : 'r';   // the sale sits on the leading side
    const sign = sold === 'l' ? -1 : 1;                    // + rotates the right end down
    let angle = 0, vel = 0, target = 0, raf = 0, last = 0;

    const place = () => {
      const k = svg.getBoundingClientRect().width / 560, rad = angle * Math.PI / 180;
      beam.setAttribute('transform', `rotate(${angle} 280 120)`);
      for (const side of ['l', 'r']) {
        const dir = side === 'l' ? -1 : 1;
        const dx = dir * 200 * (Math.cos(rad) - 1), dy = dir * 200 * Math.sin(rad);
        pans[side].setAttribute('transform', `translate(${dx} ${dy})`);
        loads[side].style.translate = `${dx * k}px ${dy * k}px`;
      }
    };
    const tick = now => {
      const dt = Math.min(.032, (now - (last || now)) / 1000); last = now;
      vel += (-38 * (angle - target) - 5.5 * vel) * dt;
      angle += vel * dt;
      place();
      if (Math.abs(angle - target) > .02 || Math.abs(vel) > .02) raf = requestAnimationFrame(tick);
      else { angle = target; place(); raf = 0; last = 0; }
    };
    const tilt = deg => { target = deg; if (!raf) raf = requestAnimationFrame(tick); };
    const tag = (kind, value) => {
      const el = tpl.querySelector(`.tag-${kind}`).cloneNode(true);
      el.querySelector('b').textContent = value;
      return el;
    };
    const drop = (side, el) => { loads[side].append(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in'))); };
    const wait = ms => new Promise(r => setTimeout(r, ms));

    if (reduce) {
      drop(sold, tag('sold', weigh[0].sold)); drop(paid, tag('cash', weigh[0].cash)); drop(paid, tag('credit', weigh[0].credit));
      stamp.classList.add('in'); scale.classList.add('level');
    } else {
      let visible = true;
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(scale);
      addEventListener('resize', place);
      (async () => {
        await wait(500);
        for (let i = 0; ; i = (i + 1) % weigh.length) {
          while (!visible || document.hidden) await wait(400);
          const w = weigh[i];
          drop(sold, tag('sold', w.sold));       await wait(380); tilt(sign * 13);  await wait(1300);
          drop(paid, tag('cash', w.cash));       await wait(380); tilt(sign * 5);   await wait(1100);
          drop(paid, tag('credit', w.credit));   await wait(380); tilt(0);          await wait(900);
          stamp.classList.add('in'); scale.classList.add('level'); await wait(2600);
          stamp.classList.remove('in'); scale.classList.remove('level');
          $$('.tag', scale).forEach(t => t.classList.add('out'));
          await wait(450);
          $$('.tag', scale).forEach(t => t.remove());
          await wait(500);
        }
      })();
    }
  }

  // ------------------------------------------------------------ phone: each scan adds a bill line
  // The finished bill is in the HTML; the loop empties it and rebuilds it one read at a time.
  const hs = $('[data-handset]');
  if (hs && !reduce) {
    const scan = $('[data-scan]', hs), bill = $('.hs-bill', hs), lines = $$('[data-lines] li', hs), total = $('[data-total]', hs);
    const prices = lines.map(li => parseFloat(li.querySelector('b').textContent.split('·')[1]));
    const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ؋';
    const wait = ms => new Promise(r => setTimeout(r, ms));
    let visible = false, sum = 0;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: .4 }).observe(hs);
    const count = (from, to) => new Promise(done => {
      const t0 = performance.now();
      const step = now => {
        const p = Math.min(1, (now - t0) / 450), k = 1 - (1 - p) ** 3;
        total.textContent = fmt(from + (to - from) * k);
        p < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
    const clear = () => { lines.forEach(li => { li.hidden = true; li.classList.remove('add'); }); sum = 0; total.textContent = fmt(0); };
    clear();
    (async () => {
      for (;;) {
        while (!visible || document.hidden) await wait(300);
        for (let i = 0; i < lines.length; i++) {
          await wait(900);
          while (!visible || document.hidden) await wait(300);
          scan.classList.add('hit'); await wait(260); scan.classList.remove('hit');
          lines[i].hidden = false; lines[i].classList.add('add');
          await count(sum, sum += prices[i]);
        }
        await wait(3200);
        bill.classList.add('reset'); await wait(320); clear(); bill.classList.remove('reset');
      }
    })();
  }

  // ------------------------------------------------------------ areas: the sticky window follows the list
  const stage = $('[data-stage]');
  const areas = $$('[data-area]');
  if (stage && areas.length) {
    const show = el => {
      areas.forEach(a => a.classList.toggle('on', a === el));
      $$('[data-shot]', stage).forEach(img => img.classList.toggle('on', img.dataset.shot === el.dataset.area));
      stage.style.setProperty('--a', getComputedStyle(el).getPropertyValue('--a'));
    };
    const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && show(e.target)),
      { rootMargin: '-45% 0px -45% 0px' });
    areas.forEach(a => {
      io.observe(a);
      a.addEventListener('mouseenter', () => matchMedia('(min-width: 1061px)').matches && show(a));
    });
    // Warm the other screenshots once the visitor is near, so swapping never shows a blank frame.
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting) return;
      $$('[data-shot]', stage).forEach(img => { img.loading = 'eager'; });
      o.disconnect();
    }, { rootMargin: '600px' }).observe(stage);
  }

  // ------------------------------------------------------------ light / dark comparer
  const cmp = $('[data-compare]');
  if (cmp) {
    const range = $('[data-cmp-range]', cmp);
    const set = v => cmp.style.setProperty('--pos', v + '%');
    range.addEventListener('input', () => set(range.value));
    // A small nudge the first time it comes into view, so the handle reads as movable.
    if (!reduce) new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting) return; o.disconnect();
      const t0 = performance.now();
      const step = now => {
        const p = Math.min(1, (now - t0) / 1400), v = 50 + Math.sin(p * Math.PI * 2) * 14 * (1 - p);
        set(v); if (p < 1) requestAnimationFrame(step); else set(range.value);
      };
      requestAnimationFrame(step);
    }, { threshold: .6 }).observe(cmp);
  }
})();
