// split-reviews.mjs
// Reads reviews-v3-all.json and writes one reviews-v3-[slug].json per provider location.
// Slug mapping is explicit — matches the slugs defined in scrape-v3.mjs.
//
// Usage: node split-reviews.mjs

import fs from 'fs';

// Explicit map: "providerName|city|state" → slug (as used in scrape-v3.mjs)
const SLUG_MAP = {
  'inkout|Austin|TX':                          'inkout-austin-tx',
  'inkout|Chicago|IL':                         'inkout-chicago-il',
  'inkout|Draper|UT':                          'inkout-draper-ut',
  'inkout|Houston|TX':                         'inkout-houston-tx',
  'inkout|Tampa|FL':                           'inkout-tampa-fl',
  'Removery (South Congress)|Austin|TX':       'removery-south-congress-austin-tx',
  'MEDermis Laser Clinic|Austin|TX':           'medermis-austin-tx',
  'Clean Slate Ink|Austin|TX':                 'clean-slate-ink-austin-tx',
  'Inklifters (Aesthetica)|Pleasant Grove|UT': 'inklifters-draper-ut',
  'Clarity Skin|Draper|UT':                    'clarity-skin-draper-ut',
  'Erasable Med Spa|Tampa|FL':                 'erasable-med-spa-tampa-fl',
  'Arviv Medical Aesthetics|Tampa|FL':         'arviv-medical-aesthetics-tampa-fl',
  'Skintellect|Tampa|FL':                      'skintellect-tampa-fl',
  'Removery (Bucktown)|Chicago|IL':            'removery-bucktown-chicago-il',
  'Removery (Lincoln Square)|Chicago|IL':      'removery-lincoln-square-chicago-il',
  'Enfuse Medical Spa|Chicago|IL':             'enfuse-medical-spa-chicago-il',
  'Kovak Cosmetic Center|Chicago|IL':          'kovak-cosmetic-chicago-il',
  'DermSurgery Associates|Houston|TX':         'dermsurgery-associates-houston-tx',
  'InkFree, MD|Houston|TX':                    'inkfree-md-houston-tx',
};

const all = JSON.parse(fs.readFileSync('reviews-v3-all.json', 'utf8'));

// Group reviews by lookup key
const groups = {};
const unmapped = [];

for (const review of all) {
  const key = `${review.provider_name}|${review.location_city}|${review.location_state}`;
  const slug = SLUG_MAP[key];
  if (!slug) {
    unmapped.push(key);
    continue;
  }
  if (!groups[slug]) groups[slug] = [];
  groups[slug].push(review);
}

// Write one file per slug
let written = 0;
for (const [slug, reviews] of Object.entries(groups)) {
  const filename = `reviews-v3-${slug}.json`;
  fs.writeFileSync(filename, JSON.stringify(reviews, null, 2));
  console.log(`  wrote ${filename} (${reviews.length} reviews)`);
  written++;
}

// Report unmapped keys
const uniqueUnmapped = [...new Set(unmapped)];
console.log(`\n  ${written} files written`);
if (uniqueUnmapped.length) {
  console.log(`\n  WARNING: ${unmapped.length} reviews had no slug mapping:`);
  uniqueUnmapped.forEach(k => console.log(`    ${k}`));
} else {
  console.log(`  0 unmapped reviews — all ${all.length} reviews accounted for`);
}
