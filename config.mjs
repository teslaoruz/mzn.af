// mzn.af — the facts only you know. Fill these in, run `node build.mjs`, deploy `site/`.
//
// An empty field shows its PLACEHOLDER on the page and links to the contact section, so the
// layout is final before the numbers exist. The build lists every field still empty.
export default {
  site: 'https://mzn.af',
  base: '/mizan',   // the site lives at mzn.af/mizan/; the bare domain redirects there. '' = serve at the root.

  contact: {
    whatsapp: '93777804846',   // international digits only, e.g. '93700123456' (used for wa.me links)
    phone: '+93 777 804 846',      // as it should be shown and dialled, e.g. '+93 700 123 456'
    email: 'sales@mzn.af',      // e.g. 'info@mzn.af'
  },

  // Full profile URLs. Empty ones still show their icon, marked "soon".
  social: {
    facebook: 'https://www.facebook.com/Mzn.af',
    instagram: 'https://www.instagram.com/mzn_af/',
    tiktok: '',
    youtube: 'https://www.youtube.com/@mzn_af',
    telegram: 'https://t.me/mzn_af',
  },

  // What the page shows while a field above is empty.
  placeholder: {
    whatsapp: '+93 7XX XXX XXX',
    phone: '+93 7XX XXX XXX',
    email: 'info@mzn.af',
  },
};
