// classify-relevance.mjs
// Tags each review with is_tattoo_removal (true/false) and relevance_reason in Supabase.
// Also sets last_analyzed_at to now() on every row it touches.
//
// Layers:
//   1. No text  → false, relevance_reason = 'no_text'
//   2. Auto-true: inkOUT brand, or analyzer already gave a non-unknown result_rating
//      → relevance_reason = 'auto_true_brand_inkout' or 'auto_true_result_rating'
//   3. Keyword: CONFIRM_REMOVAL list → true, 'keyword_confirm'
//              bare 'tattoo' mention → true, 'keyword_tattoo'
//              NON_REMOVAL list (no tattoo mention) → false, 'keyword_deny'
//   4. LLM: ambiguous reviews (requires --llm flag, uses claude-haiku)
//      → relevance_reason = 'llm_classified'
//   5. null: unresolved ambiguous (no --llm) — not touched
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
  const rows = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/competitor_reviews?select=id,provider_name,brand_name,has_text,review_text,result_rating,is_tattoo_removal,relevance_reason&status=eq.published&limit=${pageSize}&offset=${from}`,
      { headers: { ...HEADERS, 'Prefer': 'count=none' } }
    )
    if (!res.ok) {
      const text = await res.text()
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
  // No text → mark as not removal (can't verify, stops the null churn)
  if (!review.has_text || !review.review_text) {
    return { value: false, reason: 'no_text' }
  }

  // inkOUT brand → always removal
  if (review.brand_name === 'inkOUT') {
    return { value: true, reason: 'auto_true_brand_inkout' }
  }

  // Already has a non-unknown result_rating from the analyzer → definitely removal
  if (review.result_rating && review.result_rating !== 'unknown') {
    return { value: true, reason: 'auto_true_result_rating' }
  }

  const text = review.review_text.toLowerCase()

  if (CONFIRM_REMOVAL.some(k => text.includes(k))) {
    return { value: true, reason: 'keyword_confirm' }
  }

  if (text.includes('tattoo')) {
    return { value: true, reason: 'keyword_tattoo' }
  }

  if (NON_REMOVAL.some(k => text.includes(k))) {
    return { value: false, reason: 'keyword_deny' }
  }

  return { value: undefined, reason: null }
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

  const results = {
    no_text: 0,
    auto_true_brand_inkout: 0,
    auto_true_result_rating: 0,
    keyword_confirm: 0,
    keyword_tattoo: 0,
    keyword_deny: 0,
    llm_classified: 0,
    skipped_already_classified: 0,
    unresolved: 0,
  }
  const updates = []

  for (const review of reviews) {
    // Skip only if already classified AND reason is already populated
    // (re-classify no_text rows even if previously set, since they now get a reason)
    const alreadyDone = review.is_tattoo_removal !== null &&
                        review.is_tattoo_removal !== undefined &&
                        review.relevance_reason !== null

    if (alreadyDone) {
      results.skipped_already_classified++
      continue
    }

    let value, reason

    const kwResult = keywordClassify(review)
    value = kwResult.value
    reason = kwResult.reason

    if (value === undefined) {
      if (USE_LLM && client) {
        const isRemoval = await llmClassify(review, client)
        value = isRemoval
        reason = 'llm_classified'
        results.llm_classified++
      } else {
        results.unresolved++
        continue // leave null — don't touch without LLM
      }
    } else {
      results[reason] = (results[reason] || 0) + 1
    }

    updates.push({ id: review.id, is_tattoo_removal: value, relevance_reason: reason })

    if (!WRITE) {
      const label = value === true ? '✓ removal' : '✗ other'
      const snippet = (review.review_text || '[no text]').slice(0, 80)
      if (value === false || reason === 'no_text') {
        console.log(`  [${label}] [${reason}] ${review.provider_name} — "${snippet}"`)
      }
    }
  }

  console.log('\n── Results ──────────────────────────────────────────')
  console.log(`  Already classified:        ${results.skipped_already_classified}`)
  console.log(`  no_text (→ false):         ${results.no_text}`)
  console.log(`  auto_true_brand_inkout:    ${results.auto_true_brand_inkout}`)
  console.log(`  auto_true_result_rating:   ${results.auto_true_result_rating}`)
  console.log(`  keyword_confirm:           ${results.keyword_confirm}`)
  console.log(`  keyword_tattoo:            ${results.keyword_tattoo}`)
  console.log(`  keyword_deny:              ${results.keyword_deny}`)
  console.log(`  llm_classified:            ${results.llm_classified}`)
  console.log(`  unresolved (null, no LLM): ${results.unresolved}`)
  console.log(`  Total updates:             ${updates.length}`)

  if (!WRITE) {
    console.log('\n  Add --write to apply these changes to Supabase.')
    return
  }

  console.log('\nWriting to Supabase...')
  const now = new Date().toISOString()
  let written = 0
  for (const u of updates) {
    await api('PATCH', `competitor_reviews?id=eq.${u.id}`, {
      is_tattoo_removal: u.is_tattoo_removal,
      relevance_reason: u.relevance_reason,
      last_analyzed_at: now,
    })
    written++
    if (written % 50 === 0) process.stdout.write(`  ${written}/${updates.length}\r`)
  }

  console.log(`\nDone — ${written} records updated.`)
}

run().catch(err => { console.error(err); process.exit(1) })
