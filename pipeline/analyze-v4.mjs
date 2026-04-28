// ReviewIntel v4 — Analyzer
// Input:  reviews-v3-all.json  (or pass filename as arg: node analyze-v4.mjs myfile.json)
// Output: analyzed-v4-all.json + per-provider files
// Run: ANTHROPIC_API_KEY=xxx node analyze-v4.mjs
//
// Changes from v3:
//   - Auto-excludes California locations (pre-launch blocker)
//   - Adds method_used based on provider lookup (was missing entirely)
//   - Adds verified_source field (was missing entirely)
//   - Validates required scraper fields before analysis
//   - Aligned use_case labels to match front-end filter spec
//   - QA report now includes method_used and use_case distribution
//   - Reports skipped CA reviews separately

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REVIEWS_DIR = path.join(__dirname, '../data/reviews');
const ANALYZED_DIR = path.join(__dirname, '../data/analyzed');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY env var'); process.exit(1); }

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-20250514';

// ── Provider → method lookup ──
// Source: Page Intent Map v6, Section 1
const METHOD_MAP = {
  'inkOUT':                     'TEPR',
  'Tatt2Away':                  'TEPR',
  'Removery':                   'PicoWay',
  'Removery (South Congress)':  'PicoWay',
  'Removery (Bucktown)':        'PicoWay',
  'Removery (Lincoln Square)':  'PicoWay',
  'Removery (Round Rock)':      'PicoWay',
  'Removery (Hedwig Village)':  'PicoWay',
  'Removery (East Houston)':    'PicoWay',
  'Removery (Katy)':            'PicoWay',
  'Removery (Friendswood)':     'PicoWay',
  'Removery (Sugar Land)':      'PicoWay',
  'Removery (The Woodlands)':   'PicoWay',
  'Removery (Rice Village)':    'PicoWay',
  'Removery (Westshore)':       'PicoWay',
  'MEDermis Laser Clinic':      'Spectra',
  'Clean Slate Ink':            'Q-Switch',
  'Inklifters':                 'PicoWay',
  'Inklifters (Aesthetica)':    'PicoWay',
  'Clarity Skin':               'PicoWay',
  'Erasable Med Spa':           'Laser (multiple)',
  'Arviv Medical Aesthetics':   'PicoWay',
  'Skintellect':                'Fotona',
  'Enfuse Medical Spa':         'PicoWay',
  'Kovak Cosmetic Center':      'PicoWay',
  'DermSurgery Associates':     'Q-Switch',
  'InkFree, MD':                'Other',
  'Dermaluxe Spa':              'Saline+Pico',
  'LaserAway (Austin)':         'PicoSure',
  'LaserAway (Chicago)':        'PicoSure',
  'LaserAway (Houston)':        'PicoSure',
  'LaserAway (Tampa)':          'PicoSure',
};

function lookupMethod(providerName) {
  if (METHOD_MAP[providerName]) return METHOD_MAP[providerName];
  // Fuzzy match: check if provider name starts with or contains a known key
  for (const [key, method] of Object.entries(METHOD_MAP)) {
    if (providerName.toLowerCase().includes(key.toLowerCase())) return method;
  }
  return 'Other';
}

// ── Target markets — exclude everything else ──
const EXCLUDED_CITIES = new Set([
  'Chula Vista', 'Los Angeles', 'LA', 'Pasadena', 'San Diego', 'Woodland Hills',
  // Add any other CA cities that show up
]);

function shouldExclude(review) {
  if (review.location_state === 'CA' || review.location_state === 'California') return true;
  if (EXCLUDED_CITIES.has(review.location_city)) return true;
  return false;
}

// ── Required fields from scraper ──
const REQUIRED_FIELDS = ['provider_name', 'location_city', 'location_state', 'review_text', 'star_rating'];

function validateReview(review, index) {
  const missing = REQUIRED_FIELDS.filter(f => review[f] === undefined || review[f] === null);
  if (missing.length > 0) {
    console.warn(`  ⚠ Review ${index + 1}: missing fields from scraper: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

// ── AI prompt — aligned labels ──
const SYSTEM = `You are a review analyst for tattoo removal businesses. Parse each review and return ONLY a JSON object with these exact fields:

pain_level: 1 | 2 | 3 | 4 | 5 | "unknown"
  Map from review text:
  1 = painless / "no pain" / "barely felt it" / "totally comfortable"
  2 = minimal / "little discomfort" / "mild" / "not bad"
  3 = moderate / "some pain" / "manageable" / "hurt a bit"
  4 = intense / "hurt a lot" / "painful" / "pretty painful"
  5 = severe / "worst pain" / "excruciating" / "very painful"
  "unknown" = pain is never mentioned at all

scarring_mentioned: "Yes" | "No" | "Positive"
  CRITICAL: this field is about scarring CAUSED BY the removal treatment — not pre-existing scarring from the original tattoo.
  Yes = reviewer experienced or is complaining about scarring, blistering, raised skin, or adverse skin effects from the removal procedure itself
  Positive = reviewer explicitly says the treatment did NOT scar them, healed well, "no scarring", skin recovered well
  No = no treatment-related scarring mentioned — INCLUDING cases where the reviewer mentions pre-existing tattoo scarring only as background context (e.g. "my skin had scarred over from the tattoo", "older tattoo with scar tissue")

sessions_completed: integer or "unknown"
  Extract the number of sessions/treatments/visits the reviewer has had or mentions completing.
  Look for patterns: "after 3 sessions", "my 5th treatment", "4 visits", "halfway through (X sessions)"
  "unknown" if no session count is stated

skin_type: "Light" | "Medium" | "Dark" | "unknown"
  Infer from explicit mentions (e.g. "fair skin", "dark complexion", "olive tone") or context clues.
  "unknown" if not determinable

use_case: "Complete" | "Cover-up" | "Microblading" | "Color" | "Other" | "unknown"
  Complete = reviewer wants full removal
  Cover-up = mentions wanting to cover with new tattoo, fading for cover-up
  Microblading = eyebrow tattoo or microblading or permanent makeup removal
  Color = specifically mentions colored ink removal (green, blue, pastel, etc.)
  Other = a specific use case mentioned that doesn't fit above
  "unknown" if purpose not stated

result_rating: "Positive" | "Neutral" | "Mixed" | "Negative" | "unknown"
  CRITICAL — infer aggressively from stars + language, minimize "unknown":
  Positive  = 5★ with positive outcome language OR 4★ mentioning good results / progress / fading / happy with treatment results
  Neutral   = review is only about staff/scheduling/consultation/pricing with zero mention of removal outcome; OR reviewer is early in treatment and says results are too soon to judge; OR 3★ with neither positive nor negative outcome language
  Mixed     = mentions BOTH positive and negative aspects of results, OR 3★ with some disappointment about outcomes
  Negative  = expresses disappointment, poor results, no visible change, waste of money, scarring from treatment, pain complaints as the main message
  "unknown" = review is so short or vague that result quality genuinely cannot be inferred even from star context — use sparingly

Respond with ONLY the JSON object. No markdown, no explanation, no code fences.`;

async function categorize(review) {
  const prompt = `Provider: ${review.provider_name} (${review.location_city}, ${review.location_state})
Method: ${review.method_used || 'unknown'}
Stars: ${review.star_rating ?? 'N/A'}
Review: ${review.review_text || '[no text — star rating only]'}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  try {
    return JSON.parse(raw);
  } catch {
    console.warn('\nParse error, raw:', raw);
    return {
      pain_level: 'unknown',
      scarring_mentioned: 'No',
      sessions_completed: 'unknown',
      skin_type: 'unknown',
      use_case: 'unknown',
      result_rating: 'unknown',
    };
  }
}

async function analyze() {
  const args = process.argv.slice(2);
  const inputFile = args.find(a => !a.startsWith('--')) || path.join(REVIEWS_DIR, 'reviews-v4-all.json');
  const INCREMENTAL = args.includes('--mode=incremental');
  const SKIP_AI = args.includes('--skip-ai');

  if (!fs.existsSync(inputFile)) {
    console.error(`${inputFile} not found — run scrape-v4.mjs first`);
    process.exit(1);
  }

  let reviews = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  console.log(`ReviewIntel v4 Analyzer — ${reviews.length} raw reviews loaded`);

  // Incremental: skip reviews already in analyzed-v4-all-dated.json
  let existingAnalyzed = [];
  const analyzedDatedPath = path.join(ANALYZED_DIR, 'analyzed-v4-all-dated.json');
  if (INCREMENTAL && fs.existsSync(analyzedDatedPath)) {
    existingAnalyzed = JSON.parse(fs.readFileSync(analyzedDatedPath, 'utf8'));
    const analyzedKeys = new Set(
      existingAnalyzed.map(r => `${r.reviewer_name}|${r.review_date_iso}|${r.location_city}`)
    );
    const before = reviews.length;
    reviews = reviews.filter(r => !analyzedKeys.has(`${r.reviewer_name}|${r.review_date_iso}|${r.location_city}`));
    console.log(`Incremental: ${before - reviews.length} already analyzed, ${reviews.length} new to process`);
    if (reviews.length === 0) {
      console.log('Nothing new to analyze — exiting.');
      return;
    }
  }
  console.log();

  // ── Step 1: Exclude California / out-of-market ──
  const excluded = reviews.filter(r => shouldExclude(r));
  reviews = reviews.filter(r => !shouldExclude(r));
  if (excluded.length > 0) {
    console.log(`✗ Excluded ${excluded.length} out-of-market reviews (CA / non-target cities)`);
    const exCities = [...new Set(excluded.map(r => `${r.location_city}, ${r.location_state}`))];
    console.log(`  Cities removed: ${exCities.join('; ')}`);
    fs.writeFileSync(path.join(ANALYZED_DIR, 'excluded-reviews-v4.json'), JSON.stringify(excluded, null, 2));
    console.log(`  Saved to data/analyzed/excluded-reviews-v4.json for reference\n`);
  } else {
    console.log('✓ No out-of-market reviews found\n');
  }

  // ── Step 2: Validate required fields ──
  let validationIssues = 0;
  reviews.forEach((r, i) => { if (!validateReview(r, i)) validationIssues++; });
  if (validationIssues > 0) {
    console.log(`⚠ ${validationIssues} reviews have missing scraper fields (see warnings above)\n`);
  }

  // ── Step 3: Add method_used from lookup if missing ──
  let methodsAdded = 0;
  for (const r of reviews) {
    if (!r.method_used || r.method_used === 'Other') {
      r.method_used = lookupMethod(r.provider_name);
      methodsAdded++;
    }
    // Always ensure verified_source is set
    if (!r.verified_source) r.verified_source = 'Google';
  }
  if (methodsAdded > 0) {
    console.log(`+ Added method_used to ${methodsAdded} reviews from provider lookup`);
  }
  // ── Step 4: AI analysis (skipped when --skip-ai; Qwen patches these fields post-import) ──
  const analyzed = [];
  let errorCount = 0;

  if (SKIP_AI) {
    console.log(`\nSkipping AI analysis (--skip-ai) — Qwen will patch result_rating, pain_level, etc. after import\n`);
    for (const review of reviews) {
      analyzed.push({
        ...review,
        pain_level: 'unknown',
        scarring_mentioned: 'No',
        sessions_completed: 'unknown',
        skin_type: 'unknown',
        use_case: 'unknown',
        result_rating: 'unknown',
      });
    }
  } else {
    console.log(`\nAnalyzing ${reviews.length} reviews with ${MODEL}...\n`);
    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];
      process.stdout.write(`\r[${i + 1}/${reviews.length}] ${review.provider_name} (${review.location_city})...`);
      try {
        const fields = await categorize(review);
        analyzed.push({ ...review, ...fields });
      } catch (e) {
        console.error(`\nFailed on review ${i + 1}:`, e.message);
        errorCount++;
        analyzed.push({
          ...review,
          pain_level: 'unknown',
          scarring_mentioned: 'No',
          sessions_completed: 'unknown',
          skin_type: 'unknown',
          use_case: 'unknown',
          result_rating: 'unknown',
          _error: e.message,
        });
      }
      await new Promise(r => setTimeout(r, 300));
    }
    console.log('\n');
  }

  // Merge with existing if incremental, then save
  const allAnalyzed = INCREMENTAL ? [...analyzed, ...existingAnalyzed] : analyzed;
  fs.mkdirSync(ANALYZED_DIR, { recursive: true });
  fs.writeFileSync(path.join(ANALYZED_DIR, 'analyzed-v4-all.json'), JSON.stringify(allAnalyzed, null, 2));
  console.log(`Saved ${allAnalyzed.length} analyzed reviews → data/analyzed/analyzed-v4-all.json (${analyzed.length} new)`);

  // Save per-provider files
  const byProvider = {};
  for (const r of allAnalyzed) {
    const key = `${r.provider_name} (${r.location_city}, ${r.location_state})`;
    if (!byProvider[key]) byProvider[key] = [];
    byProvider[key].push(r);
  }
  for (const [key, rows] of Object.entries(byProvider)) {
    const slug = key.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const filename = path.join(ANALYZED_DIR, `analyzed-v4-${slug}.json`);
    fs.writeFileSync(filename, JSON.stringify(rows, null, 2));
  }
  console.log(`Per-provider files saved: ${Object.keys(byProvider).length}`);

  // ── QA Report ──
  const total = allAnalyzed.length;

  const resultUnknown = allAnalyzed.filter(r => r.result_rating === 'unknown').length;
  const painUnknown   = allAnalyzed.filter(r => r.pain_level === 'unknown').length;
  const useCaseUnknown = allAnalyzed.filter(r => r.use_case === 'unknown').length;
  const resultUnknownPct = Math.round(resultUnknown / total * 100);
  const painUnknownPct   = Math.round(painUnknown / total * 100);
  const useCaseUnknownPct = Math.round(useCaseUnknown / total * 100);

  const resultDist = {};
  const painDist   = {};
  const useCaseDist = {};
  const methodDist = {};
  allAnalyzed.forEach(r => {
    resultDist[r.result_rating] = (resultDist[r.result_rating] || 0) + 1;
    painDist[r.pain_level]      = (painDist[r.pain_level] || 0) + 1;
    useCaseDist[r.use_case]     = (useCaseDist[r.use_case] || 0) + 1;
    methodDist[r.method_used]   = (methodDist[r.method_used] || 0) + 1;
  });

  // Per-provider counts
  const providerCounts = {};
  for (const r of analyzed) {
    const key = `${r.provider_name} (${r.location_city}, ${r.location_state})`;
    providerCounts[key] = (providerCounts[key] || 0) + 1;
  }

  const inkoutLocations = [...new Set(
    analyzed.filter(r => r.provider_name === 'inkOUT').map(r => r.location_city)
  )];

  const hasCa = allAnalyzed.some(r => r.location_state === 'CA');
  const missingMethod = allAnalyzed.filter(r => !r.method_used || r.method_used === 'Other').length;
  const missingSource = allAnalyzed.filter(r => !r.verified_source).length;

  console.log('\n══════════════════════════════════════════');
  console.log('QA REPORT — v4');
  console.log('══════════════════════════════════════════');
  console.log(`Total reviews analyzed:  ${total}`);
  console.log(`CA reviews excluded:     ${excluded.length}`);
  console.log(`Analysis errors:         ${errorCount}`);
  console.log('');
  console.log('Reviews per provider:');
  for (const [key, count] of Object.entries(providerCounts).sort((a,b) => b[1]-a[1])) {
    const flag = count < 30 ? ' ⚠ <30' : '';
    console.log(`  ${key}: ${count}${flag}`);
  }
  console.log('');
  console.log('── Field quality ──');
  console.log(`result_rating "unknown": ${resultUnknown} / ${total} (${resultUnknownPct}%) — target <30%  ${resultUnknownPct < 30 ? '✓' : '✗'}`);
  console.log(`pain_level "unknown":    ${painUnknown} / ${total} (${painUnknownPct}%) — target <50%  ${painUnknownPct < 50 ? '✓' : '✗'}`);
  console.log(`use_case "unknown":      ${useCaseUnknown} / ${total} (${useCaseUnknownPct}%)`);
  console.log(`method_used missing:     ${missingMethod} / ${total}  ${missingMethod === 0 ? '✓' : '⚠ check provider lookup'}`);
  console.log(`verified_source missing: ${missingSource} / ${total}  ${missingSource === 0 ? '✓' : '⚠'}`);
  console.log('');
  console.log('result_rating distribution:');
  Object.entries(resultDist).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    const pct = Math.round(v / total * 100);
    console.log(`  ${k}: ${v} (${pct}%)`);
  });
  console.log('');
  console.log('pain_level distribution:');
  Object.entries(painDist).sort((a,b) => {
    const order = [1,2,3,4,5,'unknown'];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  }).forEach(([k,v]) => {
    const pct = Math.round(v / total * 100);
    console.log(`  ${k}: ${v} (${pct}%)`);
  });
  console.log('');
  console.log('use_case distribution:');
  Object.entries(useCaseDist).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    const pct = Math.round(v / total * 100);
    console.log(`  ${k}: ${v} (${pct}%)`);
  });
  console.log('');
  console.log('method_used distribution:');
  Object.entries(methodDist).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    const pct = Math.round(v / total * 100);
    console.log(`  ${k}: ${v} (${pct}%)`);
  });
  console.log('');
  console.log(`CA locations in dataset: ${hasCa ? '✗ YES — INVESTIGATE' : '✓ None (excluded)'}`);
  console.log(`inkout locations (need 5): ${inkoutLocations.length} — ${inkoutLocations.join(', ')}`);
  console.log('──────────────────────────────────────────');
  console.log('Next step: node export-csv.mjs');
  console.log('══════════════════════════════════════════');
}

analyze().catch(console.error);
