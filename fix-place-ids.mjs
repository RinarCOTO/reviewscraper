// ReviewIntel v3 — Place ID Fix
// Targeted rescrape for locations where the original query hit the wrong listing.
// Uses hardcoded place_ids instead of query-based search.
// Run AFTER validating the issue, BEFORE running process.mjs
//
// Usage: SERPAPI_KEY=xxx node fix-place-ids.mjs

import fs from 'fs';

const API_KEY = process.env.SERPAPI_KEY;
if (!API_KEY) { console.error('Missing SERPAPI_KEY env var'); process.exit(1); }

const MAX = 50;
const SORT_BY = 'newestFirst';

// ── Hardcoded correct listings ────────────────────────────────────────────────
// Add Tampa here once the correct place_id is confirmed directly from inkOUT.
const FIXES = [
  {
    slug:         'inkout-houston-tx',
    place_id:     'ChIJNRyaQj2_QIYRFM2uE3nbCx0',
    providerName: 'inkout',
    city:         'Houston',
    state:        'TX',
    method:       'TEPR',
    expected_title_pattern: /rejuvatek aesthetics/i,
    note: 'Corrected — original query hit "Houston Tattoo Removal Clinic" instead of Rejuvatek Aesthetics',
  },

  // Tampa placeholder — uncomment and fill in once place_id is confirmed
  // {
  //   slug:         'inkout-tampa-fl',
  //   place_id:     'PASTE_PLACE_ID_HERE',
  //   providerName: 'inkout',
  //   city:         'Tampa',
  //   state:        'FL',
  //   method:       'TEPR',
  //   expected_title_pattern: /rejuvatek aesthetics/i,
  //   note: 'Added after direct confirmation from inkOUT Tampa',
  // },
];

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function fixLocation(fix) {
  const { slug, place_id, providerName, city, state, method, expected_title_pattern, note } = fix;

  console.log(`\n[${slug}] Fetching reviews via hardcoded place_id`);
  console.log(`  Note: ${note}`);

  const baseUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${place_id}&sort_by=${SORT_BY}&api_key=${API_KEY}`;

  const rawReviews = [];
  let nextToken = null;

  while (rawReviews.length < MAX) {
    const pageUrl = nextToken ? `${baseUrl}&next_page_token=${nextToken}` : baseUrl;
    let data;
    try { data = await get(pageUrl); }
    catch (e) { console.error('  Fetch failed:', e.message); break; }
    if (data.error) { console.error('  API error:', data.error); break; }
    const batch = data.reviews || [];
    rawReviews.push(...batch);
    nextToken = data.serpapi_pagination?.next_page_token;
    if (!nextToken || batch.length === 0) break;
    await new Promise(r => setTimeout(r, 600));
  }

  if (!rawReviews.length) {
    console.error(`  ✗ No reviews returned — check place_id is correct`);
    return;
  }

  // Verify place title from first review's context if available
  const placeTitle = rawReviews[0]?._place_title || 'unknown (not in review data)';

  const reviews = rawReviews.slice(0, MAX).map(r => ({
    provider_name:   providerName,
    location_city:   city,
    location_state:  state,
    method_used:     method,
    review_text:     r.snippet || r.text || '',
    star_rating:     r.rating ?? null,
    review_date:     r.date || '',
    reviewer_name:   r.user?.name || 'Anonymous',
    verified_source: 'Google',
    _place_title:    placeTitle,
    _place_id_used:  place_id,
    _fix_note:       note,
  }));

  // Title pattern check
  if (expected_title_pattern && !expected_title_pattern.test(placeTitle)) {
    console.warn(`  ⚠ Place title may still be wrong: "${placeTitle}"`);
    console.warn(`    Expected pattern: /${expected_title_pattern.source}/i`);
    console.warn(`    Manual verification required before promoting this file`);
  } else {
    console.log(`  ✓ Place title confirmed: "${placeTitle}"`);
  }

  const count = reviews.length;
  const outputFile = `reviews-v3-${slug}.json`;

  // Backup the old file before overwriting
  const backupFile = `reviews-v3-${slug}.prev.json`;
  if (fs.existsSync(outputFile)) {
    fs.copyFileSync(outputFile, backupFile);
    console.log(`  Backed up old file → ${backupFile}`);
  }

  fs.writeFileSync(outputFile, JSON.stringify(reviews, null, 2));
  console.log(`  ✓ ${count} reviews saved → ${outputFile}`);

  if (count < 30) {
    console.warn(`  ⚠ Only ${count} reviews (minimum 30 recommended)`);
  }
}

async function run() {
  console.log(`\nReviewIntel v3 — Place ID Fix`);
  console.log(`Fixing ${FIXES.length} location(s) with corrected place_ids\n`);

  for (const fix of FIXES) {
    await fixLocation(fix);
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n══════════════════════════════════════════');
  console.log('Fix complete. Run validate.mjs to confirm before processing.');
  console.log('══════════════════════════════════════════\n');
}

run().catch(console.error);
