// ReviewIntel — Claude Analyzer
// Run: node analyze.mjs
// Input:  reviews.json
// Output: analyzed.json
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY env var'); process.exit(1); }

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-20250514';

const SYSTEM = `You are a review analyst for a tattoo removal business.
Given a customer review, return a JSON object with exactly these fields:
- sentiment: "positive" | "negative" | "mixed"
- pain_mentioned: "yes" | "no"
- scarring_mentioned: "yes" | "no"
- sessions_count: number (integer, 0 if not mentioned)
- results_quality: "excellent" | "good" | "moderate" | "poor" | "unknown"
- pricing_sentiment: "cheap" | "fair" | "expensive" | "unknown"

Respond with ONLY the JSON object, no markdown, no explanation.`;

async function categorize(review) {
  const prompt = `Business: ${review.business} (${review.location})
Stars: ${review.stars}
Review: ${review.text}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    console.warn('Parse error for review, raw:', raw);
    return {
      sentiment: 'unknown',
      pain_mentioned: 'unknown',
      scarring_mentioned: 'unknown',
      sessions_count: 0,
      results_quality: 'unknown',
      pricing_sentiment: 'unknown',
    };
  }
}

async function analyze() {
  if (!fs.existsSync('reviews.json')) {
    console.error('reviews.json not found — run scrape.mjs first');
    process.exit(1);
  }

  const reviews = JSON.parse(fs.readFileSync('reviews.json', 'utf8'));
  console.log(`Analyzing ${reviews.length} reviews with ${MODEL}...`);

  const analyzed = [];
  for (let i = 0; i < reviews.length; i++) {
    const review = reviews[i];
    process.stdout.write(`\r[${i + 1}/${reviews.length}] ${review.business}...`);
    try {
      const categories = await categorize(review);
      analyzed.push({ ...review, ...categories });
    } catch (e) {
      console.error(`\nFailed on review ${i + 1}:`, e.message);
      analyzed.push({ ...review, error: e.message });
    }
    // Avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\nDone!');
  fs.writeFileSync('analyzed.json', JSON.stringify(analyzed, null, 2));
  console.log(`${analyzed.length} analyzed reviews saved to analyzed.json`);

  // Save per-competitor files
  const byLocation = {};
  for (const r of analyzed) {
    const slug = (r.location || 'unknown').toLowerCase().replace(/\s+/g, '-');
    if (!byLocation[slug]) byLocation[slug] = [];
    byLocation[slug].push(r);
  }
  for (const [slug, rows] of Object.entries(byLocation)) {
    const filename = `analyzed-${slug}.json`;
    fs.writeFileSync(filename, JSON.stringify(rows, null, 2));
    console.log(`Saved ${rows.length} → ${filename}`);
  }
}

analyze().catch(console.error);
