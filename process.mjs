// ReviewIntel v3 — Processor
// Builds provider-summary.json per provider and a combined providers-all.json
// Run AFTER validate.mjs shows no errors.
//
// Usage: node process.mjs
// Optional: node process.mjs --scrape-date 2026-04-22
// (If no scrape-date provided, today's date is used as the anchor)

import fs from 'fs';
import nodeProcess from 'node:process';

// ── Config ────────────────────────────────────────────────────────────────────

// Providers excluded from processing — Tampa until verified listing is found
const EXCLUDED_SLUGS = new Set(['inkout-tampa-fl']);

// Parse --scrape-date argument if provided
const args = nodeProcess.argv.slice(2);
const dateArg = args.find(a => a.startsWith('--scrape-date'));
const SCRAPE_DATE = dateArg ? dateArg.split('=')[1] : new Date().toISOString().split('T')[0];

// ── Relative date resolver ────────────────────────────────────────────────────
// Converts "2 months ago", "a year ago" etc. into approximate ISO date strings
// anchored to the scrape date. Not precise — produces a best-estimate range.
function resolveRelativeDate(relStr, anchorDateStr) {
  if (!relStr) return null;
  const anchor = new Date(anchorDateStr);
  const s = relStr.toLowerCase().replace('edited', '').trim();

  const match = (pattern) => s.match(pattern);
  let m;

  if (s.includes('just now') || s.includes('today')) return anchorDateStr;

  if ((m = match(/(\d+)\s+day/)))     { anchor.setDate(anchor.getDate() - parseInt(m[1])); }
  else if (s.includes('a day') || s.includes('1 day')) { anchor.setDate(anchor.getDate() - 1); }
  else if ((m = match(/(\d+)\s+week/))) { anchor.setDate(anchor.getDate() - parseInt(m[1]) * 7); }
  else if (s.includes('a week'))      { anchor.setDate(anchor.getDate() - 7); }
  else if ((m = match(/(\d+)\s+month/))) { anchor.setMonth(anchor.getMonth() - parseInt(m[1])); }
  else if (s.includes('a month'))     { anchor.setMonth(anchor.getMonth() - 1); }
  else if ((m = match(/(\d+)\s+year/))) { anchor.setFullYear(anchor.getFullYear() - parseInt(m[1])); }
  else if (s.includes('a year'))      { anchor.setFullYear(anchor.getFullYear() - 1); }
  else return null; // unrecognized format

  return anchor.toISOString().split('T')[0];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadJSON(filepath) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf8')); }
  catch { return null; }
}

function getProviderFiles() {
  return fs.readdirSync('.')
    .filter(f => f.startsWith('reviews-v3-') && f.endsWith('.json') && !f.includes('.prev.') && !f.includes('.pretatt2away.') && !f.includes('.bak.') && f !== 'reviews-v3-all.json')
    .sort();
}

function slugFromFile(f) {
  return f.replace('reviews-v3-', '').replace('.json', '');
}

function weightedAvgRating(locationBreakdown) {
  const total = locationBreakdown.reduce((sum, l) => sum + l.review_count, 0);
  if (!total) return null;
  const weighted = locationBreakdown.reduce((sum, l) => sum + (l.avg_rating * l.review_count), 0);
  return parseFloat((weighted / total).toFixed(2));
}

// ── Per-provider summary builder ──────────────────────────────────────────────
function buildProviderSummary(providerName, locations) {
  const allReviews = locations.flatMap(l => l.reviews);
  const totalCount = allReviews.length;
  const textReviews = allReviews.filter(r => r.review_text && r.review_text.trim() !== '');
  const emptyReviews = allReviews.filter(r => !r.review_text || r.review_text.trim() === '');

  const locationBreakdown = locations.map(loc => {
    const rated = loc.reviews.filter(r => typeof r.star_rating === 'number');
    const avg = rated.length
      ? parseFloat((rated.reduce((s, r) => s + r.star_rating, 0) / rated.length).toFixed(2))
      : null;
    return {
      city:          loc.city,
      state:         loc.state,
      slug:          loc.slug,
      review_count:  loc.reviews.length,
      avg_rating:    avg,
      place_title:   loc.reviews[0]?._place_title || null,
    };
  });

  const aggregateRating = weightedAvgRating(locationBreakdown);
  const ratingRange = {
    min: Math.min(...locationBreakdown.map(l => l.avg_rating).filter(Boolean)),
    max: Math.max(...locationBreakdown.map(l => l.avg_rating).filter(Boolean)),
  };

  // Resolve relative dates anchored to scrape date
  const resolvedReviews = allReviews.map(r => ({
    ...r,
    review_date_resolved: resolveRelativeDate(r.review_date, SCRAPE_DATE),
  }));

  return {
    provider_name:      providerName,
    scrape_date:        SCRAPE_DATE,
    processed_at:       new Date().toISOString(),
    aggregate_rating:   aggregateRating,
    rating_range:       ratingRange,
    total_review_count: totalCount,
    text_review_count:  textReviews.length,
    empty_review_count: emptyReviews.length,
    empty_rate_pct:     parseFloat(((emptyReviews.length / totalCount) * 100).toFixed(1)),
    location_count:     locations.length,
    location_breakdown: locationBreakdown,
    reviews:            resolvedReviews,
  };
}

// ── Group files by providerName ───────────────────────────────────────────────
function groupByProvider(files) {
  const map = {};
  for (const file of files) {
    const slug = slugFromFile(file);
    if (EXCLUDED_SLUGS.has(slug)) continue;
    const reviews = loadJSON(file);
    if (!reviews || !reviews.length) continue;
    const { provider_name, location_city, location_state } = reviews[0];
    if (!map[provider_name]) map[provider_name] = [];
    map[provider_name].push({ slug, city: location_city, state: location_state, reviews });
  }
  return map;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function process() {
  console.log(`\nReviewIntel v3 — Processor`);
  console.log(`Scrape date anchor: ${SCRAPE_DATE}\n`);

  const files = getProviderFiles();
  if (!files.length) { console.error('No review files found.'); nodeProcess.exit(1); }

  const grouped = groupByProvider(files);
  const providerNames = Object.keys(grouped).sort();
  const allSummaries = [];

  console.log(`Processing ${providerNames.length} providers...\n`);

  for (const providerName of providerNames) {
    const locations = grouped[providerName];
    const summary = buildProviderSummary(providerName, locations);
    allSummaries.push(summary);

    const outputFile = `provider-summary-${providerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));

    console.log(`  ✓ ${providerName}`);
    console.log(`    Locations: ${summary.location_count} | Reviews: ${summary.total_review_count} | Aggregate rating: ${summary.aggregate_rating}`);
    console.log(`    Rating range: ${summary.rating_range.min} – ${summary.rating_range.max}`);
    console.log(`    Text reviews: ${summary.text_review_count} | Empty: ${summary.empty_review_count} (${summary.empty_rate_pct}%)`);
    summary.location_breakdown.forEach(l => {
      console.log(`      ${l.city}, ${l.state}: ${l.review_count} reviews, ${l.avg_rating} avg`);
    });
    console.log(`    Saved → ${outputFile}\n`);
  }

  fs.writeFileSync('providers-all.json', JSON.stringify(allSummaries, null, 2));

  console.log('══════════════════════════════════════════');
  console.log('PROCESSING SUMMARY');
  console.log('══════════════════════════════════════════');
  console.log(`  Providers processed: ${allSummaries.length}`);
  console.log(`  Excluded slugs: ${[...EXCLUDED_SLUGS].join(', ')}`);
  console.log(`  Scrape date anchor: ${SCRAPE_DATE}`);
  console.log(`  Combined output: providers-all.json`);
  console.log('──────────────────────────────────────────');
  console.log('  Run extract-signals.mjs next\n');
}

process();
