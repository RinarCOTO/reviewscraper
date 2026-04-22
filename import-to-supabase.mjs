// ReviewIntel v3 — Supabase Importer
// Reads providers-all.json (output of process.mjs + extract-signals.mjs)
// and upserts reviews into the Supabase reviews table.
//
// Strategy: for each provider slug, DELETE existing rows then INSERT fresh ones.
// This ensures Tatt2Away-stripped inkOUT data replaces the old contaminated rows.
//
// Usage:
//   SUPABASE_SERVICE_KEY=your_service_role_key node import-to-supabase.mjs
//   SUPABASE_SERVICE_KEY=xxx node import-to-supabase.mjs --provider inkout
//   SUPABASE_SERVICE_KEY=xxx node import-to-supabase.mjs --dry-run

import fs from 'fs';

const SUPABASE_URL  = 'https://rxrhvbfutjahgwaambqd.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var.');
  console.error('Find it in: Supabase dashboard → Project Settings → API → service_role (secret)');
  process.exit(1);
}

const args       = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const providerArgIdx = args.indexOf('--provider');
const ONLY_SLUG = args.find(a => a.startsWith('--provider='))?.split('=')[1]
               ?? (providerArgIdx !== -1 ? args[providerArgIdx + 1] ?? null : null);

// ── Slug helpers ──────────────────────────────────────────────────────────────

function toProviderSlug(providerName, city, state) {
  // Multi-location brands: slug is brand name only
  const BRAND_MAP = {
    'inkout':                    'inkout',
    'removery (bucktown)':       'removery-bucktown',
    'removery (lincoln square)': 'removery-lincoln-square',
    'removery (south congress)': 'removery-south-congress',
  };
  const key = providerName.toLowerCase();
  if (BRAND_MAP[key]) return BRAND_MAP[key];
  // Single-location: slugify provider name
  return providerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
}

function toCitySlug(city) {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function toDbRow(review) {
  const reviewDateAt = review.review_date_resolved || null;

  return {
    provider_name:    review.provider_name,
    location_city:    review.location_city,
    location_state:   review.location_state,
    method_used:      review.method_used || null,
    review_text:      review.review_text || '',
    star_rating:      typeof review.star_rating === 'number' ? review.star_rating : null,
    review_date:      review.review_date || null,
    review_date_at:   reviewDateAt,
    reviewer_name:    review.reviewer_name || null,
    verified_source:  review.verified_source || 'Google',
    _place_title:     review._place_title || null,
    source_review_url: null,
    pain_level:       null,
    scarring_mentioned: null,
    sessions_completed: null,
    skin_type:        null,
    use_case:         null,
    result_rating:    null,
    // provider_slug and city_slug are generated columns — omit from INSERT
  };
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

const HEADERS = {
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=minimal',
};

async function deleteByProviderSlug(providerSlug) {
  const url = `${SUPABASE_URL}/rest/v1/reviews?provider_slug=eq.${encodeURIComponent(providerSlug)}`;
  const res = await fetch(url, { method: 'DELETE', headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DELETE failed for ${providerSlug}: ${res.status} ${body}`);
  }
}

async function insertRows(rows) {
  const url = `${SUPABASE_URL}/rest/v1/reviews`;
  const res = await fetch(url, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`INSERT failed: ${res.status} ${body}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nReviewIntel v3 — Supabase Importer`);
  if (DRY_RUN) console.log('DRY RUN — no writes will happen\n');
  if (ONLY_SLUG) console.log(`Filtering to provider: ${ONLY_SLUG}\n`);

  const allSummaries = JSON.parse(fs.readFileSync('providers-all.json', 'utf8'));

  let totalInserted = 0;
  let totalDeleted  = 0;

  for (const summary of allSummaries) {
    const providerSlug = toProviderSlug(
      summary.provider_name,
      summary.location_breakdown?.[0]?.city || '',
      summary.location_breakdown?.[0]?.state || '',
    );

    if (ONLY_SLUG && providerSlug !== ONLY_SLUG) continue;

    const rows = summary.reviews.map(r => toDbRow(r));

    console.log(`  ${summary.provider_name} → slug: ${providerSlug}, ${rows.length} reviews`);

    if (DRY_RUN) {
      console.log(`    [dry-run] would DELETE ${providerSlug} then INSERT ${rows.length} rows\n`);
      continue;
    }

    try {
      await deleteByProviderSlug(providerSlug);
      console.log(`    Deleted existing rows for ${providerSlug}`);
      totalDeleted++;

      // Insert in batches of 200 to stay under request size limits
      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        await insertRows(rows.slice(i, i + BATCH));
      }
      console.log(`    Inserted ${rows.length} rows\n`);
      totalInserted += rows.length;
    } catch (err) {
      console.error(`    ERROR: ${err.message}\n`);
    }

    // Small pause between providers
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('══════════════════════════════════════════');
  console.log('Import complete');
  if (!DRY_RUN) {
    console.log(`  Providers processed: ${totalDeleted}`);
    console.log(`  Reviews inserted:    ${totalInserted}`);
  }
  console.log('══════════════════════════════════════════\n');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
