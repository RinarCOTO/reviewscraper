// Import only NEW reviews to Supabase — does NOT delete existing rows.
// Matches existing reviews by reviewer_name + provider_name + date (YYYY-MM-DD).
// Safe to run after re-scraping without losing Qwen classifications.
//
// Usage:
//   SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx node pipeline/import-new-only.mjs
//   node pipeline/import-new-only.mjs --dry-run

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rxrhvbfutjahgwaambqd.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cmh2YmZ1dGphaGd3YWFtYnFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM1MTcwNywiZXhwIjoyMDkxOTI3NzA3fQ.06-kZtLuaPlukmFE9wJESRdVzgdv-LQW5Ffr64_BbWs';
const TABLE = 'competitor_reviews';
const DRY_RUN = process.argv.includes('--dry-run');

const ANALYZED_FILE = path.join(__dirname, '../data/analyzed/analyzed-v4-all.json');

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

async function supabase(method, endpoint, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} failed (${res.status}): ${text}`);
  }
  return method === 'GET' ? res.json() : null;
}

function dateKey(iso) {
  if (!iso) return 'null';
  return String(iso).slice(0, 10); // YYYY-MM-DD regardless of format
}

async function fetchExistingKeys() {
  console.log('Fetching existing reviews from Supabase...');
  const keys = new Set();
  let offset = 0;
  while (true) {
    const rows = await supabase('GET', `${TABLE}?select=reviewer_name,provider_name,review_date_iso&limit=1000&offset=${offset}`);
    for (const r of rows) {
      keys.add(`${r.provider_name}|${r.reviewer_name}|${dateKey(r.review_date_iso)}`);
    }
    if (rows.length < 1000) break;
    offset += 1000;
  }
  console.log(`  Found ${keys.size} existing reviews in Supabase\n`);
  return keys;
}

function toRow(r) {
  return {
    provider_name:          r.provider_name,
    location_city:          r.location_city,
    location_state:         r.location_state,
    method_used:            r.method_used,
    review_text:            r.review_text || null,
    star_rating:            r.star_rating ?? null,
    review_date:            r.review_date || null,
    review_date_iso:        r.review_date_iso || null,
    review_date_estimated:  r.review_date_estimated ?? null,
    review_date_label:      r.review_date_label || null,
    review_date_source:     r.review_date_source || null,
    reviewer_name:          r.reviewer_name || null,
    reviewer_local_guide:   r.reviewer_local_guide ?? false,
    verified_source:        r.verified_source || 'Google',
    source_url:             r.source_url || null,
    has_text:               r.has_text ?? false,
    brand_name:             r.brand_name || null,
    multi_location_brand:   r.multi_location_brand ?? false,
    location_transition:    r.location_transition ?? false,
    transition_note:        r.transition_note || null,
    result_rating:          r.result_rating || null,
    pain_level:             r.pain_level || null,
    scarring_mentioned:     r.scarring_mentioned || null,
    sessions_completed:     r.sessions_completed || null,
    skin_type:              r.skin_type || null,
    use_case:               r.use_case || null,
    bucket:                 r.bucket || 'competitor',
    scrape_version:         'v4',
  };
}

async function main() {
  if (!fs.existsSync(ANALYZED_FILE)) {
    console.error(`Analyzed file not found: ${ANALYZED_FILE}`);
    console.error('Run: node pipeline/analyze-v4.mjs --skip-ai first');
    process.exit(1);
  }

  const analyzed = JSON.parse(fs.readFileSync(ANALYZED_FILE, 'utf8'));
  console.log(`Loaded ${analyzed.length} reviews from analyzed file`);
  if (DRY_RUN) console.log('DRY RUN — no changes will be made\n');

  const existingKeys = await fetchExistingKeys();

  const newRows = analyzed.filter(r => {
    const key = `${r.provider_name}|${r.reviewer_name}|${dateKey(r.review_date_iso)}`;
    return !existingKeys.has(key);
  });

  console.log(`New reviews to insert: ${newRows.length} (${analyzed.length - newRows.length} already exist)\n`);

  if (newRows.length === 0) {
    console.log('Nothing to insert. Done.');
    return;
  }

  if (DRY_RUN) {
    const byProvider = {};
    for (const r of newRows) {
      byProvider[r.provider_name] = (byProvider[r.provider_name] || 0) + 1;
    }
    console.log('Would insert:');
    for (const [p, n] of Object.entries(byProvider).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${p}: ${n}`);
    }
    return;
  }

  // Insert in batches of 100
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < newRows.length; i += BATCH) {
    const batch = newRows.slice(i, i + BATCH).map(toRow);
    await supabase('POST', TABLE, batch);
    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted}/${newRows.length}...`);
  }

  console.log(`\n\nDone — ${inserted} new reviews inserted. Existing rows untouched.`);
}

main().catch(console.error);
