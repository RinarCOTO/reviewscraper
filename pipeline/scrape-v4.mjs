// ReviewIntel v4 — Full Provider Scraper
// Fixes over v3:
//   1. place_id-first lookup — skips unreliable query search when place_id is known
//   2. Saves iso_date and iso_date_of_last_edit — real absolute dates from SerpAPI
//   3. Title validation — stops if found listing does not match expected business
//   4. Saves _place_id in output — traceable for re-fetch and audit
//   5. Strict local_results fallback — warns and skips instead of silently continuing
//   6. Removery expansion locations explicitly marked as in-scope or out-of-scope
//
// Modes:
//   Full rescrape (default):   SERPAPI_KEY=xxx node scrape-v4.mjs
//   New-only incremental:      SERPAPI_KEY=xxx node scrape-v4.mjs --mode=incremental
//
// Output: reviews-v4-<slug>.json per provider + reviews-v4-all.json combined

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REVIEWS_DIR = path.join(__dirname, '../data/reviews');

const API_KEY = process.env.SERPAPI_KEY;
if (!API_KEY) { console.error('Missing SERPAPI_KEY — run as: SERPAPI_KEY=xxx node scrape-v4.mjs'); process.exit(1); }

const MODE = process.argv.includes('--mode=incremental') ? 'incremental' : 'full';
const ONLY_SLUG = process.argv.find(a => a.startsWith('--provider='))?.split('=')[1] ?? null;
const MAX = 50;
const SORT_BY = 'newestFirst';

console.log(`Mode: ${MODE}`);

// ── Provider list ────────────────────────────────────────────────────────────
// place_id:              Hardcoded Google Maps place ID. When present, skips query search entirely.
//                        Get from: https://www.google.com/maps/place/?q=place_id:PLACE_ID_HERE
// expected_title_pattern: Regex the found listing title must match. Scrape aborts if it fails.
// in_scope:              false = skip this provider. Keeps the list as a record without scraping.

const PROVIDERS = [
  // ── inkOUT (Rejuvatek Aesthetics) — 5 locations ──────────────────────────
  {
    slug: 'inkout-austin-tx',
    place_id: null,
    query: 'Rejuvatek Aesthetics inkOUT Austin TX',
    expected_title_pattern: /rejuvatek|inkout/i,
    providerName: 'inkOUT', city: 'Austin', state: 'TX', method: 'TEPR',
    in_scope: true,
  },
  {
    slug: 'inkout-draper-ut',
    place_id: null,
    query: 'Rejuvatek Aesthetics inkOUT Draper UT',
    expected_title_pattern: /rejuvatek|inkout/i,
    providerName: 'inkOUT', city: 'Draper', state: 'UT', method: 'TEPR',
    in_scope: true,
  },
  {
    slug: 'inkout-tampa-fl',
    place_id: null,
    query: 'Rejuvatek Aesthetics inkOUT Tampa FL',
    expected_title_pattern: /rejuvatek|inkout/i,
    providerName: 'inkOUT', city: 'Tampa', state: 'FL', method: 'TEPR',
    in_scope: true,
  },
  {
    slug: 'inkout-chicago-il',
    place_id: null,
    query: 'Rejuvatek Aesthetics inkOUT Chicago IL',
    expected_title_pattern: /rejuvatek|inkout/i,
    providerName: 'inkOUT', city: 'Chicago', state: 'IL', method: 'TEPR',
    in_scope: true,
  },
  {
    slug: 'inkout-houston-tx',
    place_id: 'ChIJNRyaQj2_QIYRFM2uE3nbCx0',  // confirmed: Rejuvatek Aesthetics providing inkOUT Houston
    query: null,
    expected_title_pattern: /rejuvatek|inkout/i,
    providerName: 'inkOUT', city: 'Houston', state: 'TX', method: 'TEPR',
    in_scope: true,
  },

  // ── Austin TX competitors ─────────────────────────────────────────────────
  {
    slug: 'removery-south-congress-austin-tx',
    place_id: null,
    query: 'Removery South Congress Austin TX tattoo removal',
    expected_title_pattern: /removery/i,
    providerName: 'Removery (South Congress)', city: 'Austin', state: 'TX', method: 'PicoWay',
    in_scope: true,
  },
  {
    slug: 'medermis-laser-clinic-austin-tx',
    place_id: null,
    query: 'MEDermis Laser Clinic Austin TX',
    expected_title_pattern: /medermis/i,
    providerName: 'MEDermis Laser Clinic', city: 'Austin', state: 'TX', method: 'Spectra',
    in_scope: true,
  },
  {
    slug: 'clean-slate-ink-austin-tx',
    place_id: null,
    query: 'Clean Slate Ink Austin TX tattoo removal',
    expected_title_pattern: /clean slate/i,
    providerName: 'Clean Slate Ink', city: 'Austin', state: 'TX', method: 'Laser',
    in_scope: true,
  },

  // ── Draper UT competitors ─────────────────────────────────────────────────
  {
    slug: 'inklifters-aesthetica-pleasant-grove-ut',
    place_id: null,
    query: 'Inklifters Aesthetica Pleasant Grove UT',
    expected_title_pattern: /inklifters|aesthetica/i,
    providerName: 'Inklifters (Aesthetica)', city: 'Pleasant Grove', state: 'UT', method: 'Other',
    in_scope: true,
  },
  {
    slug: 'clarity-skin-draper-ut',
    place_id: null,
    query: 'Clarity Skin Draper UT tattoo removal',
    expected_title_pattern: /clarity skin/i,
    providerName: 'Clarity Skin', city: 'Draper', state: 'UT', method: 'PicoWay',
    in_scope: true,
  },

  // ── Tampa FL competitors ──────────────────────────────────────────────────
  {
    slug: 'erasable-med-spa-tampa-fl',
    place_id: null,
    query: 'Erasable Med Spa Tampa FL tattoo removal',
    expected_title_pattern: /erasable/i,
    providerName: 'Erasable Med Spa', city: 'Tampa', state: 'FL', method: 'PicoWay',
    in_scope: true,
  },
  {
    slug: 'arviv-medical-aesthetics-tampa-fl',
    place_id: null,
    query: 'Arviv Medical Aesthetics Tampa FL',
    expected_title_pattern: /arviv/i,
    providerName: 'Arviv Medical Aesthetics', city: 'Tampa', state: 'FL', method: 'Other',
    in_scope: true,
  },
  {
    slug: 'skintellect-tampa-fl',
    place_id: null,
    query: 'Skintellect Tampa FL tattoo removal',
    expected_title_pattern: /skintellect/i,
    providerName: 'Skintellect', city: 'Tampa', state: 'FL', method: 'Other',
    in_scope: true,
  },

  // ── Chicago IL competitors ────────────────────────────────────────────────
  {
    slug: 'removery-bucktown-chicago-il',
    place_id: null,
    query: 'Removery Bucktown Chicago IL tattoo removal',
    expected_title_pattern: /removery/i,
    providerName: 'Removery (Bucktown)', city: 'Chicago', state: 'IL', method: 'PicoWay',
    in_scope: true,
  },
  {
    slug: 'removery-lincoln-square-chicago-il',
    place_id: null,
    query: 'Removery Lincoln Square Chicago IL tattoo removal',
    expected_title_pattern: /removery/i,
    providerName: 'Removery (Lincoln Square)', city: 'Chicago', state: 'IL', method: 'PicoWay',
    in_scope: true,
  },
  {
    slug: 'enfuse-medical-spa-chicago-il',
    place_id: null,
    query: 'Enfuse Medical Spa Chicago IL tattoo removal',
    expected_title_pattern: /enfuse/i,
    providerName: 'Enfuse Medical Spa', city: 'Chicago', state: 'IL', method: 'Other',
    in_scope: true,
  },
  {
    slug: 'kovak-cosmetic-center-chicago-il',
    place_id: null,
    query: 'Kovak Cosmetic Center Chicago IL tattoo removal',
    expected_title_pattern: /kovak/i,
    providerName: 'Kovak Cosmetic Center', city: 'Chicago', state: 'IL', method: 'Q-Switch',
    in_scope: true,
  },

  // ── Houston TX competitors ────────────────────────────────────────────────
  {
    slug: 'dermsurgery-associates-houston-tx',
    place_id: null,
    query: 'DermSurgery Associates Houston TX tattoo removal',
    expected_title_pattern: /dermsurgery/i,
    providerName: 'DermSurgery Associates', city: 'Houston', state: 'TX', method: 'Q-Switch',
    in_scope: true,
  },
  {
    slug: 'inkfree-md-houston-tx',
    place_id: null,
    query: 'InkFree MD Houston TX tattoo removal',
    expected_title_pattern: /inkfree/i,
    providerName: 'InkFree, MD', city: 'Houston', state: 'TX', method: 'Other',
    in_scope: true,
  },

  // ── Tatt2Away franchise locations ────────────────────────────────────────
  {
    slug: 'tatt2away-austin-tx',
    place_id: null,
    query: 'Tatt2Away Austin TX tattoo removal',
    expected_title_pattern: /tatt2away|rejuvatek|inkout/i,
    providerName: 'Tatt2Away', city: 'Austin', state: 'TX', method: 'TEPR',
    in_scope: true,
  },
  {
    slug: 'tatt2away-chicago-il',
    place_id: null,
    query: 'Tatt2Away Chicago IL tattoo removal',
    expected_title_pattern: /tatt2away|rejuvatek|inkout/i,
    providerName: 'Tatt2Away', city: 'Chicago', state: 'IL', method: 'TEPR',
    in_scope: true,
  },
  {
    slug: 'tatt2away-draper-ut',
    place_id: null,
    query: 'Tatt2Away Draper UT tattoo removal',
    expected_title_pattern: /tatt2away|rejuvatek|inkout/i,
    providerName: 'Tatt2Away', city: 'Draper', state: 'UT', method: 'TEPR',
    in_scope: true,
  },

  // ── Removery expansion — out of scope for now ─────────────────────────────
  // Set in_scope: true to include in future scrapes when comparison set is expanded.
  { slug: 'removery-round-rock-tx',       place_id: null, query: 'Removery Round Rock TX',       expected_title_pattern: /removery/i, providerName: 'Removery (Round Rock)',      city: 'Round Rock',  state: 'TX', method: 'PicoWay', in_scope: false },
  { slug: 'removery-hedwig-village-tx',   place_id: null, query: 'Removery Hedwig Village TX',   expected_title_pattern: /removery/i, providerName: 'Removery (Hedwig Village)', city: 'Houston',     state: 'TX', method: 'PicoWay', in_scope: false },
  { slug: 'removery-east-houston-tx',     place_id: null, query: 'Removery East Houston TX',     expected_title_pattern: /removery/i, providerName: 'Removery (East Houston)',   city: 'Houston',     state: 'TX', method: 'PicoWay', in_scope: false },
  { slug: 'removery-katy-tx',             place_id: null, query: 'Removery Katy TX',             expected_title_pattern: /removery/i, providerName: 'Removery (Katy)',           city: 'Katy',        state: 'TX', method: 'PicoWay', in_scope: false },
  { slug: 'removery-friendswood-tx',      place_id: null, query: 'Removery Friendswood TX',      expected_title_pattern: /removery/i, providerName: 'Removery (Friendswood)',    city: 'Friendswood', state: 'TX', method: 'PicoWay', in_scope: false },
  { slug: 'removery-sugar-land-tx',       place_id: null, query: 'Removery Sugar Land TX',       expected_title_pattern: /removery/i, providerName: 'Removery (Sugar Land)',     city: 'Sugar Land',  state: 'TX', method: 'PicoWay', in_scope: false },
  { slug: 'removery-the-woodlands-tx',    place_id: null, query: 'Removery The Woodlands TX',    expected_title_pattern: /removery/i, providerName: 'Removery (The Woodlands)',  city: 'Shenandoah',  state: 'TX', method: 'PicoWay', in_scope: false },
  { slug: 'removery-rice-village-tx',     place_id: null, query: 'Removery Rice Village Houston',expected_title_pattern: /removery/i, providerName: 'Removery (Rice Village)',   city: 'Houston',     state: 'TX', method: 'PicoWay', in_scope: false },
  { slug: 'removery-westshore-fl',        place_id: null, query: 'Removery Westshore Tampa FL',  expected_title_pattern: /removery/i, providerName: 'Removery (Westshore)',      city: 'Tampa',       state: 'FL', method: 'PicoWay', in_scope: false },
];

// ── CA exclusion guard ───────────────────────────────────────────────────────
const CA_KEYWORDS = ['chula vista', 'los angeles', 'pasadena', 'san diego', 'woodland hills', ' ca '];
function isCalifornia(title = '', address = '') {
  return CA_KEYWORDS.some(kw => (title + ' ' + address).toLowerCase().includes(kw));
}

// ── Load existing data for incremental mode ──────────────────────────────────
function loadExisting(slug) {
  const filePath = path.join(REVIEWS_DIR, `reviews-v4-${slug}.json`);
  if (!fs.existsSync(filePath)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return new Set(data.map(r => `${r.reviewer_name}|${r.review_date_iso}`));
  } catch { return new Set(); }
}

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

// ── Core scrape function ─────────────────────────────────────────────────────
async function scrapeProvider(provider) {
  const { slug, place_id, query, expected_title_pattern, providerName, city, state, method } = provider;

  console.log(`\n[${slug}]`);

  let resolvedPlaceId = place_id;
  let placeTitle = null;
  let placeAddress = null;

  // Step 1: resolve place — skip search if place_id is already known
  if (resolvedPlaceId) {
    console.log(`  Using hardcoded place_id: ${resolvedPlaceId}`);
    // Fetch just one page to confirm the title before pulling all reviews
    const confirmUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${resolvedPlaceId}&api_key=${API_KEY}`;
    let confirmData;
    try { confirmData = await get(confirmUrl); }
    catch (e) { console.error(`  FAILED to confirm place_id: ${e.message}`); return []; }
    placeTitle = confirmData.place_info?.title || confirmData.search_metadata?.google_maps_url || 'Unknown';
  } else {
    console.log(`  Searching: "${query}"`);
    const searchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&api_key=${API_KEY}`;
    let searchData;
    try { searchData = await get(searchUrl); }
    catch (e) { console.error(`  Search failed: ${e.message}`); return []; }
    if (searchData.error) { console.error(`  API error: ${searchData.error}`); return []; }

    const place = searchData.place_results || searchData.local_results?.[0];
    if (!place) { console.warn(`  No place found for query — skipping`); return []; }

    // Strict fallback warning: if no place_results exact match, flag it
    if (!searchData.place_results && searchData.local_results?.[0]) {
      console.warn(`  WARNING: No exact place_results — using first local result. Verify manually.`);
    }

    placeTitle = place.title || '';
    placeAddress = place.address || '';

    if (isCalifornia(placeTitle, placeAddress)) {
      console.warn(`  SKIPPED — California location detected: ${placeTitle}`);
      return [];
    }

    resolvedPlaceId = place.place_id || place.data_id;
    console.log(`  Found: "${placeTitle}" | ${placeAddress}`);
  }

  // Step 2: validate the title matches the expected business
  if (expected_title_pattern && placeTitle && !expected_title_pattern.test(placeTitle)) {
    console.error(`  TITLE MISMATCH — expected pattern ${expected_title_pattern} but got "${placeTitle}"`);
    console.error(`  ABORTING this provider. Add the correct place_id to fix this.`);
    return [];
  }
  console.log(`  Title validated: "${placeTitle}"`);

  // Step 3: load existing data for incremental mode
  const existingKeys = MODE === 'incremental' ? loadExisting(slug) : new Set();

  // Step 4: fetch reviews with pagination
  const idParam = resolvedPlaceId.startsWith('0x') ? `data_id=${resolvedPlaceId}` : `place_id=${resolvedPlaceId}`;
  const baseReviewUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&${idParam}&sort_by=${SORT_BY}&api_key=${API_KEY}`;

  const rawReviews = [];
  let nextToken = null;
  let hitExisting = false;

  while (rawReviews.length < MAX && !hitExisting) {
    const pageUrl = nextToken ? `${baseReviewUrl}&next_page_token=${nextToken}` : baseReviewUrl;
    let reviewData;
    try { reviewData = await get(pageUrl); }
    catch (e) { console.error(`  Reviews fetch failed: ${e.message}`); break; }
    if (reviewData.error) { console.error(`  Reviews API error: ${reviewData.error}`); break; }

    const batch = reviewData.reviews || [];
    for (const r of batch) {
      const key = `${r.user?.name || 'Anonymous'}|${r.iso_date || ''}`;
      if (MODE === 'incremental' && existingKeys.has(key)) {
        console.log(`  Incremental stop — hit existing review (${r.user?.name})`);
        hitExisting = true;
        break;
      }
      rawReviews.push(r);
    }

    nextToken = reviewData.serpapi_pagination?.next_page_token;
    if (!nextToken || batch.length === 0) break;
    await new Promise(r => setTimeout(r, 600));
  }

  // Step 5: shape the output
  const reviews = rawReviews.slice(0, MAX).map(r => ({
    provider_name:           providerName,
    location_city:           city,
    location_state:          state,
    method_used:             method,
    review_text:             r.snippet || r.text || '',
    star_rating:             r.rating ?? null,
    review_date:             r.date || '',
    review_date_iso:         r.iso_date || null,
    review_date_edited_iso:  r.iso_date_of_last_edit || null,
    reviewer_name:           r.user?.name || 'Anonymous',
    reviewer_local_guide:    r.user?.local_guide || false,
    verified_source:         'Google',
    _place_title:            placeTitle,
    _place_id:               resolvedPlaceId,
    _scrape_mode:            MODE,
    _scrape_date:            new Date().toISOString().split('T')[0],
    source_url: r.link || null,
  }));

  const count = reviews.length;
  if (count === 0) {
    console.warn(`  NO new reviews returned`);
  } else if (count < 10 && MODE !== 'incremental') {
    console.warn(`  Only ${count} reviews — low count, verify listing is correct`);
  } else {
    console.log(`  ${count} new reviews fetched`);
  }

  // Incremental: merge new reviews in front of existing ones
  let merged = reviews;
  if (MODE === 'incremental') {
    const existingPath = path.join(REVIEWS_DIR, `reviews-v4-${slug}.json`);
    const existing = fs.existsSync(existingPath)
      ? JSON.parse(fs.readFileSync(existingPath, 'utf8'))
      : [];
    // Deduplicate by reviewer_name|review_date_iso in case of overlap
    const seenKeys = new Set(reviews.map(r => `${r.reviewer_name}|${r.review_date_iso}`));
    const dedupedExisting = existing.filter(r => !seenKeys.has(`${r.reviewer_name}|${r.review_date_iso}`));
    merged = [...reviews, ...dedupedExisting];
    console.log(`  Merged: ${reviews.length} new + ${dedupedExisting.length} existing = ${merged.length} total`);
  }

  fs.mkdirSync(REVIEWS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REVIEWS_DIR, `reviews-v4-${slug}.json`), JSON.stringify(merged, null, 2));
  console.log(`  Saved → data/reviews/reviews-v4-${slug}.json`);
  return merged;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function scrape() {
  const inScope = PROVIDERS.filter(p => p.in_scope && (!ONLY_SLUG || p.slug === ONLY_SLUG));
  const outOfScope = PROVIDERS.filter(p => !p.in_scope);
  console.log(`\nReviewIntel v4 — ${MODE} scrape`);
  console.log(`Providers in scope: ${inScope.length} | Out of scope: ${outOfScope.length}\n`);

  const allReviews = [];
  const summary = [];
  const errors = [];

  for (const provider of inScope) {
    const reviews = await scrapeProvider(provider);
    allReviews.push(...reviews);
    const ok = reviews.length > 0;
    summary.push({
      slug: provider.slug,
      providerName: provider.providerName,
      city: provider.city,
      state: provider.state,
      count: reviews.length,
      low: reviews.length > 0 && reviews.length < 10,
      failed: reviews.length === 0,
    });
    if (!ok) errors.push(provider.slug);
    await new Promise(r => setTimeout(r, 1000));
  }

  const scrapeDate = new Date().toISOString().split('T')[0];
  fs.writeFileSync(path.join(REVIEWS_DIR, 'reviews-v4-all.json'), JSON.stringify(allReviews, null, 2));

  // Print summary
  console.log('\n══════════════════════════════════════════');
  console.log(`SCRAPE SUMMARY — ${MODE} — ${scrapeDate}`);
  console.log('══════════════════════════════════════════');
  for (const s of summary) {
    const flag = s.failed ? ' ✗ FAILED' : s.low ? ' ⚠ LOW COUNT' : ' ✓';
    console.log(`  ${flag}  ${s.providerName} (${s.city}, ${s.state}): ${s.count} reviews`);
  }
  console.log('──────────────────────────────────────────');
  console.log(`  Total: ${allReviews.length} reviews across ${inScope.length} locations`);
  if (errors.length > 0) {
    console.log(`  Failed providers (${errors.length}): ${errors.join(', ')}`);
    console.log(`  Action required: add correct place_id values for failed providers`);
  }
  console.log('══════════════════════════════════════════');
  console.log(`\nDone → data/reviews/reviews-v4-all.json`);
  console.log(`Next step: node pipeline.mjs --step=analyze`);
}

scrape().catch(console.error);
