// classify-relevance.mjs
// Tags each review with is_tattoo_removal (true/false/null) in Supabase.
//
// Layers:
//   1. Auto-true: inkOUT brand, or analyzer already gave a non-unknown result_rating
//   2. Keyword: text mention of 'tattoo' → true; explicit non-removal services → false
//   3. LLM: ambiguous reviews (requires --llm flag, uses claude-haiku)
//   4. null: no-text reviews or unresolved ambiguous (no --llm)
//
// Usage:
//   node classify-relevance.mjs             # keyword pass only, dry-run output
//   node classify-relevance.mjs --write     # keyword pass, write to Supabase
//   node classify-relevance.mjs --llm       # keyword + LLM pass, dry-run
//   node classify-relevance.mjs --llm --write  # full pass, write to Supabase

import Anthropic from '@anthropic-ai/sdk'

const SUPABASE_URL  = 'https://rxrhvbfutjahgwaambqd.supabase.co'
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

const WRITE   = process.argv.includes('--write')
const USE_LLM = process.argv.includes('--llm')

if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1) }

// ── Keyword lists ─────────────────────────────────────────────────────────────

// Any of these in text → definitely tattoo removal (these businesses don't apply tattoos)
const CONFIRM_REMOVAL = [
  'tattoo removal', 'remove tattoo', 'removed tattoo', 'removing tattoo',
  'tattoo laser', 'laser tattoo', 'laser removal', 'removal session',
  'tattoo session', 'tattoo fading', 'tattoo faded', 'tattoo gone',
  'tattoo is fading', 'tattoo is gone', 'tattoo is removed',
  'removal treatment', 'removal process', 'tattoo treatment',
  'tatt2away', 'inkout', 'ink-out',
  'picosure', 'picoway', 'revlite', 'enlighten laser',
  'q-switch', 'q switch', 'nd:yag',
  'tattoo appointment', 'tattoo procedure',
]

// Any of these → NOT a tattoo removal review (explicit other services)
// Only triggers if no CONFIRM_REMOVAL keyword and no 'tattoo' mention
const NON_REMOVAL = [
  'lip filler', 'lip flip', 'lip augmentation', 'lip injection',
  'sculptra', 'juvederm', 'restylane', 'kybella', 'radiesse', 'belotero',
  'microneedling', 'micro needling', 'micro-needling',
  'laser hair removal', 'laser hair', 'hair removal',
  'ear piercing', 'nose piercing', 'body piercing', 'ear pierced', 'nose pierced',
  'got pierced', 'had pierced',
  'botox', 'dysport', 'xeomin', 'botulinum',
  'hydrafacial', 'hydra facial', 'hydra-facial',
  'microblading', 'micro blading', 'permanent makeup',
  'coolsculpting', 'cool sculpting', 'cryolipolysis',
  'chemical peel',
  'dermaplaning', 'dermaplane',
  'iv therapy', 'iv drip', 'iv infusion',
  'dermal filler', 'filler injection',
  'lash lift', 'lash extension', 'eyelash extension',
  'prp injection', 'prp treatment', 'platelet-rich',
  'lip plump', 'lip volume',
  'sculptra treatment',
]

// ── Supabase helpers ──────────────────────────────────────────────────────────

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
}

async function api(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: HEADERS,
    body: body != null ? JSON.stringify(body) : null,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  }
  if (method === 'GET') return res.json()
}

async function fetchAllReviews() {
  // Supabase REST paginates at 1000 by default; fetch with range headers
  const rows = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/competitor_reviews?select=id,provider_name,brand_name,has_text,review_text,result_rating,is_tattoo_removal&status=eq.published&limit=${pageSize}&offset=${from}`,
      { headers: { ...HEADERS, 'Prefer': 'count=none' } }
    )
    if (!res.ok) {
      const text = await res.text()
      // Column doesn't exist yet — print migration SQL and exit
      if (text.includes('is_tattoo_removal')) {
        console.error('\n⚠  Column `is_tattoo_removal` not found in competitor_reviews.')
        console.error('Run this SQL in your Supabase SQL editor first:\n')
        console.error('  ALTER TABLE competitor_reviews ADD COLUMN IF NOT EXISTS is_tattoo_removal boolean;\n')
        process.exit(1)
      }
      throw new Error(`GET reviews → ${res.status}: ${text}`)
    }
    const page = await res.json()
    if (!page.length) break
    rows.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }
  return rows
}

// ── Keyword classifier ────────────────────────────────────────────────────────

function keywordClassify(review) {
  // inkOUT brand or already has a non-unknown result → definitely removal
  if (review.brand_name === 'inkOUT') return true
  if (review.result_rating && review.result_rating !== 'unknown') return true

  // No text — can't determine
  if (!review.has_text || !review.review_text) return null

  const text = review.review_text.toLowerCase()

  // Direct tattoo removal confirmation keywords
  if (CONFIRM_REMOVAL.some(k => text.includes(k))) return true

  // 'tattoo' mention — these businesses only do removal, not application
  if (text.includes('tattoo')) return true

  // Explicit non-removal service keywords
  if (NON_REMOVAL.some(k => text.includes(k))) return false

  // Ambiguous
  return undefined
}

// ── LLM classifier ────────────────────────────────────────────────────────────

async function llmClassify(review, client) {
  const text = (review.review_text || '').slice(0, 600)
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 5,
    messages: [{
      role: 'user',
      content: `Is this review about a tattoo removal service or procedure? Answer only "yes" or "no".\n\nReview: "${text}"`,
    }],
  })
  return msg.content[0].text.trim().toLowerCase().startsWith('yes')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\nReviewIntel — Relevance Classifier')
  console.log(`Mode:  ${WRITE ? 'WRITE' : 'DRY RUN'} | LLM: ${USE_LLM ? 'ON' : 'OFF (keyword only)'}\n`)

  const reviews = await fetchAllReviews()
  console.log(`Fetched ${reviews.length} published reviews\n`)

  const client = USE_LLM ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null

  const results = { true: 0, false: 0, null: 0, llm_true: 0, llm_false: 0, already_set: 0 }
  const updates = []

  for (const review of reviews) {
    // Skip if already classified
    if (review.is_tattoo_removal !== null && review.is_tattoo_removal !== undefined) {
      results.already_set++
      continue
    }

    let value = keywordClassify(review)

    if (value === undefined) {
      // Ambiguous — try LLM or leave null
      if (USE_LLM && client) {
        value = await llmClassify(review, client)
        value ? results.llm_true++ : results.llm_false++
      } else {
        value = null
      }
    }

    results[String(value)]++
    updates.push({ id: review.id, is_tattoo_removal: value })

    if (!WRITE) {
      const label = value === true ? '✓ removal' : value === false ? '✗ other service' : '? unknown'
      const snippet = (review.review_text || '').slice(0, 80)
      if (value === false || value === null) {
        console.log(`  [${label}] ${review.provider_name} — "${snippet}"`)
      }
    }
  }

  console.log('\n── Results ──────────────────────────────────────────')
  console.log(`  Already classified:  ${results.already_set}`)
  console.log(`  → tattoo removal:    ${results.true}${results.llm_true ? ` (${results.llm_true} via LLM)` : ''}`)
  console.log(`  → other service:     ${results.false}${results.llm_false ? ` (${results.llm_false} via LLM)` : ''}`)
  console.log(`  → unknown (null):    ${results.null}`)
  console.log(`  Total updates:       ${updates.length}`)

  if (!WRITE) {
    console.log('\n  Add --write to apply these changes to Supabase.')
    return
  }

  // Batch updates — PATCH by id
  console.log('\nWriting to Supabase...')
  let written = 0
  for (const u of updates) {
    await api('PATCH', `competitor_reviews?id=eq.${u.id}`, { is_tattoo_removal: u.is_tattoo_removal })
    written++
    if (written % 50 === 0) process.stdout.write(`  ${written}/${updates.length}\r`)
  }

  console.log(`\nDone — ${written} records updated.`)
}

run().catch(err => { console.error(err); process.exit(1) })
