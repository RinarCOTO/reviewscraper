// ReviewIntel v3 — Full Provider Scraper
// Scrapes all 19 providers across 5 markets (Austin TX, Draper UT, Tampa FL, Chicago IL, Houston TX)
// Excludes all California locations
// Run: SERPAPI_KEY=xxx node scrape-v3.mjs
// Output: reviews-v3-<slug>.json per provider + reviews-v3-all.json combined

import fs from 'fs';

const API_KEY = process.env.SERPAPI_KEY;
if (!API_KEY) { console.error('Missing SERPAPI_KEY env var'); process.exit(1); }

const MAX = 50; // fetch up to 50, minimum 30 required
const SORT_BY = 'newestFirst';

// method_used reflects each provider's known primary technology
const PROVIDERS = [
  // ── inkout (Rejuvatek Aesthetics) — 5 locations ──
  { slug: 'inkout-austin-tx',          query: 'inkout Austin tattoo removal',                  providerName: 'inkout', city: 'Austin',   state: 'TX', method: 'TEPR' },
  { slug: 'inkout-draper-ut',          query: 'inkout Draper tattoo removal',                  providerName: 'inkout', city: 'Draper',   state: 'UT', method: 'TEPR' },
  { slug: 'inkout-tampa-fl',           query: 'inkout Tampa tattoo removal',                   providerName: 'inkout', city: 'Tampa',    state: 'FL', method: 'TEPR' },
  { slug: 'inkout-chicago-il',         query: 'inkout Chicago tattoo removal',                 providerName: 'inkout', city: 'Chicago',  state: 'IL', method: 'TEPR' },
  { slug: 'inkout-houston-tx',         query: 'inkout Houston tattoo removal',                 providerName: 'inkout', city: 'Houston',  state: 'TX', method: 'TEPR' },

  // ── Austin TX competitors ──
  { slug: 'removery-south-congress-austin-tx', query: 'Removery South Congress Austin',       providerName: 'Removery (South Congress)', city: 'Austin', state: 'TX', method: 'PicoWay' },
  { slug: 'medermis-austin-tx',        query: 'MEDermis Laser Clinic Austin',                  providerName: 'MEDermis Laser Clinic',      city: 'Austin', state: 'TX', method: 'Spectra' },
  { slug: 'clean-slate-ink-austin-tx', query: 'Clean Slate Ink Austin tattoo removal',         providerName: 'Clean Slate Ink',            city: 'Austin', state: 'TX', method: 'Q-Switch' },

  // ── Draper UT competitors ──
  { slug: 'inklifters-draper-ut',      query: 'Inklifters Aesthetica Draper',                  providerName: 'Inklifters (Aesthetica)',    city: 'Draper',  state: 'UT', method: 'Other' },
  { slug: 'clarity-skin-draper-ut',    query: 'Clarity Skin Draper tattoo removal',            providerName: 'Clarity Skin',              city: 'Draper',  state: 'UT', method: 'PicoWay' },

  // ── Tampa FL competitors ──
  { slug: 'erasable-med-spa-tampa-fl', query: 'Erasable Med Spa Tampa',                        providerName: 'Erasable Med Spa',          city: 'Tampa',   state: 'FL', method: 'PicoWay' },
  { slug: 'arviv-medical-aesthetics-tampa-fl', query: 'Arviv Medical Aesthetics Tampa',        providerName: 'Arviv Medical Aesthetics',  city: 'Tampa',   state: 'FL', method: 'Other' },
  { slug: 'skintellect-tampa-fl',      query: 'Skintellect Tampa tattoo removal',              providerName: 'Skintellect',               city: 'Tampa',   state: 'FL', method: 'Other' },

  // ── Chicago IL competitors ──
  { slug: 'removery-bucktown-chicago-il',       query: 'Removery Bucktown Chicago',            providerName: 'Removery (Bucktown)',       city: 'Chicago', state: 'IL', method: 'PicoWay' },
  { slug: 'removery-lincoln-square-chicago-il', query: 'Removery Lincoln Square Chicago',      providerName: 'Removery (Lincoln Square)', city: 'Chicago', state: 'IL', method: 'PicoWay' },
  { slug: 'enfuse-medical-spa-chicago-il',      query: 'Enfuse Medical Spa Chicago',           providerName: 'Enfuse Medical Spa',        city: 'Chicago', state: 'IL', method: 'Other' },
  { slug: 'kovak-cosmetic-chicago-il',          query: 'Kovak Cosmetic Center Chicago tattoo', providerName: 'Kovak Cosmetic Center',     city: 'Chicago', state: 'IL', method: 'Q-Switch' },

  // ── Houston TX competitors ──
  { slug: 'dermsurgery-associates-houston-tx',  query: 'DermSurgery Associates Houston',       providerName: 'DermSurgery Associates',    city: 'Houston', state: 'TX', method: 'Q-Switch' },
  { slug: 'inkfree-md-houston-tx',              query: 'InkFree MD Houston tattoo removal',    providerName: 'InkFree, MD',               city: 'Houston', state: 'TX', method: 'PicoWay' },
];

// Safety check — no California locations should ever be scraped
const CA_KEYWORDS = ['chula vista', 'los angeles', 'pasadena', 'san diego', 'woodland hills', ' ca '];
function isCalifornia(title = '', location = '') {
  const combined = (title + ' ' + location).toLowerCase();
  return CA_KEYWORDS.some(kw => combined.includes(kw));
}

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function scrapeProvider(provider) {
  const { slug, query, providerName, city, state, method } = provider;
  const q = encodeURIComponent(query);
  console.log(`\n[${slug}] Searching: "${query}"`);

  // Step 1: find the Google Maps listing
  const searchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${q}&api_key=${API_KEY}`;
  let searchData;
  try { searchData = await get(searchUrl); }
  catch (e) { console.error('  Search failed:', e.message); return []; }
  if (searchData.error) { console.error('  API error:', searchData.error); return []; }

  const place = searchData.place_results || searchData.local_results?.[0];
  if (!place) { console.warn('  No place found'); return []; }

  // CA exclusion guard
  if (isCalifornia(place.title, place.address || '')) {
    console.warn(`  SKIPPED — California location detected: ${place.title}`);
    return [];
  }

  console.log(`  Found: ${place.title} | ${place.address || ''}`);

  // Step 2: fetch reviews
  const idParam = place.place_id ? `place_id=${place.place_id}` : `data_id=${place.data_id}`;
  const baseReviewUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&${idParam}&sort_by=${SORT_BY}&api_key=${API_KEY}`;

  const rawReviews = [];
  let nextToken = null;
  while (rawReviews.length < MAX) {
    const pageUrl = nextToken ? `${baseReviewUrl}&next_page_token=${nextToken}` : baseReviewUrl;
    let reviewData;
    try { reviewData = await get(pageUrl); }
    catch (e) { console.error('  Reviews fetch failed:', e.message); break; }
    if (reviewData.error) { console.error('  Reviews API error:', reviewData.error); break; }
    const batch = reviewData.reviews || [];
    rawReviews.push(...batch);
    nextToken = reviewData.serpapi_pagination?.next_page_token;
    if (!nextToken || batch.length === 0) break;
    await new Promise(r => setTimeout(r, 600));
  }

  const reviews = rawReviews.slice(0, MAX).map(r => ({
    provider_name: providerName,
    location_city: city,
    location_state: state,
    method_used: method,
    review_text: r.snippet || r.text || '',
    star_rating: r.rating ?? null,
    review_date: r.date || '',
    reviewer_name: r.user?.name || 'Anonymous',
    verified_source: 'Google',
    // raw place title for audit
    _place_title: place.title,
  }));

  const count = reviews.length;
  if (count < 30) {
    console.warn(`  ⚠ Only ${count} reviews found (minimum 30 required) — flagged`);
  } else {
    console.log(`  ✓ ${count} reviews fetched`);
  }

  fs.writeFileSync(`reviews-v3-${slug}.json`, JSON.stringify(reviews, null, 2));
  console.log(`  Saved → reviews-v3-${slug}.json`);

  return reviews;
}

async function scrape() {
  console.log(`ReviewIntel v3 — Scraping ${PROVIDERS.length} providers\n`);
  const allReviews = [];
  const summary = [];

  for (const provider of PROVIDERS) {
    const reviews = await scrapeProvider(provider);
    allReviews.push(...reviews);
    summary.push({ slug: provider.slug, providerName: provider.providerName, city: provider.city, state: provider.state, count: reviews.length, flagged: reviews.length < 30 && reviews.length > 0 });
    await new Promise(r => setTimeout(r, 1000));
  }

  fs.writeFileSync('reviews-v3-all.json', JSON.stringify(allReviews, null, 2));

  // Print summary
  console.log('\n══════════════════════════════════════════');
  console.log('SCRAPE SUMMARY');
  console.log('══════════════════════════════════════════');
  let totalFlagged = 0;
  for (const s of summary) {
    const flag = s.flagged ? ' ⚠ FLAGGED (<30)' : '';
    const missing = s.count === 0 ? ' ✗ NO DATA' : '';
    console.log(`  ${s.providerName} (${s.city}, ${s.state}): ${s.count} reviews${flag}${missing}`);
    if (s.flagged || s.count === 0) totalFlagged++;
  }
  console.log('──────────────────────────────────────────');
  console.log(`  Total reviews: ${allReviews.length}`);
  console.log(`  Providers flagged: ${totalFlagged} / ${PROVIDERS.length}`);
  console.log(`  CA exclusion: active`);
  const inkoutCount = summary.filter(s => s.providerName === 'inkout').length;
  console.log(`  inkout locations scraped: ${inkoutCount} / 5`);
  console.log('══════════════════════════════════════════');
  console.log(`\nDone! ${allReviews.length} total reviews → reviews-v3-all.json`);
}

scrape().catch(console.error);
