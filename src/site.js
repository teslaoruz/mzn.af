// mzn.af — the page's few moving parts. No framework: every section reads fine without this file.
document.documentElement.classList.add('js');   // set here, not in the head: if this file never loads, nothing stays hidden
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rtl = document.documentElement.dir === 'rtl';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ------------------------------------------------------------ header + mobile action bar
  const top = $('[data-top]'), hero = $('[data-hero]'), mbar = $('[data-mbar]');
  if (hero) new IntersectionObserver(([e]) => {
    top.classList.toggle('scrolled', !e.isIntersecting);
    mbar?.classList.toggle('show', !e.isIntersecting);
  }, { rootMargin: '-72px 0px 0px 0px' }).observe(hero);

  const menuBtn = $('[data-menu]'), nav = $('#nav');
  const setMenu = open => { menuBtn.setAttribute('aria-expanded', open); nav.classList.toggle('open', open); top.classList.toggle('open', open); };
  menuBtn?.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  nav?.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && nav?.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });

  // The running head: the header names the section in view, and the menu marks its link.
  const guide = $('[data-guide]'), navLinks = $$('.nav a[href^="#"]');
  if (guide) {
    const here = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      guide.textContent = e.target.dataset.name || guide.dataset.default;
      navLinks.forEach(a => a.classList.toggle('on', a.hash === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section').forEach(s => here.observe(s));
  }

  // ------------------------------------------------------------ one-shot reveals
  const once = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); once.unobserve(e.target); }
  }), { threshold: .25 });
  $$('[data-reveal]').forEach(el => once.observe(el));

  // ------------------------------------------------------------ the two notes
  // Each note keeps one currency's balance. A post moves one note only, and its digits roll in
  // fixed places. The figure in the HTML is the starting balance, so the page reads the same
  // without this file.
  const notes = $('[data-notes]');
  if (notes) {
    const posts = JSON.parse(notes.dataset.posts), lbl = JSON.parse(notes.dataset.lbl), N = {};
    $$('[data-note]', notes).forEach(el => {
      const fig = $('[data-fig]', el), sym = fig.textContent.replace(/[\d,]/g, '');
      const sr = document.createElement('span'), box = document.createElement('span');
      sr.className = 'sr'; box.setAttribute('aria-hidden', 'true');
      let v = +el.dataset.v;
      const set = n => {
        const chars = [...(n.toLocaleString('en-US') + sym)];
        sr.textContent = chars.join('');
        if (box.children.length !== chars.length) box.replaceChildren(...chars.map(c => {
          const o = document.createElement('span'), b = document.createElement('b');
          o.className = 'od';
          b.textContent = /\d/.test(c) ? '0\n1\n2\n3\n4\n5\n6\n7\n8\n9' : c.replace(' ', ' ');
          o.append(b);
          return o;
        }));
        chars.forEach((c, i) => /\d/.test(c) && box.children[i].firstChild.style.setProperty('--d', c));
      };
      fig.replaceChildren(sr, box); set(v);
      N[el.dataset.note] = { sym, post: $('[data-post]', el), add: d => set(v += d) };
    });
    if (!reduce) {
      let visible = true;
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(notes);
      (async () => {
        await wait(1800);
        for (const [k, d, why] of posts) {
          while (!visible || document.hidden) await wait(400);
          const n = N[k];
          n.post.firstElementChild.textContent = lbl[why];
          n.post.lastElementChild.textContent = (d > 0 ? '+' : '−') + Math.abs(d).toLocaleString('en-US') + n.sym;
          n.post.classList.add('in'); await wait(450);
          n.add(d); await wait(2300);
          n.post.classList.remove('in'); await wait(500);
        }
      })();
    }
  }

  // ------------------------------------------------------------ areas: tabs
  const tabs = $$('[role=tab]');
  const pick = t => tabs.forEach(x => {
    const on = x === t;
    x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
    document.getElementById(x.getAttribute('aria-controls')).classList.toggle('on', on);
  });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => pick(t));
    t.addEventListener('keydown', e => {
      const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
      if (!step) return;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      pick(next); next.focus(); e.preventDefault();
    });
  });

  // ------------------------------------------------------------ light / dark comparer
  const cmp = $('[data-compare]');
  if (cmp) {
    const range = $('[data-cmp-range]', cmp);
    range.addEventListener('input', () => cmp.style.setProperty('--pos', range.value + '%'));
  }
})();
