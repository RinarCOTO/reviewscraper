#!/usr/bin/env node

/**
 * RTR Review Summary Generator
 *
 * Reads reviews from Supabase where review_summary IS NULL,
 * calls Anthropic API to rephrase each review in RTR's own words,
 * writes the summary back to Supabase.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node generate-review-summaries.js
 *
 * Optional env vars:
 *   BATCH_SIZE     - reviews per batch (default: 10)
 *   DELAY_MS       - ms between API calls (default: 500)
 *   DRY_RUN        - set to "true" to preview without writing (default: false)
 *
 * Where to put this file:
 *   Put it anywhere in your project. It's a standalone utility script.
 *   Suggested: /scripts/generate-review-summaries.js
 *   Or next to your scraper files, wherever those live.
 *
 * When to run:
 *   - Once now to backfill all 738 existing reviews
 *   - After each scrape run to summarize new reviews
 *   - It's idempotent: only processes reviews where review_summary IS NULL
 */

const SUPABASE_URL = 'https://rxrhvbfutjahgwaambqd.supabase.co';
// Use service role key for write access (bypasses RLS); falls back to anon key
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cmh2YmZ1dGphaGd3YWFtYnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTE3MDcsImV4cCI6MjA5MTkyNzcwN30.d9juaTC-mzWsxtej5MbK0neIZ6bKv73BgtGrMydhLsA';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('Error: Set ANTHROPIC_API_KEY environment variable');
  console.error('Usage: ANTHROPIC_API_KEY=sk-ant-... node generate-review-summaries.js');
  process.exit(1);
}

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10');
const DELAY_MS = parseInt(process.env.DELAY_MS || '500');
const DRY_RUN = process.env.DRY_RUN === 'true';

const SYSTEM_PROMPT = `You summarize Google reviews for a tattoo removal review site called RealTattooReviews.

Rules:
- Write 1-2 sentences in your own words. Never quote the review directly.
- Capture what the reviewer specifically experienced: treatment outcome, staff quality, pricing, pain level, healing, scarring, number of sessions, or comparisons to other providers.
- If the review is vague ("great service!" or "best place ever!"), be honest: "Brief positive review without specific treatment details."
- Do not start with "Reviewer" or "The reviewer". Vary your sentence openings.
- Do not include the reviewer's name.
- Do not use quotation marks.
- Do not editorialize or add opinions. Just summarize what they said.
- Keep it natural and conversational, not robotic.`;

async function fetchUnsummarizedReviews(limit) {
  const params = new URLSearchParams({
    select: 'id,review_text,star_rating,result_rating,use_case,scarring_mentioned,method_used,location_city,provider_name',
    review_summary: 'is.null',
    review_text: 'not.is.null',
    order: 'id.asc',
    limit: limit.toString()
  });

  // Also filter out very short reviews that are just noise
  const url = `${SUPABASE_URL}/rest/v1/competitor_reviews?${params}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function generateSummary(review) {
  const context = [
    review.use_case && review.use_case !== 'unknown' ? `Use case: ${review.use_case}` : null,
    review.result_rating ? `Sentiment: ${review.result_rating}` : null,
    review.scarring_mentioned && review.scarring_mentioned !== 'No' ? `Scarring mentioned: ${review.scarring_mentioned}` : null,
    review.method_used ? `Method: ${review.method_used}` : null,
    `Stars: ${review.star_rating}/5`,
    `City: ${review.location_city}`,
    `Provider: ${review.provider_name}`
  ].filter(Boolean).join(', ');

  const userPrompt = `Classification context: ${context}

Review text:
${review.review_text}

Write a 1-2 sentence summary in your own words.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.content[0].text.trim();
}

async function updateSummary(id, summary) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/competitor_reviews?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ review_summary: summary })
  });

  if (!res.ok) throw new Error(`Supabase update failed: ${res.status} ${await res.text()}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== RTR Review Summary Generator ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'LIVE (writing to Supabase)'}`);
  console.log(`Batch size: ${BATCH_SIZE}, Delay: ${DELAY_MS}ms\n`);

  let totalProcessed = 0;
  let totalErrors = 0;

  while (true) {
    const reviews = await fetchUnsummarizedReviews(BATCH_SIZE);

    if (reviews.length === 0) {
      console.log('\nNo more reviews to process.');
      break;
    }

    console.log(`\nBatch: ${reviews.length} reviews to summarize...`);

    for (const review of reviews) {
      try {
        // Skip very short reviews (under 20 chars)
        if (!review.review_text || review.review_text.length < 20) {
          const fallback = 'Brief review without specific details.';
          if (!DRY_RUN) await updateSummary(review.id, fallback);
          console.log(`  [${review.id}] SKIP (too short) -> "${fallback}"`);
          totalProcessed++;
          continue;
        }

        const summary = await generateSummary(review);

        if (DRY_RUN) {
          console.log(`  [${review.id}] ${review.provider_name} (${review.location_city}) ${review.star_rating}★`);
          console.log(`    Original: "${review.review_text.substring(0, 100)}..."`);
          console.log(`    Summary:  "${summary}"\n`);
        } else {
          await updateSummary(review.id, summary);
          console.log(`  [${review.id}] ${review.provider_name} (${review.location_city}) ${review.star_rating}★ -> Done`);
        }

        totalProcessed++;
        await sleep(DELAY_MS);

      } catch (err) {
        console.error(`  [${review.id}] ERROR: ${err.message}`);
        totalErrors++;
        await sleep(2000); // longer pause on error
      }
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Errors: ${totalErrors}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
