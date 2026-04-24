# Background

inkOUT is the rebrand of Tatt2Away. The rebrand happened on a rolling per-clinic timeline, not a single corporate cutover date. Amelia raised the question in the meeting of whether to use December as the launch cutoff; that question was never resolved in the meeting itself. The decision made afterward was to include all review dates with no cutoff — the separation happens by content, not timing.

# Core Strategy

Combine Tatt2Away and inkOUT reviews into one dataset, then segregate them into buckets using a two-stage filter. The clean inkOUT pool feeds `/reviews/inkout` on RealTattooReviews. Tatt2Away-era content and negative outcomes get routed to a separate bucket. Ambiguous cases go to a manual-review queue for Amelia.

The strategic rationale: the whole RealTattooReviews architecture — comparison pages, city pages, category pages — depends on inkOUT owning "low scarring risk, better for difficult cases, specialist-grade outcomes." Polluting the inkOUT review pool with scarring and pain complaints collapses every page that links into it. The filter protects the architecture, not just the page.

# What We're Not Doing

- **No date cutoff.** A December-launch cutoff was considered and rejected because the rebrand rolled out per clinic and a single date would be misleading. Review date alone doesn't tell us which brand era a clinic was in.
- **Not building a new scraper.** The scraping already exists. The work is a filter and routing script that runs on the existing scraped dataset.
- **Not suppressing negative inkOUT-era reviews entirely.** Verified post-rebrand negative outcomes go to the `review_required` bucket for Amelia's editorial judgment — not silently dropped. Silent suppression would undermine the site's credibility, which the `/reviews` page intent explicitly depends on.

# Two-Stage Filter

## Stage 1 — Name-mention filter

Case-insensitive regex for Tatt2Away variants: `tatt2away`, `tatt 2 away`, `tatt-2-away`, `tattooaway`, `tattoo away`, `tat2away`, `t2a`, `tatt2`, `tatt away`. Any hit routes the review to the Tatt2Away bucket regardless of date or content. This is primarily trademark hygiene and brand-identity separation, not outcome filtering.

Bridging language (`rebrand`, `rebranded`, `used to be called`, `formerly known as`, `new name`, `name change`) gets flagged separately. Bridging language alone doesn't route to Tatt2Away — it routes to `review_required` because the reviewer is explicitly connecting the two brands and may need editorial context.

## Stage 2 — Outcome filter

Runs only on reviews that passed Stage 1 clean. Two steps.

**Step 2A — keyword flagging** across four families:

- **Scarring:** scar, scarring, scarred, keloid, raised tissue, indent, divot, hypopigmentation, hyperpigmentation, discoloration, white patch, dark patch, uneven skin
- **Severe pain:** excruciating, unbearable, worst pain, agonizing, brutal, horrible pain (bare "painful" and "hurt" are intentionally excluded — too noisy for removal reviews)
- **Outcome failure:** didn't work, no results, wasted money, regret, botched, ruined, made it worse, permanent damage, burn, burned, blister
- **Abandonment:** stopped treatment, gave up, quit, switched providers, had to go elsewhere

**Step 2B — LLM classification** using Claude Haiku via the Anthropic API on every flagged review. The LLM distinguishes actual negative outcomes ("left a permanent scar") from neutral/positive context that happens to contain outcome keywords ("no scarring at all"). Returns a classification (`negative`, `neutral_positive`, `ambiguous`), a confidence score, and a one-sentence reasoning.

The LLM pass was chosen over pure keyword + negation parsing because negation handling is brittle and false positives would wrongly route positive reviews away from the inkOUT pool.

# Routing Logic

Three buckets:

- **`tatt2away`** — Stage 1 hit (any name mention), OR Stage 2 classified "negative" with confidence ≥ 0.75, OR (if clinic rebrand dates are available) review dated before that clinic's rebrand date.
- **`review_required`** — bridging language flag without a Stage 1 hit, OR Stage 2 classified "negative" with confidence < 0.75, OR Stage 2 classified "ambiguous" at any confidence. This is Amelia's manual queue.
- **`inkout`** — everything else. Passed Stage 1 clean, and either Stage 2 didn't flag the review or Stage 2 classified it as `neutral_positive` with sufficient confidence.

# Per-Clinic Rebrand Dates

Optional pre-filter. If we can get a `clinics.csv` from Adal with per-clinic rebrand dates, reviews dated before a clinic's rebrand date auto-route to the Tatt2Away bucket regardless of content. Without that file, the filter skips this step — the script should not fail if the data isn't available.

This is the single most useful piece of data we could still gather. Worth asking Adal whether any clinic-level rebrand timeline exists, even partial.

# Operational Agreements

- **Dry-run first.** Dry-run writes outputs with a `_DRYRUN` suffix, prints 10 sample reviews per bucket to stdout, and supports a `--dry-run-limit` flag to cap API calls during testing. Amelia spot-checks 50-100 reviews per bucket across the dry-run output before a production run.
- **Output structure.** Three CSV files (one per bucket) plus a `summary.txt` with bucket counts, per-source counts, per-clinic counts, and the top 20 matched Stage 2 terms. All original review fields are preserved through to output — the filter metadata is added, nothing is dropped.
- **Tests first.** Filter tests are written before the routing logic. Minimum fixtures: a Tatt2Away name hit, a "no scarring at all" positive-context flag, a genuine negative outcome, a bridging-language-only review, a clean review with no triggers, and (if clinics.csv exists) a pre-rebrand-date auto-route.

# Open Items

- **Clinic-level rebrand dates from Adal.** Not blocking, but would sharpen the pool if available.
- **Editorial handling path for `review_required` negatives.** Needs Amelia and Adal aligned on whether these get published with responses, aggregated into a "known limitations" section, or handled some other way. The bucket collects them; the downstream decision is still open.
- **Verification that the existing scraped data contains full `raw_text`** for each review, not just truncated snippets. Stage 2 classification needs full text to work reliably.
- **Confirmation of the review dataset path, current schema, and any additional fields** beyond the minimum the filter should preserve.

# Strategic Framing

The name-mention filter is primarily defensive — trademark hygiene and brand-identity cleanliness. The outcome filter is primarily strategic — it protects the positioning that every comparison and category page on the site depends on. The `review_required` bucket is the credibility safeguard that prevents the filter from becoming silent suppression.

All three have to work together. Dropping any of them weakens the system.