// ReviewIntel v3 — CSV Exporter + QA Checker
// Input:  analyzed-v3-all.json  (or pass filename as arg: node export-csv.mjs myfile.json)
// Output: realtattooreviews_google_reviews_YYYY-MM-DD.csv
// Run: node export-csv.mjs

import fs from 'fs';

const COLUMNS = [
  'provider_name',
  'location_city',
  'location_state',
  'method_used',
  'review_text',
  'star_rating',
  'review_date',
  'reviewer_name',
  'pain_level',
  'scarring_mentioned',
  'sessions_completed',
  'skin_type',
  'use_case',
  'result_rating',
  'verified_source',
];

// Escape a single CSV cell value
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Quote if contains comma, newline, or double quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV(rows) {
  const header = COLUMNS.join(',');
  const lines = rows.map(row =>
    COLUMNS.map(col => csvCell(row[col])).join(',')
  );
  return [header, ...lines].join('\n');
}

function spotCheck(rows, n = 5) {
  console.log(`\nSpot-check: ${n} random reviews`);
  console.log('──────────────────────────────────────────');
  const indices = [];
  while (indices.length < Math.min(n, rows.length)) {
    const i = Math.floor(Math.random() * rows.length);
    if (!indices.includes(i)) indices.push(i);
  }
  for (const i of indices.sort((a,b) => a-b)) {
    const r = rows[i];
    const text = (r.review_text || '').substring(0, 80).replace(/\n/g, ' ');
    console.log(`  #${i + 1} | ${r.provider_name} (${r.location_city}) | ★${r.star_rating}`);
    console.log(`       text:    "${text}${r.review_text?.length > 80 ? '…' : ''}"`);
    console.log(`       result:  ${r.result_rating}  |  pain: ${r.pain_level}  |  sessions: ${r.sessions_completed}  |  use_case: ${r.use_case}`);
    console.log('');
  }
}

function runQA(rows) {
  const total = rows.length;

  // 1. CA exclusion
  const caRows = rows.filter(r => r.location_state === 'CA');

  // 2. Per-provider counts
  const providerCounts = {};
  for (const r of rows) {
    const key = `${r.provider_name} (${r.location_city}, ${r.location_state})`;
    providerCounts[key] = (providerCounts[key] || 0) + 1;
  }
  const under30 = Object.entries(providerCounts).filter(([, c]) => c < 30);

  // 3. result_rating unknown %
  const resultUnknown = rows.filter(r => r.result_rating === 'unknown').length;
  const resultUnknownPct = Math.round(resultUnknown / total * 100);

  // 4. pain_level unknown %
  const painUnknown = rows.filter(r => r.pain_level === 'unknown').length;
  const painUnknownPct = Math.round(painUnknown / total * 100);

  // 5. inkout locations
  const inkoutCities = [...new Set(
    rows.filter(r => r.provider_name === 'inkout').map(r => r.location_city)
  )];
  const expectedInkout = ['Austin', 'Draper', 'Tampa', 'Chicago', 'Houston'];
  const missingInkout = expectedInkout.filter(c => !inkoutCities.includes(c));

  console.log('\n══════════════════════════════════════════');
  console.log('FINAL QA REPORT');
  console.log('══════════════════════════════════════════');

  // Check 1
  const caPass = caRows.length === 0;
  console.log(`[${caPass ? '✓' : '✗'}] No California locations: ${caPass ? 'PASS' : `FAIL — ${caRows.length} CA rows found`}`);

  // Check 2
  console.log(`\nReview counts per provider:`);
  for (const [key, count] of Object.entries(providerCounts).sort()) {
    const flag = count < 30 ? ' ⚠ FLAGGED' : '';
    console.log(`  ${count.toString().padStart(3)}  ${key}${flag}`);
  }
  if (under30.length > 0) {
    console.log(`\n[✗] Providers with <30 reviews (${under30.length}):`);
    under30.forEach(([k, c]) => console.log(`     ${k}: ${c} reviews`));
  } else {
    console.log(`\n[✓] All providers have ≥30 reviews`);
  }

  // Check 3
  const resultPass = resultUnknownPct < 30;
  console.log(`\n[${resultPass ? '✓' : '✗'}] result_rating unknown: ${resultUnknown}/${total} (${resultUnknownPct}%) — target <30%`);

  // Check 4
  const painPass = painUnknownPct < 50;
  console.log(`[${painPass ? '✓' : '✗'}] pain_level unknown:    ${painUnknown}/${total} (${painUnknownPct}%) — target <50%`);

  // Check 5 (spot check printed separately)

  // Check 6
  console.log(`\nTotal review count: ${total}`);

  // Check 7
  const inkoutPass = missingInkout.length === 0;
  console.log(`\n[${inkoutPass ? '✓' : '✗'}] inkout locations (need 5): ${inkoutCities.length} found — ${inkoutCities.join(', ')}`);
  if (!inkoutPass) console.log(`     Missing: ${missingInkout.join(', ')}`);

  console.log('══════════════════════════════════════════');

  const allPass = caPass && under30.length === 0 && resultPass && painPass && inkoutPass;
  console.log(`\nOverall: ${allPass ? '✓ ALL CHECKS PASSED' : '⚠ SOME CHECKS FAILED — review above'}`);

  return allPass;
}

async function exportCSV() {
  const inputFile = process.argv[2] || 'analyzed-v3-all.json';
  if (!fs.existsSync(inputFile)) {
    console.error(`${inputFile} not found — run analyze-v3.mjs first`);
    process.exit(1);
  }

  const rows = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  console.log(`ReviewIntel v3 CSV Export — ${rows.length} rows from ${inputFile}`);

  // Strip internal-only fields (prefixed with _)
  const clean = rows.map(r => {
    const out = {};
    for (const col of COLUMNS) {
      out[col] = r[col] ?? 'unknown';
    }
    return out;
  });

  // Run QA
  runQA(clean);

  // Spot check
  spotCheck(clean, 5);

  // Write CSV
  const today = new Date().toISOString().slice(0, 10);
  const outFile = `realtattooreviews_google_reviews_${today}.csv`;
  fs.writeFileSync(outFile, toCSV(clean));
  console.log(`\nCSV saved → ${outFile}`);
  console.log(`Rows: ${clean.length}  |  Columns: ${COLUMNS.length}`);
}

exportCSV().catch(console.error);
