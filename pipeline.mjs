#!/usr/bin/env node
/**
 * ReviewIntel — Full Pipeline Orchestrator
 *
 * Runs all steps in sequence:
 *   1. Scrape    — incremental Google review fetch (SerpAPI)
 *   2. Analyze   — AI analysis of new reviews only (Anthropic)
 *   3. Dates     — convert relative dates to ISO
 *   4. Separate  — bucket inkOUT reviews (Python separator)
 *   5. Import    — upsert all reviews to Supabase
 *   6. Classify  — tag is_tattoo_removal on competitor reviews (keyword + LLM)
 *
 * Usage:
 *   node pipeline.mjs                  # full run
 *   node pipeline.mjs --dry-run        # all steps but no Supabase writes; produces diff CSV
 *   node pipeline.mjs --skip-llm       # skip step 6 (relevance classification)
 *   node pipeline.mjs --step=scrape    # run a single step
 *
 * All keys read from .env in this directory.
 */

import fs   from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env ────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env not found');
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  }
}

loadEnv();

const REQUIRED_KEYS = {
  SERPAPI_KEY:          'Step 1 (scrape)',
  ANTHROPIC_API_KEY:    'Step 2 (analyze) + Step 4 (separate)',
  SUPABASE_SERVICE_KEY: 'Step 5 (import)',
};

// ── Args ─────────────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const DRY_RUN      = args.includes('--dry-run');
const SKIP_LLM     = args.includes('--skip-llm');
const ONLY_STEP    = args.find(a => a.startsWith('--step='))?.split('=')[1] ?? null;
const ONLY_PROVIDER = args.find(a => a.startsWith('--provider='))?.split('=')[1] ?? null;
const FORCE        = args.includes('--force');

// ── Every-other-week guard ────────────────────────────────────────────────────
// First scheduled run: 2026-04-26 (Sunday). Runs every 2 weeks from that date.
// Pass --force to override (e.g. for manual runs).
const FIRST_RUN = new Date('2026-04-26T00:00:00');
function isRunWeek() {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceFirst = Math.floor((Date.now() - FIRST_RUN.getTime()) / msPerWeek);
  return weeksSinceFirst >= 0 && weeksSinceFirst % 2 === 0;
}
if (!FORCE && !ONLY_STEP && !isRunWeek()) {
  console.log(`[${new Date().toISOString()}] Off-week — skipping. Use --force to override.`);
  process.exit(0);
}

// ── Logging ──────────────────────────────────────────────────────────────────
const logsDir  = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
const runId    = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const logFile  = path.join(logsDir, `pipeline-${runId}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(...msgs) {
  const line = `[${new Date().toISOString()}] ${msgs.join(' ')}`;
  console.log(line);
  logStream.write(line + '\n');
}

function logSection(title) {
  const bar = '═'.repeat(50);
  log(`\n${bar}`);
  log(`  ${title}`);
  log(bar);
}

// ── Step runner ───────────────────────────────────────────────────────────────
function run(label, cmd, opts = {}) {
  log(`▶ ${label}`);
  log(`  $ ${cmd}`);
  try {
    const out = execSync(cmd, {
      cwd:      __dirname,
      env:      process.env,
      encoding: 'utf8',
      stdio:    ['pipe', 'pipe', 'pipe'],
      ...opts,
    });
    if (out) {
      for (const line of out.trim().split('\n')) log(`  ${line}`);
    }
    log(`✓ ${label} complete`);
    return out;
  } catch (e) {
    const stderr = e.stderr || '';
    const stdout = e.stdout || '';
    log(`✗ ${label} FAILED`);
    if (stdout) for (const line of stdout.trim().split('\n')) log(`  stdout: ${line}`);
    if (stderr) for (const line of stderr.trim().split('\n')) log(`  stderr: ${line}`);
    throw new Error(`Step failed: ${label}`);
  }
}

function shouldRun(step) {
  return !ONLY_STEP || ONLY_STEP === step;
}

// ── Pipeline dry-run diff ─────────────────────────────────────────────────────
// Runs after Step 4 (separator) when --dry-run is set.
// Compares proposed routing (from bucket_lookup.json) against current Supabase state.
// Keyword-only relevance check; LLM changes flagged as skipped.

const CONFIRM_REMOVAL_KW = [
  'tattoo removal','remove tattoo','removed tattoo','removing tattoo',
  'tattoo laser','laser tattoo','laser removal','removal session',
  'tattoo session','tattoo fading','tattoo faded','tattoo gone',
  'tattoo is fading','tattoo is gone','tattoo is removed',
  'removal treatment','removal process','tattoo treatment',
  'tatt2away','inkout','ink-out',
  'picosure','picoway','revlite','enlighten laser',
  'q-switch','q switch','nd:yag',
  'tattoo appointment','tattoo procedure',
];
const NON_REMOVAL_KW = [
  'lip filler','lip flip','lip augmentation','lip injection',
  'sculptra','juvederm','restylane','kybella','radiesse','belotero',
  'microneedling','micro needling','micro-needling',
  'laser hair removal','laser hair','hair removal',
  'ear piercing','nose piercing','body piercing','ear pierced','nose pierced',
  'got pierced','had pierced',
  'botox','dysport','xeomin','botulinum',
  'hydrafacial','hydra facial','hydra-facial',
  'microblading','micro blading','permanent makeup',
  'coolsculpting','cool sculpting','cryolipolysis',
  'chemical peel','dermaplaning','dermaplane',
  'iv therapy','iv drip','iv infusion',
  'dermal filler','filler injection',
  'lash lift','lash extension','eyelash extension',
  'prp injection','prp treatment','platelet-rich',
  'lip plump','lip volume','sculptra treatment',
];

function kwRelevance(row) {
  if (!row.has_text || !row.review_text) return { value: false, reason: 'no_text' };
  if (row.brand_name === 'inkOUT') return { value: true, reason: 'auto_true_brand_inkout' };
  if (row.result_rating && row.result_rating !== 'unknown') return { value: true, reason: 'auto_true_result_rating' };
  const t = (row.review_text || '').toLowerCase();
  if (CONFIRM_REMOVAL_KW.some(k => t.includes(k))) return { value: true, reason: 'keyword_confirm' };
  if (t.includes('tattoo')) return { value: true, reason: 'keyword_tattoo' };
  if (NON_REMOVAL_KW.some(k => t.includes(k))) return { value: false, reason: 'keyword_deny' };
  return { value: null, reason: 'llm_skipped_in_dry_run' };
}

// Normalize ISO timestamp to Z-suffix format for key matching across sources
function normalizeIso(s) {
  if (!s) return s;
  return s.replace(/\+00:00$/, 'Z');
}

async function fetchSupabaseRows(serviceKey) {
  const url = 'https://rxrhvbfutjahgwaambqd.supabase.co/rest/v1/competitor_reviews'
    + '?select=id,reviewer_name,review_date_iso,location_city,location_state,provider_name,bucket,routing_reason,is_tattoo_removal,has_text,review_text,result_rating,brand_name'
    + '&status=eq.published&limit=2000';
  const res = await fetch(url, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase fetch: ${res.status} ${await res.text()}`);
  return res.json();
}

function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

async function dryRunDiff() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csvPath = path.join(__dirname, `output/pipeline_dry_run_${ts}.csv`);

  log('\n── Pipeline dry-run diff ────────────────────────────────────────');

  // Load proposed state from separator output
  const bucketLookupPath = path.join(__dirname, 'output/bucket_lookup.json');
  if (!fs.existsSync(bucketLookupPath)) {
    log('  SKIPPED: output/bucket_lookup.json not found (run Step 4 first)');
    return;
  }
  const lookup = JSON.parse(fs.readFileSync(bucketLookupPath, 'utf8'));

  // Load analyzed JSON for review metadata
  const analyzedPath = path.join(__dirname, 'data/analyzed/analyzed-v4-all-dated.json');
  const analyzed = JSON.parse(fs.readFileSync(analyzedPath, 'utf8'));
  const analyzedByKey = new Map();
  for (const r of analyzed) {
    const key = `${r.reviewer_name}|${r.review_date_iso}|${r.location_city}`;
    analyzedByKey.set(key, r);
  }

  // Fetch current Supabase state
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const currentRows = await fetchSupabaseRows(serviceKey);
  const currentByKey = new Map();
  for (const r of currentRows) {
    const key = `${r.reviewer_name}|${normalizeIso(r.review_date_iso)}|${r.location_city}`;
    currentByKey.set(key, r);
  }

  const diffRows = [];
  let newScrapeCount = 0, bucketChangeCount = 0, relevanceChangeCount = 0, unchangedCount = 0;

  for (const [key, entry] of Object.entries(lookup)) {
    const proposed = typeof entry === 'string' ? { bucket: entry, routing_reason: null } : entry;
    const current = currentByKey.get(key);
    const meta = analyzedByKey.get(key);

    const isNew = !current;
    if (isNew) newScrapeCount++;

    const currentBucket = current?.bucket ?? null;
    const proposedBucket = proposed.bucket;
    const currentReason = current?.routing_reason ?? null;
    const proposedReason = proposed.routing_reason ?? null;
    const bucketChanged = currentBucket !== proposedBucket;
    if (bucketChanged && !isNew) bucketChangeCount++;

    // Keyword-only relevance for dry-run
    const relevRow = meta || current;
    const { value: proposedRelevance, reason: relevReason } = relevRow ? kwRelevance(relevRow) : { value: null, reason: null };
    const currentRelevance = current?.is_tattoo_removal ?? null;
    const relevanceChanged = currentRelevance !== proposedRelevance && proposedRelevance !== null && !isNew;
    if (relevanceChanged) relevanceChangeCount++;

    if (!isNew && !bucketChanged && !relevanceChanged) { unchangedCount++; continue; }

    const reasons = [];
    if (isNew) reasons.push('new_scrape');
    if (bucketChanged && !isNew) reasons.push('bucket_change');
    if (relevanceChanged) reasons.push('relevance_resolved');

    const provider = meta
      ? `${meta.provider_name} (${meta.location_city}, ${meta.location_state})`
      : (current ? `${current.provider_name} (${current.location_city}, ${current.location_state})` : key);

    const preview = (meta?.review_text || current?.review_text || '').slice(0, 120).replace(/\n/g, ' ');

    diffRows.push({
      review_id:                  current?.id ?? 'NEW',
      provider,
      current_bucket:             currentBucket ?? '',
      proposed_bucket:            proposedBucket,
      current_routing_reason:     currentReason ?? '',
      proposed_routing_reason:    proposedReason ?? '',
      current_is_tattoo_removal:  currentRelevance ?? '',
      proposed_is_tattoo_removal: proposedRelevance ?? relevReason ?? '',
      reason_for_change:          reasons.join('; '),
      review_text_preview:        preview,
    });
  }

  // Write CSV
  const headers = [
    'review_id','provider','current_bucket','proposed_bucket',
    'current_routing_reason','proposed_routing_reason',
    'current_is_tattoo_removal','proposed_is_tattoo_removal',
    'reason_for_change','review_text_preview',
  ];
  const lines = [headers.join(',')];
  for (const row of diffRows) {
    lines.push(headers.map(h => escapeCsv(row[h])).join(','));
  }
  fs.mkdirSync(path.join(__dirname, 'output'), { recursive: true });
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');

  // Print summary
  log('\n  Dry-run diff summary:');
  log(`    New reviews (would be added):       ${newScrapeCount}`);
  log(`    Bucket changes (existing rows):     ${bucketChangeCount}`);
  log(`    Relevance resolved (keyword-only):  ${relevanceChangeCount}`);
  log(`    Unchanged:                          ${unchangedCount}`);
  log(`    Total writes avoided:               ${newScrapeCount + bucketChangeCount + relevanceChangeCount}`);
  log(`    LLM relevance step:                 SKIPPED in dry-run — run without --dry-run to classify`);
  log(`\n  Full diff saved → ${csvPath}`);

  if (diffRows.length > 0) {
    log('\n  Sample (first 10 changed rows):');
    for (const r of diffRows.slice(0, 10)) {
      log(`    [${r.reason_for_change}] ${r.provider}`);
      log(`      bucket: ${r.current_bucket || '(new)'} → ${r.proposed_bucket}  reason: ${r.proposed_routing_reason || '—'}`);
    }
  }
}

// ── Supabase null-count helper ────────────────────────────────────────────────
async function countNullRelevance() {
  const url = 'https://rxrhvbfutjahgwaambqd.supabase.co/rest/v1/competitor_reviews'
    + '?select=id&is_tattoo_removal=is.null&status=eq.published';
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'count=exact',
      'Range-Unit': 'items',
      'Range': '0-0',
    },
  });
  const range = res.headers.get('content-range') || '';
  const match = range.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  logSection(`ReviewIntel Pipeline — ${runId}${DRY_RUN ? ' [DRY RUN]' : ''}`);
  log(`Log file: ${logFile}`);

  // Validate required keys
  const missing = Object.entries(REQUIRED_KEYS)
    .filter(([key]) => !process.env[key])
    .map(([key, step]) => `  ${key} (needed for ${step})`);
  if (missing.length) {
    log(`\nERROR: Missing keys in .env:\n${missing.join('\n')}`);
    process.exit(1);
  }

  const started = Date.now();
  let newReviews = 0;

  try {
    // ── Step 1: Scrape ────────────────────────────────────────────────────
    if (shouldRun('scrape')) {
      logSection('Step 1 — Scrape (incremental)');
      const providerFlag = ONLY_PROVIDER ? ` --provider=${ONLY_PROVIDER}` : '';
      const out = run(
        'scrape-v4.mjs',
        `node pipeline/scrape-v4.mjs --mode=incremental${providerFlag}`
      );
      const match = out?.match(/(\d+) new reviews fetched/g);
      if (match) {
        newReviews = match.reduce((sum, m) => sum + parseInt(m), 0);
        log(`  Total new reviews across all providers: ${newReviews}`);
      }
    }

    // ── Step 2: Analyze ───────────────────────────────────────────────────
    // AI fields (result_rating, pain_level, etc.) are patched by Qwen post-import.
    if (shouldRun('analyze')) {
      logSection('Step 2 — Analyze (new reviews only, AI skipped — Qwen handles it)');
      const inputFile = ONLY_PROVIDER
        ? `data/reviews/reviews-v4-${ONLY_PROVIDER}.json`
        : 'data/reviews/reviews-v4-all.json';
      run(
        'analyze-v4.mjs',
        `node pipeline/analyze-v4.mjs ${inputFile} --mode=incremental --skip-ai`
      );
    }

    // ── Step 3: Convert dates ─────────────────────────────────────────────
    if (shouldRun('dates')) {
      logSection('Step 3 — Convert relative dates');
      run('convert-dates.mjs', `node pipeline/convert-dates.mjs`);
    }

    // ── Step 4: Separate inkOUT reviews ──────────────────────────────────
    if (shouldRun('separate')) {
      logSection('Step 4 — Separate inkOUT reviews');
      run(
        'separator',
        `python3 separator/run.py --input "data/analyzed/analyzed-v4-all-dated.json" --output-dir output`
      );
    }

    // ── Dry-run diff (after separator, before import) ─────────────────────
    if (DRY_RUN && shouldRun('separate')) {
      await dryRunDiff();
    }

    // ── Step 5: Import to Supabase ────────────────────────────────────────
    if (shouldRun('import') && !DRY_RUN) {
      logSection('Step 5 — Import to Supabase');
      const providerFlag = ONLY_PROVIDER ? ` --provider=${ONLY_PROVIDER}` : '';
      run(
        'import-to-supabase-v4.mjs',
        `node pipeline/import-to-supabase-v4.mjs --status=published${providerFlag}`
      );
    } else if (DRY_RUN) {
      log('Step 5 — Supabase import SKIPPED (dry-run)');
    }

    // ── Step 6: Classify relevance ────────────────────────────────────────
    if (shouldRun('classify') && !DRY_RUN) {
      if (SKIP_LLM) {
        log('Step 6 — Relevance classification SKIPPED (--skip-llm)');
      } else {
        logSection('Step 6 — Classify relevance (is_tattoo_removal)');
        const nullBefore = await countNullRelevance();
        log(`  null before: ${nullBefore ?? '?'}`);
        run(
          'classify-relevance.mjs',
          `node pipeline/classify-relevance.mjs --llm --write`
        );
        const nullAfter = await countNullRelevance();
        const resolved = nullBefore != null && nullAfter != null
          ? nullBefore - nullAfter : '?';
        log(`  null after:  ${nullAfter ?? '?'}`);
        log(`  resolved:    ${resolved}`);
      }
    } else if (DRY_RUN) {
      log('Step 6 — Relevance classification SKIPPED (dry-run)');
    }

    // ── Done ──────────────────────────────────────────────────────────────
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    logSection(`Pipeline complete — ${elapsed}s`);
    if (fs.existsSync(path.join(__dirname, 'output/summary.txt'))) {
      log('\n' + fs.readFileSync(path.join(__dirname, 'output/summary.txt'), 'utf8'));
    }

  } catch (e) {
    logSection('Pipeline FAILED');
    log(e.message);
    log(`Log saved → ${logFile}`);
    process.exit(1);
  }

  log(`Log saved → ${logFile}`);
}

main();
