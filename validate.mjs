// ReviewIntel v3 — Validator
// Run this before any processing or rescrape.
// Checks every provider JSON for: place_title match, review count, star rating integrity, empty text rate.
// Output: validation-report.json + console summary
//
// Usage: node validate.mjs

import fs from 'fs';
import path from 'path';

// ── Known correct place_title patterns per provider slug ──────────────────────
// Add to this list as new providers are verified.
const KNOWN_TITLES = {
  // inkOUT (Rejuvatek Aesthetics) — verified listings
  'inkout-austin-tx':    { pattern: /rejuvatek aesthetics/i,   providerName: 'inkout' },
  'inkout-draper-ut':    { pattern: /rejuvatek aesthetics/i,   providerName: 'inkout' },
  'inkout-chicago-il':   { pattern: /rejuvatek aesthetics/i,   providerName: 'inkout' },
  'inkout-houston-tx':   { pattern: /rejuvatek aesthetics/i,   providerName: 'inkout' },
  // Tampa excluded — no verified listing

  // Competitors — place titles confirmed from scrape, zero duplicate-reviewer overlap checked
  'arviv-medical-aesthetics-tampa-fl':    { pattern: /arviv medical aesthetics/i,       providerName: 'Arviv Medical Aesthetics' },
  'clarity-skin-draper-ut':              { pattern: /clarity skin/i,                   providerName: 'Clarity Skin' },
  'clean-slate-ink-austin-tx':           { pattern: /clean slate ink/i,                providerName: 'Clean Slate Ink' },
  'dermsurgery-associates-houston-tx':   { pattern: /dermsurgery associates/i,         providerName: 'DermSurgery Associates' },
  'enfuse-medical-spa-chicago-il':       { pattern: /enfuse medical spa/i,             providerName: 'Enfuse Medical Spa' },
  'erasable-med-spa-tampa-fl':           { pattern: /erasable med spa/i,               providerName: 'Erasable Med Spa' },
  'inkfree-md-houston-tx':              { pattern: /inkfree/i,                        providerName: 'InkFree, MD' },
  'inklifters-draper-ut':               { pattern: /inklifters/i,                     providerName: 'Inklifters (Aesthetica)' },
  'kovak-cosmetic-chicago-il':          { pattern: /kovak cosmetic/i,                 providerName: 'Kovak Cosmetic Center' },
  'medermis-austin-tx':                 { pattern: /medermis/i,                       providerName: 'MEDermis Laser Clinic' },
  'removery-bucktown-chicago-il':       { pattern: /removery/i,                       providerName: 'Removery (Bucktown)' },
  'removery-lincoln-square-chicago-il': { pattern: /removery/i,                       providerName: 'Removery (Lincoln Square)' },
  'removery-south-congress-austin-tx':  { pattern: /removery/i,                       providerName: 'Removery (South Congress)' },
  'skintellect-tampa-fl':               { pattern: /skintellect/i,                    providerName: 'Skintellect' },
};

// ── Providers excluded from this run with reason ──────────────────────────────
const EXCLUDED = {
  'inkout-tampa-fl': 'No verified Google Business listing found — excluded pending direct confirmation from provider',
};

const MIN_REVIEWS = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return null;
  }
}

function getFiles() {
  return fs.readdirSync('.').filter(f => f.startsWith('reviews-v3-') && f.endsWith('.json') && f !== 'reviews-v3-all.json');
}

function slugFromFile(filename) {
  return filename.replace('reviews-v3-', '').replace('.json', '');
}

function checkPlaceTitle(slug, reviews) {
  if (!reviews.length) return { status: 'NO_DATA', detail: 'No reviews — cannot verify listing' };
  const title = reviews[0]._place_title || '';
  if (EXCLUDED[slug]) return { status: 'EXCLUDED', detail: EXCLUDED[slug] };
  const known = KNOWN_TITLES[slug];
  if (!known) return { status: 'UNVERIFIED', detail: `No title pattern registered for ${slug} — manual check needed` };
  if (known.pattern.test(title)) return { status: 'OK', detail: title };
  return { status: 'MISMATCH', detail: `Expected pattern /${known.pattern.source}/i but got: "${title}"` };
}

function checkStarRatings(reviews) {
  const nulls = reviews.filter(r => r.star_rating === null || r.star_rating === undefined).length;
  const nonNumeric = reviews.filter(r => typeof r.star_rating !== 'number').length;
  return { nulls, nonNumeric, clean: nulls === 0 && nonNumeric === 0 };
}

function checkTextCoverage(reviews) {
  const empty = reviews.filter(r => !r.review_text || r.review_text.trim() === '').length;
  const total = reviews.length;
  const rate = total > 0 ? ((empty / total) * 100).toFixed(1) : '0.0';
  return { empty, total, rate: parseFloat(rate) };
}

function checkDates(reviews) {
  const relative = reviews.filter(r => r.review_date && !/^\d{4}-\d{2}-\d{2}/.test(r.review_date)).length;
  const missing = reviews.filter(r => !r.review_date).length;
  const iso = reviews.length - relative - missing;
  return { iso, relative, missing };
}

function avgRating(reviews) {
  const rated = reviews.filter(r => typeof r.star_rating === 'number');
  if (!rated.length) return null;
  const sum = rated.reduce((acc, r) => acc + r.star_rating, 0);
  return parseFloat((sum / rated.length).toFixed(2));
}

// ── Main ──────────────────────────────────────────────────────────────────────
function validate() {
  const files = getFiles();
  if (!files.length) {
    console.error('No reviews-v3-*.json files found in current directory.');
    process.exit(1);
  }

  console.log(`\nReviewIntel v3 — Validator`);
  console.log(`Checking ${files.length} provider files...\n`);

  const report = {
    validated_at: new Date().toISOString(),
    total_files: files.length,
    excluded: Object.keys(EXCLUDED),
    results: [],
    summary: {
      ok: 0,
      warnings: 0,
      errors: 0,
      excluded: Object.keys(EXCLUDED).length,
    }
  };

  for (const file of files.sort()) {
    const slug = slugFromFile(file);
    const reviews = loadJSON(file);
    const issues = [];
    const warnings = [];

    // Excluded check
    if (EXCLUDED[slug]) {
      console.log(`  [EXCLUDED] ${slug}`);
      console.log(`             ${EXCLUDED[slug]}\n`);
      report.results.push({ slug, file, status: 'EXCLUDED', reason: EXCLUDED[slug] });
      report.summary.excluded++;
      continue;
    }

    if (!reviews) {
      issues.push('Could not parse JSON file');
      console.log(`  [ERROR] ${slug} — unreadable JSON`);
      report.results.push({ slug, file, status: 'ERROR', issues });
      report.summary.errors++;
      continue;
    }

    // Place title check
    const titleCheck = checkPlaceTitle(slug, reviews);
    if (titleCheck.status === 'MISMATCH') issues.push(`Place title mismatch: ${titleCheck.detail}`);
    if (titleCheck.status === 'UNVERIFIED') warnings.push(`Place title unverified: ${titleCheck.detail}`);

    // Review count check
    if (reviews.length === 0) {
      issues.push('Zero reviews — no data');
    } else if (reviews.length < MIN_REVIEWS) {
      warnings.push(`Low review count: ${reviews.length} (minimum ${MIN_REVIEWS})`);
    }

    // Star rating check
    const stars = checkStarRatings(reviews);
    if (!stars.clean) issues.push(`Star rating issues: ${stars.nulls} nulls, ${stars.nonNumeric} non-numeric`);

    // Text coverage
    const text = checkTextCoverage(reviews);
    if (text.rate > 20) warnings.push(`High empty text rate: ${text.rate}% (${text.empty} of ${text.total} reviews)`);

    // Date format
    const dates = checkDates(reviews);
    if (dates.relative > 0) warnings.push(`${dates.relative} relative date strings — anchor to scrape_date needed`);

    // Rating
    const rating = avgRating(reviews);

    // Status
    const status = issues.length > 0 ? 'ERROR' : warnings.length > 0 ? 'WARNING' : 'OK';

    // Console output
    const icon = status === 'OK' ? '✓' : status === 'WARNING' ? '⚠' : '✗';
    console.log(`  [${icon}] ${slug}`);
    console.log(`       Reviews: ${reviews.length} | Avg rating: ${rating ?? 'n/a'} | Empty text: ${text.rate}%`);
    console.log(`       Place title: ${titleCheck.status} — ${titleCheck.detail}`);
    if (issues.length) issues.forEach(i => console.log(`       ✗ ERROR: ${i}`));
    if (warnings.length) warnings.forEach(w => console.log(`       ⚠ WARN:  ${w}`));
    console.log('');

    report.results.push({
      slug,
      file,
      status,
      review_count: reviews.length,
      avg_rating: rating,
      text_coverage: { empty: text.empty, total: text.total, empty_rate_pct: text.rate },
      date_format: dates,
      place_title: { status: titleCheck.status, value: titleCheck.detail },
      issues,
      warnings,
    });

    if (status === 'OK') report.summary.ok++;
    else if (status === 'WARNING') report.summary.warnings++;
    else report.summary.errors++;
  }

  // Summary
  console.log('══════════════════════════════════════════');
  console.log('VALIDATION SUMMARY');
  console.log('══════════════════════════════════════════');
  console.log(`  OK:       ${report.summary.ok}`);
  console.log(`  Warnings: ${report.summary.warnings}`);
  console.log(`  Errors:   ${report.summary.errors}`);
  console.log(`  Excluded: ${report.summary.excluded}`);
  console.log('──────────────────────────────────────────');
  if (report.summary.errors > 0) {
    console.log('\n  ✗ Fix all errors before running process.mjs\n');
  } else if (report.summary.warnings > 0) {
    console.log('\n  ⚠ Warnings present — review before processing\n');
  } else {
    console.log('\n  ✓ All checks passed — safe to run process.mjs\n');
  }

  fs.writeFileSync('validation-report.json', JSON.stringify(report, null, 2));
  console.log('  Report saved → validation-report.json\n');
}

validate();
