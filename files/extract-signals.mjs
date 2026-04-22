// ReviewIntel v3 — Signal Extractor
// Keyword pass on text-only reviews per provider.
// Produces signal counts and rates used in the editorial analysis layer.
// Run AFTER process.mjs
//
// Usage: node extract-signals.mjs

import fs from 'fs';

// ── Signal definitions ────────────────────────────────────────────────────────
// Each signal has a label, a set of keyword patterns, and a category.
// A review matches a signal if ANY of its patterns match the review text (case-insensitive).
// A review is only counted once per signal even if multiple patterns match.

const SIGNALS = [
  {
    key:      'outcome_positive',
    label:    'Visible fading or result mentioned',
    category: 'outcome',
    patterns: [
      /fad(e|ed|ing)/i,
      /gone/i,
      /complet(e|ed|ely)\s+remov/i,
      /clear(ed|ing|s)/i,
      /result(s)?/i,
      /progress/i,
      /lighter/i,
      /barely\s+visible/i,
      /significant\s+(improvement|fading|result)/i,
      /removed/i,
      /no\s+longer\s+visible/i,
    ],
  },
  {
    key:      'complete_removal',
    label:    'Complete removal mentioned',
    category: 'outcome',
    patterns: [
      /complet(e|ed|ely)\s+remov/i,
      /fully\s+removed/i,
      /completely\s+gone/i,
      /100\s*%\s*removed/i,
      /all\s+gone/i,
      /no\s+trace/i,
    ],
  },
  {
    key:      'cover_up_prep',
    label:    'Cover-up preparation mentioned',
    category: 'outcome',
    patterns: [
      /cover[\s-]?up/i,
      /coverup/i,
      /new\s+tattoo\s+over/i,
      /prep(aring|ared)?\s+for/i,
    ],
  },
  {
    key:      'pmu_removal',
    label:    'PMU / permanent makeup / microblading mentioned',
    category: 'outcome',
    patterns: [
      /pmu/i,
      /permanent\s+make[\s-]?up/i,
      /microblad/i,
      /eyebrow\s+tattoo/i,
      /lip\s+tattoo/i,
      /cosmetic\s+tattoo/i,
    ],
  },
  {
    key:      'pain_mentioned',
    label:    'Pain or discomfort mentioned',
    category: 'experience',
    patterns: [
      /pain(ful)?/i,
      /hurt(s)?/i,
      /uncomfortable/i,
      /sting(s|ing)?/i,
      /sore/i,
      /tender/i,
      /sensation/i,
      /tolerable/i,
      /numbing\s+cream/i,
      /anesthetic/i,
    ],
  },
  {
    key:      'staff_positive',
    label:    'Staff or technician mentioned positively',
    category: 'experience',
    patterns: [
      /staff/i,
      /technician/i,
      /friendly/i,
      /professional/i,
      /knowledgeable/i,
      /helpful/i,
      /kind/i,
      /attentive/i,
      /explained/i,
      /communicated/i,
      /responsive/i,
    ],
  },
  {
    key:      'scarring_mentioned',
    label:    'Scarring or texture change mentioned',
    category: 'concern',
    patterns: [
      /scar(ring|red|s)?/i,
      /texture/i,
      /raised\s+skin/i,
      /marks?\s+left/i,
      /skin\s+damage/i,
      /permanent\s+mark/i,
    ],
  },
  {
    key:      'healing_complication',
    label:    'Healing complication mentioned',
    category: 'concern',
    patterns: [
      /infect(ed|ion)/i,
      /blister(ed|ing|s)?/i,
      /weep(ing)?/i,
      /wound/i,
      /bad\s+reaction/i,
      /didn.t\s+heal/i,
      /slow\s+heal/i,
      /healing\s+issue/i,
    ],
  },
  {
    key:      'billing_complaint',
    label:    'Billing or refund complaint mentioned',
    category: 'concern',
    patterns: [
      /refund/i,
      /billing/i,
      /charge(d|s)?/i,
      /overcharg/i,
      /price\s+change/i,
      /bait\s+and\s+switch/i,
      /didn.t\s+honor/i,
      /dispute/i,
    ],
  },
  {
    key:      'darker_skin',
    label:    'Darker skin tone or Fitzpatrick V-VI mentioned',
    category: 'fit',
    patterns: [
      /dark\s+skin/i,
      /darker\s+skin/i,
      /melanin/i,
      /fitzpatrick/i,
      /skin\s+tone/i,
      /brown\s+skin/i,
      /black\s+skin/i,
      /hypopigment/i,
    ],
  },
  {
    key:      'color_ink',
    label:    'Color ink (non-black) mentioned',
    category: 'fit',
    patterns: [
      /color(ed)?\s+ink/i,
      /colour(ed)?\s+ink/i,
      /yellow\s+ink/i,
      /white\s+ink/i,
      /pastel/i,
      /green\s+ink/i,
      /red\s+ink/i,
      /blue\s+ink/i,
      /multicolor/i,
      /colou?r(ful)?\s+tattoo/i,
    ],
  },
  {
    key:      'session_count_mentioned',
    label:    'Session count or timeline mentioned',
    category: 'logistics',
    patterns: [
      /session(s)?/i,
      /treatment(s)?/i,
      /appointment(s)?/i,
      /\d+\s+(session|treatment|visit)/i,
      /few\s+session/i,
      /multiple\s+session/i,
    ],
  },
  {
    key:      'prior_laser_failed',
    label:    'Prior laser treatment mentioned as failed or insufficient',
    category: 'fit',
    patterns: [
      /laser\s+didn.t\s+work/i,
      /laser\s+failed/i,
      /tried\s+laser/i,
      /previous\s+laser/i,
      /laser\s+wasn.t\s+working/i,
      /after\s+laser\s+(treatment|removal)/i,
      /laser\s+couldn.t/i,
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadJSON(filepath) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf8')); }
  catch { return null; }
}

function getSummaryFiles() {
  return fs.readdirSync('.').filter(f => f.startsWith('provider-summary-') && f.endsWith('.json'));
}

function matchesSignal(text, signal) {
  return signal.patterns.some(pattern => pattern.test(text));
}

function extractSignals(textReviews) {
  const results = {};
  for (const signal of SIGNALS) {
    const matched = textReviews.filter(r => matchesSignal(r.review_text, signal));
    results[signal.key] = {
      label:       signal.label,
      category:    signal.category,
      count:       matched.length,
      total:       textReviews.length,
      rate_pct:    textReviews.length > 0
                     ? parseFloat(((matched.length / textReviews.length) * 100).toFixed(1))
                     : 0,
    };
  }
  return results;
}

// ── Editorial summary builder ─────────────────────────────────────────────────
// Produces the human-readable counts used in the editorial layer.
// e.g. "133 of 147 reviews describe visible fading or a clear result"
function buildEditorialSummary(signals, totalTextReviews, totalAllReviews) {
  const s = signals;
  return {
    // Outcome signals
    outcome_positive:    `${s.outcome_positive.count} of ${totalAllReviews} reviews describe visible fading or a clear result`,
    complete_removal:    `${s.complete_removal.count} of ${totalAllReviews} reviews mention complete removal`,
    cover_up_prep:       `${s.cover_up_prep.count} of ${totalAllReviews} reviews mention cover-up preparation`,
    pmu_removal:         `${s.pmu_removal.count} of ${totalAllReviews} reviews mention PMU or permanent makeup removal`,
    // Staff
    staff_positive:      `${s.staff_positive.count} of ${totalAllReviews} reviews mention technicians or staff positively`,
    // Concerns
    pain_mentioned:      `${s.pain_mentioned.count} of ${totalAllReviews} reviews mention pain or discomfort`,
    scarring_mentioned:  `${s.scarring_mentioned.count} of ${totalAllReviews} reviews mention scarring or texture changes`,
    healing_complication:`${s.healing_complication.count} of ${totalAllReviews} reviews mention healing complications`,
    billing_complaint:   `${s.billing_complaint.count} of ${totalAllReviews} reviews mention billing or refund issues`,
    // Fit signals
    darker_skin:         `${s.darker_skin.count} of ${totalAllReviews} reviews mention darker skin tone`,
    color_ink:           `${s.color_ink.count} of ${totalAllReviews} reviews mention color ink`,
    prior_laser_failed:  `${s.prior_laser_failed.count} of ${totalAllReviews} reviews mention prior laser treatment that didn't work`,
    // Note: editorial totals use totalAllReviews (includes star-only) for consistency with published page numbers
    // Signal extraction runs only on text reviews — rates use textReviews as denominator
    _note: `Signal counts use ${totalTextReviews} text reviews as extraction base. Editorial summaries reference ${totalAllReviews} total reviews for page consistency.`,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
function extract() {
  console.log(`\nReviewIntel v3 — Signal Extractor\n`);

  const files = getSummaryFiles();
  if (!files.length) {
    console.error('No provider-summary-*.json files found. Run process.mjs first.');
    process.exit(1);
  }

  console.log(`Found ${files.length} provider summary file(s)...\n`);

  for (const file of files.sort()) {
    const summary = loadJSON(file);
    if (!summary) { console.warn(`  Could not load ${file} — skipped`); continue; }

    const allReviews = summary.reviews || [];
    const textReviews = allReviews.filter(r => r.review_text && r.review_text.trim() !== '');

    if (!textReviews.length) {
      console.warn(`  [${summary.provider_name}] No text reviews — skipped signal extraction`);
      continue;
    }

    const signals = extractSignals(textReviews);
    const editorial = buildEditorialSummary(signals, textReviews.length, allReviews.length);

    // Attach to summary and save
    summary.signals = signals;
    summary.editorial_summary = editorial;
    summary.signals_extracted_at = new Date().toISOString();

    fs.writeFileSync(file, JSON.stringify(summary, null, 2));

    console.log(`  ✓ ${summary.provider_name} (${allReviews.length} total / ${textReviews.length} text reviews)`);

    // Print key editorial signals
    const s = signals;
    console.log(`    Outcome positive:     ${s.outcome_positive.count} (${s.outcome_positive.rate_pct}%)`);
    console.log(`    Staff positive:       ${s.staff_positive.count} (${s.staff_positive.rate_pct}%)`);
    console.log(`    Pain mentioned:       ${s.pain_mentioned.count} (${s.pain_mentioned.rate_pct}%)`);
    console.log(`    Scarring mentioned:   ${s.scarring_mentioned.count} (${s.scarring_mentioned.rate_pct}%)`);
    console.log(`    Billing complaint:    ${s.billing_complaint.count} (${s.billing_complaint.rate_pct}%)`);
    console.log(`    Healing complication: ${s.healing_complication.count} (${s.healing_complication.rate_pct}%)`);
    console.log(`    Color ink:            ${s.color_ink.count} (${s.color_ink.rate_pct}%)`);
    console.log(`    Prior laser failed:   ${s.prior_laser_failed.count} (${s.prior_laser_failed.rate_pct}%)`);
    console.log('');
  }

  console.log('══════════════════════════════════════════');
  console.log('Signal extraction complete.');
  console.log('Signals and editorial summaries written back into provider-summary-*.json files.');
  console.log('provider-summary-*.json files are ready for Supabase import.');
  console.log('══════════════════════════════════════════\n');
}

extract();
