import { readFileSync, writeFileSync, readdirSync } from 'fs';

const SCRAPE_DATE = new Date();
const SCRAPE_LABEL = SCRAPE_DATE.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const INPUT_FILE = './analyzed-v4-all.json';
const OUTPUT_FILE = './analyzed-v4-all-dated.json';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// Takes a relative string like "8 months ago" or "2 years ago"
// Returns { estimated: "2025-08", label: "~Aug 2025 (estimated...)" }
// Returns null if the string cannot be parsed
function convertRelativeDate(raw) {
  if (!raw || raw.trim() === '') return null;

  const clean = raw.replace(/^Edited\s+/i, '').trim();
  const wasEdited = /^Edited\s+/i.test(raw);

  let monthsBack = null;
  let daysBack = null;

  const monthMatch = clean.match(/^(\d+)\s+months? ago$/i);
  const aMonthMatch = clean.match(/^a month ago$/i);
  const yearMatch = clean.match(/^(\d+)\s+years? ago$/i);
  const aYearMatch = clean.match(/^a year ago$/i);
  const weekMatch = clean.match(/^(\d+)\s+weeks? ago$/i);
  const aWeekMatch = clean.match(/^a week ago$/i);
  const dayMatch = clean.match(/^(\d+)\s+days? ago$/i);
  const aDayMatch = clean.match(/^a day ago$/i);
  const hoursMatch = clean.match(/^(\d+)\s+hours? ago$/i);
  const anHourMatch = clean.match(/^an? hour ago$/i);

  if (aMonthMatch) monthsBack = 1;
  else if (monthMatch) monthsBack = parseInt(monthMatch[1], 10);
  else if (aYearMatch) monthsBack = 12;
  else if (yearMatch) monthsBack = parseInt(yearMatch[1], 10) * 12;
  else if (aWeekMatch) daysBack = 7;
  else if (weekMatch) daysBack = parseInt(weekMatch[1], 10) * 7;
  else if (aDayMatch) daysBack = 1;
  else if (dayMatch) daysBack = parseInt(dayMatch[1], 10);
  else if (anHourMatch) daysBack = 0;
  else if (hoursMatch) daysBack = 0;

  if (monthsBack === null && daysBack === null) return null;

  const target = new Date(SCRAPE_DATE);
  if (monthsBack !== null) {
    target.setMonth(target.getMonth() - monthsBack);
  } else {
    target.setDate(target.getDate() - daysBack);
  }

  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const mon = MONTH_NAMES[target.getMonth()];

  const editNote = wasEdited ? ', review was edited' : '';
  const label = `~${mon} ${yyyy} (estimated from "${raw}", scraped ${SCRAPE_LABEL}${editNote})`;

  return {
    estimated: `${yyyy}-${mm}`,
    label
  };
}

const reviews = JSON.parse(readFileSync(INPUT_FILE, 'utf8'));

// Brand mapping: normalizes multi-location providers to a single brand name
const BRAND_MAP = {
  'Removery (Bucktown)': 'Removery',
  'Removery (Lincoln Square)': 'Removery',
  'Removery (South Congress)': 'Removery',
  'Tatt2Away': 'Tatt2Away',
  'inkOUT': 'inkOUT',
  'inkout': 'inkOUT'
};
function getBrand(providerName) {
  return BRAND_MAP[providerName] || providerName;
}

// Build lookup of pre-Tatt2Away reviews so we can flag them in the main dataset
const PRE_FILES = [
  './reviews-v3-inkout-austin-tx.pretatt2away.json',
  './reviews-v3-inkout-chicago-il.pretatt2away.json',
  './reviews-v3-inkout-draper-ut.pretatt2away.json',
  './reviews-v3-inkout-houston-tx.pretatt2away.json'
];
const transitionSet = new Set();
for (const f of PRE_FILES) {
  try {
    const pre = JSON.parse(readFileSync(f, 'utf8'));
    pre.forEach(r => transitionSet.add(r.reviewer_name + '|' + r.location_city + '|' + r.review_date));
  } catch (_) {}
}

let verified = 0;
let converted = 0;
let unparseable = 0;

function fromIso(iso) {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mon = MONTH_NAMES[d.getUTCMonth()];
  return {
    estimated: `${yyyy}-${mm}-${dd}`,
    label: `${mon} ${dd}, ${yyyy} (verified from SerpAPI iso_date)`
  };
}

const output = reviews.map((review, i) => {
  const hasText = typeof review.review_text === 'string' && review.review_text.trim().length >= 10;
  const isInkOUT = review.provider_name === 'inkOUT' || review.provider_name === 'inkout';
  const isTransition = isInkOUT && transitionSet.has(review.reviewer_name + '|' + review.location_city + '|' + review.review_date);

  let dateFields;

  if (review.review_date_iso) {
    // Real absolute date from SerpAPI — use it directly
    const iso = fromIso(review.review_date_iso);
    const editedNote = review.review_date_edited_iso ? `, last edited ${fromIso(review.review_date_edited_iso).label.split(' (')[0]}` : '';
    dateFields = {
      review_date_estimated: iso.estimated,
      review_date_label: iso.label.replace(')', editedNote + ')'),
      review_date_source: 'verified_serpapi'
    };
    verified++;
  } else {
    // Fall back to relative string estimation for older v3 data
    const result = convertRelativeDate(review.review_date);
    if (result) {
      dateFields = { review_date_estimated: result.estimated, review_date_label: result.label, review_date_source: 'estimated' };
      converted++;
    } else {
      dateFields = { review_date_estimated: null, review_date_label: `Could not parse date: "${review.review_date}"`, review_date_source: 'unparseable' };
      unparseable++;
    }
  }

  return {
    ...review,
    ...dateFields,
    has_text: hasText,
    text_note: hasText ? null : 'Rating only — no written review text. Excluded from text-based analysis.',
    brand_name: getBrand(review.provider_name),
    multi_location_brand: ['Removery', 'Tatt2Away', 'inkOUT'].includes(getBrand(review.provider_name)),
    location_transition: isTransition,
    transition_note: isTransition
      ? 'This review was left on a Google listing that previously operated as Tatt2Away before transitioning to inkOUT. The reviewer may have been a Tatt2Away-era customer.'
      : null
  };
});

writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');

console.log('Done.');
console.log(`Total reviews:      ${output.length}`);
console.log(`Verified (SerpAPI): ${verified}`);
console.log(`Estimated:          ${converted}`);
console.log(`Unparseable:        ${unparseable}`);
console.log(`Output written to:  ${OUTPUT_FILE}`);
