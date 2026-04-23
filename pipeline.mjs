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
 *
 * Usage:
 *   node pipeline.mjs                  # full run
 *   node pipeline.mjs --dry-run        # scrape + analyze only, no Supabase write
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
const args      = process.argv.slice(2);
const DRY_RUN   = args.includes('--dry-run');
const ONLY_STEP = args.find(a => a.startsWith('--step='))?.split('=')[1] ?? null;
const FORCE     = args.includes('--force');

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
      const out = run(
        'scrape-v4.mjs',
        `node scrape-v4.mjs --mode=incremental`
      );
      const match = out?.match(/(\d+) new reviews fetched/g);
      if (match) {
        newReviews = match.reduce((sum, m) => sum + parseInt(m), 0);
        log(`  Total new reviews across all providers: ${newReviews}`);
      }
    }

    // ── Step 2: Analyze ───────────────────────────────────────────────────
    if (shouldRun('analyze')) {
      logSection('Step 2 — Analyze (new reviews only)');
      run(
        'analyze-v4.mjs',
        `node analyze-v4.mjs reviews-v4-all.json --mode=incremental`
      );
    }

    // ── Step 3: Convert dates ─────────────────────────────────────────────
    if (shouldRun('dates')) {
      logSection('Step 3 — Convert relative dates');
      run('convert-dates.mjs', `node convert-dates.mjs`);
    }

    // ── Step 4: Separate inkOUT reviews ──────────────────────────────────
    if (shouldRun('separate')) {
      logSection('Step 4 — Separate inkOUT reviews');
      run(
        'separator',
        `python3 separator/run.py --input "analyzed-v4-all-dated.json" --output-dir output`
      );
    }

    // ── Step 5: Import to Supabase ────────────────────────────────────────
    if (shouldRun('import') && !DRY_RUN) {
      logSection('Step 5 — Import to Supabase');
      run(
        'import-to-supabase-v4.mjs',
        `node import-to-supabase-v4.mjs --status=published`
      );
    } else if (DRY_RUN) {
      log('Step 5 — Supabase import SKIPPED (dry-run)');
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
