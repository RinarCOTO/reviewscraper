#!/usr/bin/env node
/**
 * Ollama Golden Dataset Test Runner
 * 
 * Pulls 63 diverse reviews from Supabase, runs them through Qwen via Ollama,
 * then compares against Claude's existing analysis.
 * 
 * Prerequisites:
 *   1. npm install @supabase/supabase-js
 *   2. ollama pull qwen2.5:14b
 *   3. ollama serve (running in background)
 *   4. Set env vars: SUPABASE_URL, SUPABASE_KEY
 * 
 * Usage:
 *   SUPABASE_URL=https://rxrhvbfutjahgwaambqd.supabase.co \
 *   SUPABASE_KEY=your-anon-key \
 *   node ollama-test-runner.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

// ─── CONFIG ───
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'qwen2.5:14b';
const SUPABASE_PROJECT_ID = 'rxrhvbfutjahgwaambqd';

const supabase = createClient(
  process.env.SUPABASE_URL || `https://${SUPABASE_PROJECT_ID}.supabase.co`,
  process.env.SUPABASE_KEY
);

// ─── PROMPT ───
const SYSTEM_PROMPT = readFileSync(
  new URL('./qwen-analyzer-prompt.txt', import.meta.url), 
  'utf-8'
);

// ─── STEP 1: Pull golden dataset ───
async function pullGoldenDataset() {
  console.log('\n📥 Pulling golden dataset from Supabase...');
  
  const { data, error } = await supabase.rpc('', {}).then(() => null).catch(() => null);
  
  // Use raw SQL via PostgREST isn't possible, so we pull all and sample in JS
  const { data: reviews, error: fetchError } = await supabase
    .from('competitor_reviews')
    .select('id, brand_name, location_city, star_rating, review_text, review_summary, result_rating, pain_level, scarring_mentioned, sessions_completed, skin_type, use_case')
    .eq('has_text', true)
    .not('review_text', 'is', null)
    .order('brand_name')
    .order('location_city');

  if (fetchError) {
    console.error('❌ Supabase error:', fetchError.message);
    process.exit(1);
  }

  // Sample 3 per provider/city combo, prioritizing diverse star ratings
  const groups = {};
  for (const r of reviews) {
    if (!r.review_text || r.review_text.length <= 20) continue;
    const key = `${r.brand_name || 'null'}|${r.location_city}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  const sampled = [];
  for (const [key, group] of Object.entries(groups)) {
    // Sort: 1-star first, then 3-star, then 5-star, then rest
    group.sort((a, b) => {
      const priority = (s) => s === 1 ? 0 : s === 3 ? 1 : s === 5 ? 2 : 3;
      return priority(a.star_rating) - priority(b.star_rating);
    });
    sampled.push(...group.slice(0, 3));
  }

  console.log(`   ✅ Pulled ${sampled.length} reviews across ${Object.keys(groups).length} provider/city combos`);
  
  // Save ground truth
  writeFileSync('claude-golden.json', JSON.stringify(sampled, null, 2));
  console.log('   💾 Saved claude-golden.json');
  
  return sampled;
}

// ─── STEP 2: Run Ollama on each review ───
async function runOllama(reviews) {
  console.log(`\n🤖 Running ${MODEL} on ${reviews.length} reviews...`);
  
  const results = [];
  let success = 0;
  let parseErrors = 0;

  for (let i = 0; i < reviews.length; i++) {
    const review = reviews[i];
    const prompt = SYSTEM_PROMPT.replace('{{REVIEW_TEXT}}', review.review_text);
    
    process.stdout.write(`   [${i + 1}/${reviews.length}] ${(review.brand_name || 'unknown').substring(0, 20).padEnd(20)} `);

    try {
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          prompt,
          stream: false,
          options: { temperature: 0 }
        })
      });

      const data = await response.json();
      let parsed;
      
      try {
        // Clean response — strip markdown fences if present
        let cleaned = data.response.trim();
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
        parsed = JSON.parse(cleaned);
      } catch (e) {
        console.log('⚠️  JSON parse error');
        parseErrors++;
        parsed = {
          result_rating: 'PARSE_ERROR',
          pain_level: 'PARSE_ERROR',
          scarring_mentioned: 'PARSE_ERROR',
          sessions_completed: 'PARSE_ERROR',
          skin_type: 'PARSE_ERROR',
          use_case: 'PARSE_ERROR',
          review_summary: data.response.substring(0, 200)
        };
      }

      results.push({
        id: review.id,
        ...parsed
      });
      
      if (parsed.result_rating !== 'PARSE_ERROR') {
        success++;
        console.log(`✅ ${parsed.result_rating}`);
      }

    } catch (e) {
      console.log(`❌ ${e.message}`);
      results.push({
        id: review.id,
        result_rating: 'ERROR',
        pain_level: 'ERROR',
        scarring_mentioned: 'ERROR',
        sessions_completed: 'ERROR',
        skin_type: 'ERROR',
        use_case: 'ERROR',
        review_summary: e.message
      });
    }
  }

  console.log(`\n   ✅ Completed: ${success} success, ${parseErrors} parse errors, ${reviews.length - success - parseErrors} failures`);
  
  writeFileSync('qwen-results.json', JSON.stringify(results, null, 2));
  console.log('   💾 Saved qwen-results.json');
  
  return results;
}

// ─── STEP 3: Compare ───
function compare(claude, qwen) {
  console.log('\n📊 Comparing results...\n');

  const FIELDS = [
    'result_rating',
    'pain_level',
    'scarring_mentioned',
    'sessions_completed',
    'skin_type',
    'use_case'
  ];

  const results = {};
  const disagreements = [];

  for (const field of FIELDS) {
    results[field] = { match: 0, mismatch: 0, total: 0 };
  }

  for (const claudeRow of claude) {
    const qwenRow = qwen.find(q => q.id === claudeRow.id);
    if (!qwenRow) continue;

    for (const field of FIELDS) {
      const cVal = String(claudeRow[field] || 'unknown').trim().toLowerCase();
      const qVal = String(qwenRow[field] || 'unknown').trim().toLowerCase();

      results[field].total++;

      if (cVal === qVal) {
        results[field].match++;
      } else {
        results[field].mismatch++;
        disagreements.push({
          id: claudeRow.id,
          brand: claudeRow.brand_name,
          city: claudeRow.location_city,
          field,
          claude: claudeRow[field],
          qwen: qwenRow[field],
          review_snippet: (claudeRow.review_text || '').substring(0, 120)
        });
      }
    }
  }

  // Print field-by-field results
  console.log('Field'.padEnd(25), 'Match'.padEnd(8), 'Miss'.padEnd(8), 'Agreement');
  console.log('─'.repeat(55));

  for (const field of FIELDS) {
    const r = results[field];
    const pct = r.total > 0 ? ((r.match / r.total) * 100).toFixed(1) : '0.0';
    const icon = pct >= 90 ? '✅' : pct >= 80 ? '⚠️' : '❌';
    console.log(
      field.padEnd(25),
      String(r.match).padEnd(8),
      String(r.mismatch).padEnd(8),
      `${pct}% ${icon}`
    );
  }

  // Print disagreements grouped by field
  if (disagreements.length > 0) {
    console.log(`\n📋 DISAGREEMENTS (${disagreements.length} total)\n`);

    for (const field of FIELDS) {
      const fieldDisagreements = disagreements.filter(d => d.field === field);
      if (fieldDisagreements.length === 0) continue;

      console.log(`── ${field} (${fieldDisagreements.length} disagreements) ──`);
      for (const d of fieldDisagreements.slice(0, 5)) {
        console.log(`  Claude: ${d.claude}  |  Qwen: ${d.qwen}`);
        console.log(`  "${d.review_snippet}..."`);
        console.log();
      }
      if (fieldDisagreements.length > 5) {
        console.log(`  ... and ${fieldDisagreements.length - 5} more\n`);
      }
    }
  }

  // Overall
  const totalMatch = Object.values(results).reduce((s, r) => s + r.match, 0);
  const totalAll = Object.values(results).reduce((s, r) => s + r.total, 0);
  const overallPct = totalAll > 0 ? ((totalMatch / totalAll) * 100).toFixed(1) : '0.0';

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`OVERALL: ${overallPct}% agreement across ${totalAll} field comparisons`);
  console.log(
    overallPct >= 90 ? '✅ PASS — Qwen is ready for production' :
    overallPct >= 80 ? '⚠️ MARGINAL — review disagreements, tune prompt' :
    '❌ FAIL — needs prompt tuning or bigger model'
  );
  console.log(`${'═'.repeat(55)}\n`);

  // Save full comparison
  writeFileSync('comparison-report.json', JSON.stringify({
    summary: { overallPct, totalMatch, totalAll },
    fieldResults: results,
    disagreements
  }, null, 2));
  console.log('💾 Saved comparison-report.json\n');
}

// ─── MAIN ───
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Ollama Golden Dataset Test Runner       ║');
  console.log('║  Model: ' + MODEL.padEnd(32) + '║');
  console.log('╚══════════════════════════════════════════╝');

  if (!process.env.SUPABASE_KEY) {
    console.error('\n❌ Missing SUPABASE_KEY env var. Set it and retry.');
    process.exit(1);
  }

  // Check Ollama is running
  try {
    await fetch('http://localhost:11434/api/tags');
  } catch (e) {
    console.error('\n❌ Ollama not running. Start it with: ollama serve');
    process.exit(1);
  }

  const golden = await pullGoldenDataset();
  const qwenResults = await runOllama(golden);
  compare(golden, qwenResults);
}

main().catch(console.error);
