#!/usr/bin/env node
// Builds mzn.af into ./site — one static page per language, plus the files hosts and search
// engines read. No dependencies: `node build.mjs`. Add `--og` to re-render the link-preview
// pictures with headless Chrome (needs google-chrome / chromium on PATH).
//
// Why pages per language, not one page that swaps text in JS: WhatsApp, Facebook and Telegram
// read the title, description and picture from the HTML without running scripts, and most
// visitors will arrive through a shared link.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config.mjs';
import copy from './copy.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'site');
const base = (config.base || '').replace(/\/$/, '');   // e.g. '/mizan'
const pub = join(out, base);                          // where the pages and their files go
const langs = ['fa', 'ps', 'en'];
const origin = config.site.replace(/\/$/, '');
const site = origin + base;
const css = readFileSync(join(root, 'src/site.css'), 'utf8');
const ver = Date.now().toString(36);   // cache-buster for site.js

// ------------------------------------------------------------------ helpers
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = s => `<bdi class="money" dir="ltr">${esc(s)}</bdi>`;
const digits = (n, lang) => lang === 'en' ? String(n) : String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

// Area colours from the app's DESIGN.md (1.5.0 paints each part of Mizan in its own): solid and ink.
// Ink carries white text at 4.5:1 or better, so a selected tab can be filled with it.
const AREA = {
  sell: ['#12A150', '#0B6B35'], bills: ['#5B5BD6', '#3C3CA8'], inventory: ['#EE8A12', '#9A5600'],
  finance: ['#7C4DDB', '#5631A8'], reports: ['#E0457B', '#A82657'], dark: ['#1B6B4A', '#12503A'],
};

// Icons: 24px, 2px round strokes, drawn to sit beside the app's own line icons.
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  sell: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 7H6"/>',
  bills: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  inventory: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  finance: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2M17 6V4H5a2 2 0 0 0-2 2"/>',
  reports: '<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  wa: '<path d="m3.5 20.5 1.3-4.2A8.6 8.6 0 1 1 8 19.4z"/><path d="M9.2 8.2c-.4 3.4 3.2 7 6.6 6.6l.9-1.5-2.1-1-1 .8a4.6 4.6 0 0 1-2.7-2.7l.8-1-1-2.1z"/>',
  call: '<path d="M5 4h3.5l2 5-2.3 1.4a11 11 0 0 0 5.4 5.4L15 13.5l5 2V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.6a.6.6 0 0 1 .6-.6z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.8 2.4 4.6 5 5"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  telegram: '<path d="M21 4 3 11l6 2 2 6 3-4 5 4z"/><path d="m9 13 12-9"/>',
  offline: '<path d="m3 3 18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.6-2.6M19 12.6a10 10 0 0 0-2.4-1.7M12 20h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  lang: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  coins: '<circle cx="9" cy="9" r="6"/><path d="M15.5 9.2a6 6 0 1 1-6.3 6.3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6 6 0 0 1 3.5 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  backup: '<path d="M12 3v11M8 10l4 4 4-4M4 16v4h16v-4"/>',
  barcode: '<path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M8 8v8M11 8v8M14 8v8M17 8v8"/>',
  shelf: '<path d="M4 3v18M20 3v18M4 9h16M4 15h16"/>',
  drawer: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 12h18M10 16h4"/>',
  low: '<path d="M4 20V8M10 20v-6M16 20v-3M3 4l18 10"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  pc: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  dark: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  printer: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/>',
};
const icon = (k, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[k]}</svg>`;

// Contact links. An empty config field shows its placeholder and points at the contact section.
const missing = new Set();
function links(t) {
  const c = config.contact, ph = config.placeholder;
  const wa = msg => c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}` : '#contact';
  if (!c.whatsapp) missing.add('contact.whatsapp');
  if (!c.phone) missing.add('contact.phone');
  if (!c.email) missing.add('contact.email');
  return {
    wa, waText: c.whatsapp ? '+' + c.whatsapp.replace(/\D/g, '') : ph.whatsapp,
    tel: c.phone ? `tel:${c.phone.replace(/[^\d+]/g, '')}` : '#contact', telText: c.phone || ph.phone,
    mail: c.email ? `mailto:${c.email}` : '#contact', mailText: c.email || ph.email,
    ph: { wa: !c.whatsapp, tel: !c.phone, mail: !c.email },
  };
}

// The hero's two notes: what one customer owes, kept per currency. A sale or a payment moves one
// note only; the other never changes. Illustrative figures. Each cycle returns to the start, and
// every value keeps its digit count, so the digits roll in fixed places.
const NOTES = { afn: [18600, ' ؋', 'A'], usd: [250, ' $', 'B'] };
const POSTS = [['afn', 2400, 'sold'], ['usd', -100, 'got'], ['afn', -5000, 'got'], ['usd', 350, 'sold'], ['afn', 2600, 'sold'], ['usd', -250, 'got']];

// Guilloche: one closed wave drawn once (#gl), then stamped in rotated copies, the way a
// banknote rosette is engraved. One path keeps every page about 3 KB lighter than drawing each ring.
const GL = 'M' + Array.from({ length: 240 }, (_, i) => {
  const th = 2 * Math.PI * i / 240, r = 150 + 38 * Math.cos(8 * th) + 10 * Math.cos(24 * th);
  return `${(r * Math.cos(th)).toFixed(1)} ${(r * Math.sin(th)).toFixed(1)}`;
}).join('L') + 'Z';
const uses = (n, step, scale = '') => Array.from({ length: n }, (_, i) => `<use href="#gl" style="--i:${i}" transform="${scale}rotate(${(i * step).toFixed(2)})"/>`).join('');
const rosette = cls => `<svg class="ros ${cls}" viewBox="-200 -200 400 400" aria-hidden="true" focusable="false">${uses(12, 3.75)}${uses(8, 5.6, 'scale(.58) ')}</svg>`;
const seal = `<svg class="seal" viewBox="-200 -200 400 400" aria-hidden="true" focusable="false">${uses(3, 15)}${uses(2, 22.5, 'scale(.58) ')}</svg>`;

// ------------------------------------------------------------------ the page
function page(lang) {
  const t = copy[lang], L = links(t);
  const url = site + t.path, name = lang === 'en' ? 'Mizan' : 'میزان';
  const img = (k, alt, eager = false) =>
    `<img src="/img/${lang}-${k}.webp" srcset="/img/${lang}-${k}-760.webp 760w, /img/${lang}-${k}.webp 1400w" sizes="(min-width: 1000px) 760px, (min-width: 760px) 92vw, 680px" width="1400" height="900" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  const waBtn = (msg, label, cls = 'btn btn-go') => `<a class="${cls}" href="${L.wa(msg)}"${L.ph.wa ? '' : ' target="_blank" rel="noopener"'}>${icon('wa')}<span>${esc(label)}</span></a>`;
  const ticks = arr => `<ul class="ticks">${arr.map(x => `<li>${icon('check')}<span>${esc(x)}</span></li>`).join('')}</ul>`;
  const winBar = `<div class="win-bar" aria-hidden="true"><img src="/img/logo.svg" width="16" height="16" alt=""><span>${esc(t.windowTitle)}</span><i class="win-ctl"><b></b><b></b><b></b></i></div>`;
  const alternates = langs.map(l => `<link rel="alternate" hreflang="${l === 'fa' ? 'fa-AF' : l === 'ps' ? 'ps-AF' : 'en'}" href="${site}${copy[l].path}">`).join('\n  ')
    + `\n  <link rel="alternate" hreflang="x-default" href="${site}/">`;
  const langSwitch = cls => `<div class="${cls}" role="group" aria-label="Language / زبان / ژبه">${langs.map(l =>
    `<a href="${copy[l].path}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="page"' : ''}>${copy[l].langName}</a>`).join('')}</div>`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name,
    alternateName: ['Mizan', 'میزان'], url, inLanguage: ['fa-AF', 'ps-AF', 'en'], operatingSystem: 'Windows; web browser (Android, iOS)',
    applicationCategory: 'BusinessApplication', applicationSubCategory: 'Accounting', description: t.description,
    image: `${site}/img/og-${lang}.png`,
  };
  const socials = Object.entries(config.social).map(([k, v]) => {
    if (!v) missing.add(`social.${k}`);
    const n = { tiktok: 'TikTok', youtube: 'YouTube' }[k] || k[0].toUpperCase() + k.slice(1);
    return v ? `<li><a href="${esc(v)}" target="_blank" rel="noopener" aria-label="${n}">${icon(k)}</a></li>` : '';
  }).join('');
  const note = k => { const [v, sym, serial] = NOTES[k]; return `
        <div class="note note-${k}" data-note="${k}" data-v="${v}">
          ${seal}
          <p class="note-name">${esc(t.notes[k])}</p>
          <p class="note-lbl">${esc(t.notes.owed)}</p>
          <p class="note-fig"><bdi class="money" dir="ltr" data-fig>${v.toLocaleString('en-US')}${sym}</bdi></p>
          <p class="note-post" data-post aria-hidden="true"><span></span> <bdi class="money" dir="ltr"></bdi></p>
          <span class="note-serial" dir="ltr" aria-hidden="true">MZN 1405 ${serial}</span>
        </div>`; };
  const [home, ...areas] = t.areas.items;
  const tab = (k, label, i) => `<button type="button" role="tab" id="tab-${k}" aria-controls="p-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" style="--a:${AREA[k][0]};--ai:${AREA[k][1]}">${icon(k)}<span>${esc(label)}</span></button>`;

  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<link rel="canonical" href="${url}">
  ${alternates}
<meta name="theme-color" content="#0B3A2C">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${name}">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${site}/img/og-${lang}.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t.hero.h1)}">
<meta property="og:locale" content="${t.locale}">
${langs.filter(l => l !== lang).map(l => `<meta property="og:locale:alternate" content="${copy[l].locale}">`).join('\n')}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/logo.svg" type="image/svg+xml">
<link rel="icon" href="/img/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/fonts/vazirmatn-bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/vazirmatn-regular.woff2" as="font" type="font/woff2" crossorigin>
<style>${css}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body class="lang-${lang}">
<a class="skip" href="#main">${esc(t.skip)}</a>
<svg width="0" height="0" class="defs" aria-hidden="true" focusable="false"><defs><path id="gl" pathLength="1" d="${GL}"/></defs></svg>

<header class="top" data-top>
  <div class="wrap top-row">
    <a class="brand" href="${t.path}" aria-label="${name}">
      <img src="/img/logo.svg" width="38" height="38" alt=""><span>${name}</span>
    </a>
    <p class="guide" data-guide data-default="${esc(t.hero.what)}" aria-hidden="true">${esc(t.hero.what)}</p>
    <nav class="nav" id="nav" aria-label="${esc(t.menu)}">
      <ul>
        <li><a href="#areas">${esc(t.nav.areas)}</a></li>
        <li><a href="#bill">${esc(t.nav.bill)}</a></li>
        <li><a href="#phone">${esc(t.nav.phone)}</a></li>
        <li><a href="#packages">${esc(t.nav.packages)}</a></li>
        <li><a href="#faq">${esc(t.nav.faq)}</a></li>
        <li><a href="#contact">${esc(t.nav.contact)}</a></li>
      </ul>
      ${langSwitch('langs langs-menu')}
    </nav>
    <div class="top-end">
      ${langSwitch('langs')}
      ${waBtn(t.contact.waMsg, t.navCta, 'btn btn-go btn-sm')}
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav" data-menu>
        ${icon('menu', 'i i-open')}${icon('close', 'i i-close')}<span class="sr">${esc(t.menu)}</span>
      </button>
    </div>
  </div>
</header>

<main id="main">
<section class="hero" data-hero>
  ${rosette('ros-hero')}
  <div class="wrap hero-grid">
    <h1>${esc(t.hero.h1)}</h1>
    <div class="hero-copy">
      <p class="lede">${esc(t.hero.lede)}</p>
      <div class="cta-row">
        ${waBtn(t.contact.waMsg, t.hero.cta, 'btn btn-go btn-lg')}
        <a class="btn btn-line btn-lg" href="${L.tel}">${icon('call')}<span>${esc(t.hero.call)}</span></a>
      </div>
      <ul class="serial">
        ${[['offline', 0], ['calendar', 1], ['lang', 2], ['coins', 3]].map(([k, i]) => `<li>${icon(k)}<span>${esc(t.hero.chips[i])}</span></li>`).join('')}
      </ul>
    </div>
    <div class="notes" data-notes data-posts='${JSON.stringify(POSTS)}' data-lbl='${esc(JSON.stringify({ sold: t.notes.sold, got: t.notes.got }))}'>
      ${note('afn')}${note('usd')}
      <p class="notes-cap"><b>${esc(t.ccy.head)}</b> ${esc(t.ccy.body)}</p>
    </div>
  </div>
</section>

<section class="showcase" aria-label="${esc(t.alt.home)}">
  <div class="wrap">
    <figure class="win win-hero">
      ${winBar}
      ${img('home', t.alt.home, true)}
    </figure>
    <div class="show-cap">
      <p class="show-line"><b>${esc(home.name)}</b> ${esc(home.line)}</p>
      ${ticks(home.points)}
      <p class="shot-note">${esc(t.shot)}</p>
    </div>
  </div>
</section>

<section class="areas" id="areas" data-name="${esc(t.nav.areas)}">
  <div class="wrap">
    <header class="sec-head">
      <h2>${esc(t.areas.title)}</h2>
      <p>${esc(t.areas.sub)}</p>
    </header>
    <div class="tabs" role="tablist" aria-label="${esc(t.areas.title)}">
      ${areas.map((a, i) => tab(a.key, a.name, i)).join('')}${tab('dark', t.dark.title, -1)}
    </div>
    ${areas.map((a, i) => `
    <article class="panel${i === 0 ? ' on' : ''}" id="p-${a.key}" role="tabpanel" style="--a:${AREA[a.key][0]};--ai:${AREA[a.key][1]}" aria-labelledby="tab-${a.key}">
      <div class="panel-copy">
        <h3>${esc(a.name)}</h3>
        <p class="panel-line">${esc(a.line)}</p>
        ${ticks(a.points)}
      </div>
      <figure class="win">
        ${winBar}
        ${img(a.key, t.alt[a.key])}
        <a class="pan-hint" href="/img/${lang}-${a.key}.webp" target="_blank" rel="noopener">${esc(t.pan)}</a>
      </figure>
    </article>`).join('')}
    <article class="panel" id="p-dark" role="tabpanel" style="--a:${AREA.dark[0]};--ai:${AREA.dark[1]}" aria-labelledby="tab-dark">
      <div class="panel-copy">
        <h3>${esc(t.dark.title)}</h3>
        <p class="panel-line">${esc(t.dark.body)}</p>
      </div>
      <div class="compare win" data-compare dir="ltr" style="--pos:50%">
        <img src="/img/fa-finance.webp" srcset="/img/fa-finance-760.webp 760w, /img/fa-finance.webp 1400w" sizes="(min-width: 1000px) 760px, 92vw" width="1400" height="900" alt="${esc(t.alt.light)}" loading="lazy" decoding="async">
        <img class="cmp-dark" src="/img/fa-dark.webp" srcset="/img/fa-dark-760.webp 760w, /img/fa-dark.webp 1400w" sizes="(min-width: 1000px) 760px, 92vw" width="1400" height="900" alt="${esc(t.alt.dark)}" loading="lazy" decoding="async">
        <span class="cmp-line" aria-hidden="true"><span class="cmp-knob"></span></span>
        <span class="cmp-lbl cmp-lbl-l" aria-hidden="true">${esc(t.dark.light)}</span>
        <span class="cmp-lbl cmp-lbl-d" aria-hidden="true">${esc(t.dark.darkL)}</span>
        <input type="range" min="0" max="100" value="50" aria-label="${esc(t.dark.handle)}" data-cmp-range>
      </div>
    </article>
  </div>
</section>

<section class="bill" id="bill" data-name="${esc(t.nav.bill)}">
  <div class="wrap bill-grid">
    <div class="bill-copy">
      <h2>${esc(t.bill.title)}</h2>
      <p>${esc(t.bill.body)}</p>
      ${ticks(t.bill.points)}
      <ul class="sizes" dir="ltr" aria-label="A4, A5, 80 mm">
        <li><span class="sz s-a4"></span>A4</li><li><span class="sz s-a5"></span>A5</li><li><span class="sz s-roll"></span>80 mm</li>
      </ul>
    </div>
    <figure class="sheet plate" data-reveal>
      <p class="bill-serial" dir="ltr" aria-hidden="true"><span>MZN</span><span>S717</span><span>${lang === 'en' ? '2026-11-07' : '1405/08/16'}</span><span>A4</span></p>
      <div class="pan"><img src="/img/${lang}-bill.webp" width="1588" height="1232" alt="${esc(t.alt.bill)}" loading="lazy" decoding="async"></div>
      <a class="pan-hint" href="/img/${lang}-bill.webp" target="_blank" rel="noopener">${esc(t.pan)}</a>
      <figcaption>${esc(t.bill.caption)}</figcaption>
    </figure>
  </div>
</section>

<section class="counters" id="phone" data-name="${esc(t.nav.phone)}">
  <div class="wrap">
    <header class="sec-head"><h2>${esc(t.counters.title)}</h2></header>
    <div class="ctr-grid">
      <article class="ctr">
        <div class="ctr-stage">
          <div class="handset">
            <img class="hs-shot" src="/img/${lang}-webphone.webp" width="520" height="933" alt="${esc(t.alt.webphone)}" loading="lazy" decoding="async">
          </div>
        </div>
        <h3>${esc(t.phone.title)}</h3>
        <p>${esc(t.phone.body)}</p>
        <dl class="pts">
          ${t.phone.points.map(([h, b], i) => `<div>${icon(['barcode', 'shelf', 'drawer', 'low'][i])}<dt>${esc(h)}</dt><dd>${esc(b)}</dd></div>`).join('')}
        </dl>
        <p class="fine">${esc(t.phone.note)}</p>
      </article>
      <article class="ctr">
        <div class="ctr-stage">
          <figure class="win win-web">
            <div class="win-bar" aria-hidden="true">${icon('lock', 'i i-sm')}<span dir="ltr">https://mizan.local</span></div>
            <img src="/img/${lang}-webpc.webp" srcset="/img/${lang}-webpc-760.webp 760w, /img/${lang}-webpc.webp 1400w" sizes="(min-width: 960px) 520px, 92vw" width="1400" height="900" alt="${esc(t.alt.webpc)}" loading="lazy" decoding="async">
            <figcaption class="web-cap">${esc(t.clients.caption)}</figcaption>
          </figure>
        </div>
        <h3>${esc(t.clients.title)}</h3>
        <p>${esc(t.clients.body)}</p>
        <dl class="pts">
          ${t.clients.points.map(([h, b], i) => `<div>${icon(['lock', 'backup'][i])}<dt>${esc(h)}</dt><dd>${esc(b)}</dd></div>`).join('')}
          <div>${icon('users')}<dt>${esc(t.clients.rolesTitle)}</dt><dd>${t.clients.roles.map(([r]) => esc(r)).join(lang === 'en' ? ', ' : '، ')}</dd></div>
        </dl>
      </article>
    </div>
  </div>
</section>

<section class="trust field">
  <div class="wrap">
    <header class="sec-head">
      <h2>${esc(t.trust.title)}</h2>
      <p>${esc(t.trust.sub)}</p>
    </header>
    <div class="trust-grid">
      <ul class="trust-list">
        ${t.trust.items.map(([h, b], i) => `<li>${icon(['eye', 'users', 'lock', 'backup'][i])}<div><h3>${esc(h)}</h3><p>${esc(b)}</p></div></li>`).join('')}
      </ul>
      <div class="never plate" data-reveal>
        <h3>${esc(t.trust.neverTitle)}</h3>
        <ol>${t.trust.never.map(x => `<li>${icon('check')}<span>${esc(x)}</span></li>`).join('')}</ol>
      </div>
    </div>
  </div>
</section>

<section class="pk" id="packages" data-name="${esc(t.nav.packages)}">
  <div class="wrap">
    <header class="sec-head">
      <h2>${esc(t.pk.title)}</h2>
      <p>${esc(t.pk.sub)}</p>
    </header>
    <div class="pk-grid">
      ${t.pk.tiers.map((p, i) => `
      <article class="tier plate tier-${p.key}">
        <div class="seals" aria-hidden="true">${seal.repeat(i + 1)}</div>
        <h3>${esc(p.name)}</h3>
        ${ticks(p.lines)}
        ${waBtn(t.contact.waPk.replace('{pk}', p.name), t.pk.ask, i === 2 ? 'btn btn-go' : 'btn btn-line')}
      </article>`).join('')}
    </div>
    <p class="fine pk-note">${esc(t.pk.phones)}</p>
    <h3 class="steps-h">${esc(t.steps.title)}</h3>
    <ol class="steps">
      ${t.steps.items.map(([h, b], i) => `<li><span class="n" aria-hidden="true">${digits(i + 1, lang)}</span><h4>${esc(h)}</h4><p>${esc(b)}</p></li>`).join('')}
    </ol>
  </div>
</section>

<section class="faq" id="faq" data-name="${esc(t.nav.faq)}">
  <div class="wrap faq-grid">
    <h2>${esc(t.faq.title)}</h2>
    <div class="qa">
      ${t.faq.items.map(([q, a]) => `<details><summary><span>${esc(q)}</span><i aria-hidden="true"></i></summary><p>${esc(a)}</p></details>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="contact field" id="contact" data-name="${esc(t.nav.contact)}">
  ${rosette('ros-contact')}
  <div class="wrap">
    <h2>${esc(t.contact.title)}</h2>
    <p class="contact-sub">${esc(t.contact.body)}</p>
    <ul class="contact-row">
      <li><a class="cbox cbox-wa" href="${L.wa(t.contact.waMsg)}"${L.ph.wa ? '' : ' target="_blank" rel="noopener"'}>${icon('wa')}<span><i>${esc(t.contact.wa)}</i><b dir="ltr">${esc(L.waText)}</b></span></a></li>
      <li><a class="cbox" href="${L.tel}">${icon('call')}<span><i>${esc(t.contact.call)}</i><b dir="ltr">${esc(L.telText)}</b></span></a></li>
      <li><a class="cbox" href="${L.mail}">${icon('mail')}<span><i>${esc(t.contact.email)}</i><b dir="ltr">${esc(L.mailText)}</b></span></a></li>
    </ul>
    <div class="social"><span>${esc(t.contact.social)}</span><ul>${socials}</ul></div>
  </div>
</section>
</main>

<footer class="foot">
  <div class="wrap foot-row">
    <a class="brand" href="${t.path}"><img src="/img/logo.svg" width="30" height="30" alt=""><span>${name}</span></a>
    <p>${esc(t.footer)}</p>
    ${langSwitch('langs')}
    <p class="copy" dir="ltr">© ${new Date().getFullYear()} mzn.af</p>
  </div>
</footer>

<div class="mbar" data-mbar>
  ${waBtn(t.contact.waMsg, t.navCta)}
  <a class="btn btn-line" href="${L.tel}">${icon('call')}<span>${esc(t.hero.call)}</span></a>
</div>
<script src="/site.js?v=${ver}" defer></script>
</body>
</html>
`;
}

// ------------------------------------------------------------------ write
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'static'), pub, { recursive: true });
cpSync(join(root, 'src/site.js'), join(pub, 'site.js'));
// Pictures and fonts are cached for a year (_headers), so every reference carries a hash of the
// file's bytes: tools/shots.sh overwrites the same names, and a changed picture gets a new URL.
const hashes = new Map();
const rebase = s => base ? s.replace(/(="|, |url\()\/(?!\/)/g, `$1${base}/`) : s;
const stamp = html => rebase(html).replace(/\/(img|fonts)\/([\w.-]+\.(?:webp|png|svg|woff2))/g, (m, d, f) => {
  if (!hashes.has(m)) hashes.set(m, createHash('sha256').update(readFileSync(join(root, 'static', d, f))).digest('hex').slice(0, 10));
  return `${m}?v=${hashes.get(m)}`;
});
for (const l of langs) {
  const dir = join(pub, copy[l].path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), stamp(page(l)));
}

// 404: Dari first with the other two beside it, since we cannot know who arrived.
writeFileSync(join(out, '404.html'), stamp(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404 — میزان</title><meta name="robots" content="noindex"><link rel="icon" href="/img/logo.svg"><style>${css}</style></head>
<body class="lang-fa"><main class="lost"><img src="/img/logo.svg" width="72" height="72" alt=""><h1>این صفحه پیدا نشد</h1><p lang="ps">دا پاڼه ونه موندل شوه · <span lang="en" dir="ltr">This page was not found</span></p>
<p class="lost-links"><a class="btn btn-go" href="/">میزان — دری</a><a class="btn btn-line" href="/ps/" lang="ps">پښتو</a><a class="btn btn-line" href="/en/" lang="en">English</a></p></main></body></html>`));

writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(pub, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${langs.map(l => `  <url><loc>${site}${copy[l].path}</loc><lastmod>${today}</lastmod>
${langs.map(m => `    <xhtml:link rel="alternate" hreflang="${m === 'fa' ? 'fa-AF' : m === 'ps' ? 'ps-AF' : 'en'}" href="${site}${copy[m].path}"/>`).join('\n')}
  </url>`).join('\n')}
</urlset>
`);
writeFileSync(join(pub, 'site.webmanifest'), JSON.stringify({
  name: 'میزان — Mizan', short_name: 'میزان', start_url: `${base}/`, display: 'browser', lang: 'fa', dir: 'rtl',
  background_color: '#0B3A2C', theme_color: '#0B3A2C',
  icons: [{ src: `${base}/img/logo.svg`, sizes: 'any', type: 'image/svg+xml' }, { src: `${base}/img/icon-512.png`, sizes: '512x512', type: 'image/png' }],
}, null, 2));
// Read by Cloudflare Pages and Netlify; ignored elsewhere. Pictures and fonts never change in
// place (re-run the build with new names), so they may be cached for a year.
writeFileSync(join(out, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
${base}/img/*
  Cache-Control: public, max-age=31536000, immutable
${base}/fonts/*
  Cache-Control: public, max-age=31536000, immutable
`);
writeFileSync(join(out, 'CNAME'), new URL(site).host + '\n');   // GitHub Pages reads this; harmless elsewhere
writeFileSync(join(out, '.nojekyll'), '');                     // GitHub Pages: publish as is, no Jekyll
// With a base, the bare domain only redirects to it (GitHub Pages has no server-side redirects).
if (base) writeFileSync(join(out, 'index.html'), `<!doctype html><html lang="fa"><head><meta charset="utf-8"><title>میزان — Mizan</title>
<link rel="canonical" href="${site}/"><meta http-equiv="refresh" content="0; url=${base}/"><meta name="robots" content="noindex">
<script>location.replace('${base}/' + location.search + location.hash)</script></head>
<body><a href="${base}/">میزان — Mizan</a></body></html>
`);

// ------------------------------------------------------------------ link-preview pictures
if (process.argv.includes('--og')) {
  const chrome = ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].find(c => {
    try { execFileSync('which', [c], { stdio: 'ignore' }); return true; } catch { return false; }
  });
  if (!chrome) { console.error('--og: no Chrome/Chromium on PATH'); process.exit(1); }
  for (const l of langs) {
    const t = copy[l];
    const html = join(pub, `_og-${l}.html`);
    writeFileSync(html, `<!doctype html><html lang="${t.lang}" dir="${t.dir}"><head><meta charset="utf-8"><style>${css.replaceAll('url(/fonts/', 'url(fonts/')}</style></head>
<body class="lang-${l} og-body"><div class="og"><div class="og-copy"><div class="og-brand"><img src="img/logo.svg" width="64" height="64" alt=""><span>${l === 'en' ? 'Mizan' : 'میزان'}</span></div>
<h1>${esc(t.hero.h1)}</h1><p class="og-chips">${t.hero.chips.slice(0, 3).map(esc).join(' · ')}</p><p class="og-url" dir="ltr">${new URL(site).host}${base}</p></div>
<div class="og-shot"><img src="img/${l}-home.webp" alt=""></div></div></body></html>`);
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--window-size=1200,630',
      `--screenshot=${join(root, 'static/img', `og-${l}.png`)}`, `file://${html}`], { stdio: 'ignore' });
    rmSync(html);
    cpSync(join(root, 'static/img', `og-${l}.png`), join(pub, 'img', `og-${l}.png`));
  }
  console.log('og pictures written to static/img/og-*.png');
}

for (const l of langs) if (!existsSync(join(root, 'static/img', `og-${l}.png`))) console.warn(`missing static/img/og-${l}.png — run: node build.mjs --og`);
console.log(`built ${langs.length} pages into site/`);
if (missing.size) console.warn(`placeholders still showing (fill in config.mjs): ${[...missing].join(', ')}`);
