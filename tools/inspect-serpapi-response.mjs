#!/usr/bin/env node
/**
 * One-shot SerpAPI inspector — fetches a single page of reviews for one inkOUT
 * location and dumps the full raw review objects to inspect available fields.
 *
 * Usage:
 *   node tools/inspect-serpapi-response.mjs
 *   node tools/inspect-serpapi-response.mjs --provider=inkout-chicago-il
 *
 * Output: /tmp/serpapi-raw-<slug>.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) { console.error('ERROR: .env not found at repo root'); process.exit(1); }
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const API_KEY = process.env.SERPAPI_KEY;
if (!API_KEY || API_KEY === 'your_serpapi_key_here') {
  console.error('ERROR: SERPAPI_KEY not set in .env'); process.exit(1);
}

// inkOUT locations — pick one via --provider= arg
const INKOUT_PROVIDERS = [
  { slug: 'inkout-austin-tx',   query: 'Rejuvatek Aesthetics inkOUT Austin TX' },
  { slug: 'inkout-chicago-il',  query: 'Rejuvatek Aesthetics inkOUT Chicago IL' },
  { slug: 'inkout-draper-ut',   query: 'Rejuvatek Aesthetics inkOUT Draper UT' },
  { slug: 'inkout-houston-tx',  place_id: 'ChIJNRyaQj2_QIYRFM2uE3nbCx0' },
  { slug: 'inkout-tampa-fl',    query: 'Rejuvatek Aesthetics inkOUT Tampa FL' },
];

const targetSlug = process.argv.find(a => a.startsWith('--provider='))?.split('=')[1] ?? 'inkout-austin-tx';
const provider = INKOUT_PROVIDERS.find(p => p.slug === targetSlug) ?? INKOUT_PROVIDERS[0];

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

async function main() {
  console.log(`\nInspecting SerpAPI response for: ${provider.slug}`);

  let placeId = provider.place_id ?? null;

  if (!placeId) {
    console.log(`  Step 1: resolving place_id via search query...`);
    const searchUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(provider.query)}&api_key=${API_KEY}`;
    const searchData = await get(searchUrl);
    const place = searchData.place_results ?? searchData.local_results?.[0];
    if (!place) { console.error('  No place found'); process.exit(1); }
    placeId = place.place_id ?? place.data_id;
    console.log(`  Found place_id: ${placeId}  (title: ${place.title})`);
  } else {
    console.log(`  Using hardcoded place_id: ${placeId}`);
  }

  console.log(`  Step 2: fetching first page of reviews...`);
  const idParam = placeId.startsWith('0x') ? `data_id=${placeId}` : `place_id=${placeId}`;
  const reviewUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&${idParam}&sort_by=newestFirst&api_key=${API_KEY}`;
  const reviewData = await get(reviewUrl);

  const outPath = `/tmp/serpapi-raw-${provider.slug}.json`;
  fs.writeFileSync(outPath, JSON.stringify(reviewData, null, 2));
  console.log(`\n  Full raw response saved → ${outPath}`);

  const reviews = reviewData.reviews ?? [];
  if (!reviews.length) { console.warn('  No reviews in response'); process.exit(0); }

  // Print all top-level keys on the first review object
  const first = reviews[0];
  console.log(`\n  ─── Top-level keys on first review object ───`);
  for (const [k, v] of Object.entries(first)) {
    const preview = typeof v === 'object' ? JSON.stringify(v).slice(0, 120) : String(v).slice(0, 120);
    console.log(`    ${k.padEnd(30)} ${preview}`);
  }

  // Specifically hunt for URL/link fields anywhere in the review
  console.log(`\n  ─── URL/link candidates (deep scan) ───`);
  function findLinks(obj, prefix = '') {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string' && (k.toLowerCase().includes('link') || k.toLowerCase().includes('url') || v.startsWith('http'))) {
        console.log(`    ${fullKey.padEnd(35)} ${v.slice(0, 120)}`);
      } else if (typeof v === 'object' && v !== null) {
        findLinks(v, fullKey);
      }
    }
  }
  findLinks(first);

  console.log(`\n  ─── Sample of first 3 review objects (for context) ───`);
  for (const r of reviews.slice(0, 3)) {
    console.log(`\n  reviewer: ${r.user?.name ?? '?'} | rating: ${r.rating} | date: ${r.iso_date ?? r.date}`);
    console.log(`  keys: ${Object.keys(r).join(', ')}`);
  }

  console.log(`\nInspection complete. Check ${outPath} for full response.`);
}

main().catch(e => { console.error(e); process.exit(1); });
