# ReviewIntel v3 — Pipeline README

## Run order

Always run in this sequence. Never skip steps.

```
1. fix-place-ids.mjs     — rescrape corrected locations
2. validate.mjs          — check all files before processing
3. process.mjs           — build provider summaries
4. extract-signals.mjs   — run signal extraction
5. Claude Code           — import to Supabase
```

---

## What each script does

### `fix-place-ids.mjs`
Targeted rescrape for locations where the original query hit the wrong Google listing.
Uses hardcoded `place_id` values instead of query-based search.

**Current fixes:**
- `inkout-houston-tx` — original query hit "Houston Tattoo Removal Clinic". Corrected to Rejuvatek Aesthetics (`place_id: 0x8640bf3d429a1c35:0x1d0bdb7913aecd14`)

**Pending:**
- `inkout-tampa-fl` — no verified Google Business listing found. Excluded until place_id confirmed directly from inkOUT Tampa. Uncomment the Tampa block in this script once confirmed.

Backs up the old file as `reviews-v3-[slug].prev.json` before overwriting.

---

### `validate.mjs`
Checks every `reviews-v3-*.json` file for:
- Place title match against known correct patterns
- Review count against 30-review minimum
- Star rating integrity (nulls, non-numeric)
- Empty text rate per provider
- Date format (relative strings flagged)

Outputs `validation-report.json`.

**Do not run `process.mjs` if validate shows ERROR status on any file.**

---

### `process.mjs`
Reads all non-excluded provider files and builds:
- Per-provider `provider-summary-[name].json`
- Combined `providers-all.json`

Each summary contains:
- `aggregate_rating` — weighted average across all locations (by review volume)
- `rating_range` — min and max across individual locations
- `total_review_count` — all reviews including star-only
- `text_review_count` — reviews with written text
- `empty_review_count` — star-only reviews
- `location_breakdown` — per-location rating and count
- `scrape_date` — anchor date for relative date resolution
- `reviews` — full review array with `review_date_resolved` field added

**Scrape date:**
By default uses today. To set a specific anchor date:
```
node process.mjs --scrape-date=2026-04-22
```

**Excluded:**
- `inkout-tampa-fl` — excluded until verified listing confirmed

---

### `extract-signals.mjs`
Keyword pass on text-only reviews. Writes `signals` and `editorial_summary` objects back into each `provider-summary-*.json`.

**Signal categories:**

| Category | Signals |
|---|---|
| Outcome | outcome_positive, complete_removal, cover_up_prep, pmu_removal |
| Experience | pain_mentioned, staff_positive |
| Concern | scarring_mentioned, healing_complication, billing_complaint |
| Fit | darker_skin, color_ink, prior_laser_failed |
| Logistics | session_count_mentioned |

**Important:** Signal counts run on text reviews only. Editorial summary strings reference total review count (including star-only) for consistency with published page numbers.

---

## Excluded locations

| Slug | Reason |
|---|---|
| `inkout-tampa-fl` | No verified Google Business listing. Scraper hit "Inkstheticare Clinic Laser Tattoo Removal" — wrong listing. Excluded pending direct confirmation from inkOUT Tampa. |

When Tampa is resolved:
1. Get correct `place_id` from Google Maps URL
2. Add it to the `FIXES` array in `fix-place-ids.mjs`
3. Run `fix-place-ids.mjs`
4. Run `validate.mjs`
5. Remove `inkout-tampa-fl` from `EXCLUDED_SLUGS` in `process.mjs`
6. Re-run `process.mjs` and `extract-signals.mjs`

---

## Published number consistency

When aggregate scores or review counts change after a rescrape, update these locations:

- `reviews/inkout` — hero score, methodology section, per-location breakdown
- `comparisons/inkout-vs-removery` — any inkOUT review count references
- `comparisons/inkout-vs-laseraway` — same
- `cities/houston` — Houston-specific review data
- `cities/austin` — Austin-specific review data
- `cities/chicago` — Chicago-specific review data

**Never update published numbers from a scrape that has unresolved ERROR status in validate.mjs.**

---

## File outputs

| File | Created by | Purpose |
|---|---|---|
| `reviews-v3-[slug].json` | scrape-v3.mjs / fix-place-ids.mjs | Raw reviews per location |
| `reviews-v3-[slug].prev.json` | fix-place-ids.mjs | Backup of previous raw file |
| `reviews-v3-all.json` | scrape-v3.mjs | Combined raw reviews |
| `validation-report.json` | validate.mjs | Pre-processing health check |
| `provider-summary-[name].json` | process.mjs + extract-signals.mjs | Final processed output per provider |
| `providers-all.json` | process.mjs | Combined provider summaries |
