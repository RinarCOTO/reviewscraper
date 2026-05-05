# ReviewScraper — Project Context

## What This Is

An internal pipeline + dashboard for collecting, analyzing, and routing inkOUT/Tatt2Away Google reviews into the `competitor_reviews` Supabase table. The output feeds the public RealTattooReviews site at realtattooreviews.com.

Two separate apps live here:

| App | Path | Purpose |
|-----|------|---------|
| **ReviewIntel dashboard** | `web/` | Internal hub (localhost only). View, filter, and manually action reviews. |
| **Pipeline scripts** | `pipeline/` | Scrape → Analyze → Separate → Import. Run from the terminal. |

---

## Supabase: `competitor_reviews`

Single table. All reviews from all providers land here.

**Key columns:** `provider_name`, `location_city`, `location_state`, `bucket`, `status`, `pain_level`, `result_rating`, `scarring_mentioned`, `reviewed_decision`, `reviewed_at`

### Bucket Values

| Bucket | Meaning | Visible on public RTR site? |
|--------|---------|----------------------------|
| `inkout` | Approved inkOUT reviews — safe for public display | ✅ Yes |
| `competitor` | All other provider reviews (Removery, LaserAway, etc.) | ✅ Yes |
| `tatt2away` | Pre-rebrand reviews + reviews naming "Tatt2Away" explicitly | ❌ No |
| `review_required` | Flagged for Amelia's manual judgment | ❌ No (until actioned) |

### RLS Policies

- **`anon` role** — can only read `status = 'published'` rows where `bucket != 'tatt2away'`. This is intentional: the public RTR site uses the anon key and must never serve tatt2away-bucket rows.
- **`authenticated` role** — full read access.
- **`service_role`** — full access (bypasses RLS entirely).

The ReviewIntel dashboard uses the **service key** (exposed via `NEXT_PUBLIC_SUPABASE_SERVICE_KEY` in `web/.env.local`) so it can read all buckets, including `tatt2away` and `review_required`. This is safe because the dashboard never gets deployed publicly — it is localhost-only.

---

## Tatt2Away Archive (UI Transparency)

The ReviewIntel dashboard has a **Tatt2Away Archive** page at `/reviews/tatt2away/`.

**Purpose:** Show all `bucket = 'tatt2away'` rows for reference. These are pre-rebrand reviews and any review that explicitly names "Tatt2Away." They are excluded from the public RTR site and from competitor metrics — they exist here for audit visibility only.

**Why transparency matters:** These reviews are real Google reviews collected from the same clinic listings that are now branded inkOUT. Hiding them entirely would be a silent data gap. The archive surfaces them internally so the team can verify the separator is routing correctly and understand the historical baseline.

**Current state (as of April 27, 2026 import):**
- 37 reviews in the `tatt2away` bucket
- Spread across Chicago IL, Austin TX, Tampa FL, Houston TX, Pleasant Grove UT, Draper UT
- All have `status = 'published'`

**If the archive shows 0 reviews:** The service key is missing or not being picked up. Check that `NEXT_PUBLIC_SUPABASE_SERVICE_KEY` is set in `web/.env.local` and restart the dev server.

---

## Separator Logic (bucket assignment)

The separator pipeline (`separator/run.py`) assigns buckets before import:

1. **Stage 1 — name hit:** Any review mentioning "Tatt2Away" (or variants) → `tatt2away`. Routing reason: `stage_1_name_hit`.
2. **Stage 2 — outcome filter:** Runs on reviews that cleared Stage 1. Negative outcomes (scarring, pain, failure) → `tatt2away`. Routing reason: `result_rating_negative_scarring` etc.
3. **Bridging language:** Reviews that connect the two brands explicitly → `review_required` for Amelia.
4. **Everything else** → `inkout`.

Output written to `output/bucket_lookup.json`. The importer reads this file to stamp each row's `bucket` on insert.

---

## Pipeline Flow

```
scrape-v4.mjs          → data/reviews/reviews-v4-{provider}.json
combine-reviews.mjs    → data/reviews/reviews-v4-all.json
analyze-v4.mjs         → data/analyzed/analyzed-v4-all-dated.json
separator/run.py       → output/bucket_lookup.json
import-to-supabase-v4.mjs  → Supabase competitor_reviews table
```

**Model used in analyze step:** `claude-sonnet-4-20250514` (NOT Haiku, NOT Qwen).

**SerpAPI credits:** 1 credit per search call. Each provider costs 1 credit per page of ~10 reviews. MAX=500 per provider in `scrape-v4.mjs`. Run `--mode=incremental` to only fetch new reviews and preserve credits.

---

## ReviewIntel UI — CEO Intelligence Roadmap

The current dashboard (`web/`) is analyst-grade: sortable tables, per-city breakdowns, per-competitor deep dives. It needs a CEO layer on top — narrative, trend, and "so what" rather than raw numbers.

### What exists today (web/src/app)

| Route | What it does |
|-------|-------------|
| `/` | Hub Dashboard — city summary cards |
| `/overview` | Full Overview — sortable provider table |
| `/reviews` | All Reviews — filterable list |
| `/reviews/review-required` | Review Queue — manual approve/reject/archive |
| `/reviews/tatt2away` | Tatt2Away Archive — pre-rebrand review transparency |
| `/reviews/inkout` | inkOUT review feed |
| `/city/[slug]` | Per-city competitor breakdown |
| `/competitor/[slug]` | Per-provider deep dive |
| `/comparisons/picosure-vs-picoway` | Technology comparison |
| `/methodology` | Data methodology explanation |

### Live data snapshot (as of May 2026 import)

| Brand | Reviews | Avg ★ | Positive% | Negative% | Scar hits | Last 6mo |
|-------|---------|-------|-----------|-----------|-----------|---------|
| **inkOUT** | 124 | 4.82 | 25.9% | 3.4% | **0** | 10 |
| Erasable Med Spa | 50 | 5.00 | 10.2% | 0% | 0 | 34 |
| InkFree, MD | 50 | 4.84 | 39.5% | 4.7% | 1 | 10 |
| Clarity Skin | 50 | 4.60 | 25.6% | 4.7% | 0 | 6 |
| LaserAway (3 markets) | 150 | 4.85 | 3.3% | 0% | 0 | **146** |

Key signals: inkOUT has the lowest negative rate and zero scarring mentions — unique in the dataset. However LaserAway is accumulating reviews 15× faster (146 vs 10 in 6 months).

### Pages to build — priority order

**Build first:**
- `/ceo` — **CEO Scorecard.** One screen. inkOUT vs market on every key metric with win/neutral/lose indicators and a headline insight sentence. No tables — visual only.
- `/momentum` — **Momentum Tracker.** Review velocity by quarter for inkOUT vs top competitors. Surfaces the LaserAway gap before it becomes a crisis.

**Build next:**
- `/city-matrix` — **City Win/Loss Map.** Per city: does inkOUT rank #1 on positive%, negative%, or stars vs local competitors? Single-glance answer.
- `/differentiators` — **Differentiator Brief.** Zero scar mentions, pain level comparison, use case breadth — packaged as a shareable one-pager for sales/investor use.

**Later (needs more data or dev work):**
- `/voice` — **Voice of Customer.** Top recurring themes in positive vs negative inkOUT reviews. Requires NLP pass or term-frequency analysis.
- `/threats` — ✅ Done. Competitor velocity ranked Active/Rising/Stable/Declining. Uses getMomentumReviews(). Active = 20+ reviews last 6mo. Shows trend % vs prior 6mo, inkOUT benchmark row, wired into Sidebar and hub.
- `/gaps` — ✅ Done. Shows gap markets ranked by total competitor reviews. Per-city cards with competitor breakdown: brand, review count, avg stars, positive%. Uses getAllReviews(), isCompetitor() filter, inkOUT presence detected via bucket. Wired into Sidebar and hub.

### CEO Data Control (configurable vs locked)

The CEO layer should let the user customize their view, but not touch pipeline internals.

**CEO can control (configurable) — applies to ALL providers:**
- Which competitor providers appear on their scorecard and comparison views
- Which cities/markets are included in their dashboard
- Which metrics are shown (stars, positive%, negative%, scar mentions, pain level, review count, momentum)
- The primary competitor used as the "vs inkOUT" benchmark
- Date range window for trend views (e.g., last 3 / 6 / 12 months)

For competitor providers (Removery, LaserAway, Clarity Skin, etc.) all fields are fully visible and configurable — including pain_level, negative reviews, scarring data. No restrictions.

**Locked — applies to inkOUT and Tatt2Away data only:**
- `pain_level` for inkOUT reviews — internal enrichment field, not surfaced on the CEO inkOUT view
- `tatt2away` bucket — pipeline-internal classification for the inkOUT rebrand; CEO should never see or manage this
- Review Queue (approve / reject / archive actions) — analyst-only workflow for inkOUT review triage
- `bucket`, `routing_reason`, `reviewed_decision` columns — separator pipeline internals specific to the inkOUT/Tatt2Away separation
- `review_required` queue — Amelia's editorial workflow for inkOUT reviews, not CEO business

**Rationale:** The restrictions exist because of the inkOUT rebrand complexity — Tatt2Away is a former identity and pipeline artifact, not a real competitor. Pain level and routing data are internal quality signals used by the analyst team. For all third-party competitors, there is no equivalent sensitivity and the CEO should see the full picture.

**Implementation approach:** Store CEO preferences in `localStorage` under a `ceo_config` key (provider list, city list, visible metrics, benchmark competitor). Read on page load, apply as client-side filters over the full Supabase result. No new DB columns needed — config lives in the browser since this is a localhost tool.

### Design principles for CEO pages
- Lead with the insight, not the data. ("inkOUT is the only tracked provider with zero scarring complaints" not "scarring_mentioned = 0")
- Trend direction matters more than absolute numbers. Show arrows, not just values.
- No sortable tables on CEO pages — those belong in the analyst views that already exist.
- Each CEO page should have one clear takeaway visible above the fold.

---

## Pending Work

### CEO Pages — UI fixes needed

- **`/momentum` rebuild** — ✅ Done (Codex, May 2025). Uses `getMomentumReviews()`, groups by `brand_name`, all-brands grouped bar chart, Last 4Q/8Q/All Time window, provider toggle chips, 6-month velocity bars. LaserAway and Removery are live in Supabase and appear correctly.
- **`/city-matrix`** — ✅ Done. Per-city win/loss grid: inkOUT ranked vs local competitors on stars, positive%, negative%, scar hits.
- **`/differentiators`** — not yet built. One-pager for sales/investor use: zero scar mentions, pain level comparison, use case breadth.

### Pipeline — current Supabase state (verified May 2025)

The "19 unimported providers" from earlier notes are **already in Supabase**. All of the following are live and published:

| Brand | Reviews | Locations |
|-------|---------|-----------|
| Removery | 245 | Austin, Katy, Sugar Land, Houston, Round Rock, Chicago, Friendswood, Tampa, Shenandoah |
| LaserAway | 153 | Tampa, Austin, Chicago, Houston |
| inkOUT | 51 | Draper, Austin, Houston, Tampa, Chicago |
| EradiTatt | 47 | Tampa |
| ReversaTatt | 46 | Tampa |
| Houston Tattoo Removal Clinic | 46 | Houston |
| Unbranded ATX | 44 | Austin |
| Rethink Laser | 41 | Houston |
| + 14 more providers | — | — |

**Local aggregate file is stale:** `data/analyzed/analyzed-v4-all-dated.json` only covers 17 providers and does not include LaserAway or Removery expansion. This file is not used by the dashboard (which reads Supabase directly) — but if running the pipeline locally, re-run `combine-reviews.mjs` first.

**Genuinely still missing:**
- `tatt2away-houston-tx` — raw scrape exists, not analyzed, not in Supabase.
- **106 competitor reviews missing `pain_level`** — published but unenriched. Fix: re-run analyze step on those providers.
- **SerpAPI top-up** — fund when paid, then run incremental across all providers.
