#!/usr/bin/env python3
"""
CLI entry point for inkOUT review separation pipeline.

Usage:
  python run.py
  python run.py --input ../data/analyzed/analyzed-v4-all-dated.json --output-dir ../output
  python run.py --dry-run --dry-run-limit 10
  python run.py --clinics-csv ../clinics.csv
"""
import argparse
import csv
import glob
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

# Allow running from anywhere relative to this file
sys.path.insert(0, str(Path(__file__).parent))

import anthropic

from filters.stage_1 import run_stage_1
from filters.stage_2 import run_stage_2a, run_stage_2b
from routing import assign_bucket


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_input(pattern: str) -> list[dict]:
    paths = sorted(glob.glob(pattern))
    if not paths and os.path.exists(pattern):
        paths = [pattern]
    if not paths:
        print(f"ERROR: no files matched: {pattern}", file=sys.stderr)
        sys.exit(1)

    reviews = []
    for path in paths:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, list):
            reviews.extend(data)
        elif isinstance(data, dict):
            for v in data.values():
                if isinstance(v, list):
                    reviews.extend(v)
                    break

    # When loading from the all-providers analyzed file, keep inkOUT only.
    # When loading from the raw inkout source files they're already filtered.
    inkout = [r for r in reviews if r.get('provider_name') in ('inkOUT', 'inkout')]
    if inkout:
        reviews = inkout

    for i, r in enumerate(reviews):
        if 'review_id' not in r:
            r['review_id'] = f'rev_{i:06d}'

    print(f"Loaded {len(reviews)} inkOUT reviews from {len(paths)} file(s)")
    return reviews


def load_clinics_csv(path: 'str | None') -> dict:
    if not path or not os.path.exists(path):
        return {}
    dates = {}
    with open(path, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            clinic_id = (
                row.get('clinic_id')
                or row.get('_place_id')
                or row.get('clinic_name')
                or ''
            ).strip()
            rebrand_date = row.get('rebrand_date', '').strip()
            if clinic_id and rebrand_date:
                dates[clinic_id] = rebrand_date
    print(f"Loaded rebrand dates for {len(dates)} clinic(s)")
    return dates


# ---------------------------------------------------------------------------
# Per-review helpers
# ---------------------------------------------------------------------------

def _parse_iso(s: str) -> 'datetime | None':
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00'))
    except ValueError:
        return None


def check_pre_rebrand(record: dict, clinic_dates: dict) -> bool:
    if not clinic_dates:
        return False
    clinic_id = (
        record.get('_place_id')
        or record.get('clinic_id')
        or record.get('provider_name', '')
    )
    rebrand_str = clinic_dates.get(clinic_id)
    if not rebrand_str:
        return False
    review_dt = _parse_iso(
        record.get('review_date_iso') or record.get('review_date', '')
    )
    rebrand_dt = _parse_iso(rebrand_str)
    if review_dt is None or rebrand_dt is None:
        return False
    # Make both offset-aware for comparison
    if review_dt.tzinfo is None:
        review_dt = review_dt.replace(tzinfo=timezone.utc)
    if rebrand_dt.tzinfo is None:
        rebrand_dt = rebrand_dt.replace(tzinfo=timezone.utc)
    return review_dt < rebrand_dt



_EMPTY_STAGE1 = {
    'stage_1_hit': False,
    'stage_1_matched_terms': [],
    'stage_1_bridging_flag': False,
    'stage_1_bridging_terms': [],
}
_EMPTY_STAGE2 = {
    'stage_2_flagged': False,
    'stage_2_matched_terms': [],
    'stage_2_classification': None,
    'stage_2_confidence': None,
    'stage_2_reasoning': None,
}


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def _flatten(record: dict) -> dict:
    out = {}
    for k, v in record.items():
        if isinstance(v, list):
            out[k] = '|'.join(str(x) for x in v)
        elif isinstance(v, bool):
            out[k] = str(v).lower()
        else:
            out[k] = v
    return out


def write_csv(rows: list[dict], path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text('')
        return
    fieldnames = list(rows[0].keys())
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(_flatten(row))


def write_bucket_lookup(buckets: 'dict[str, list]', path: Path):
    """JSON lookup for the Node.js import script — avoids CSV multiline parsing issues."""
    lookup = {}
    for bucket, reviews in buckets.items():
        for r in reviews:
            key = f"{r.get('reviewer_name')}|{r.get('review_date_iso')}|{r.get('location_city')}"
            lookup[key] = {
                'bucket': bucket,
                'routing_reason': r.get('routing_reason'),
            }
    path.write_text(json.dumps(lookup, indent=2), encoding='utf-8')


def write_summary(buckets: 'dict[str, list]', path: Path, api_calls: int):
    inkout = buckets['inkout']
    tatt2away = buckets['tatt2away']
    review_required = buckets['review_required']
    all_reviews = inkout + tatt2away + review_required

    lines = [
        f"Review Separation Summary — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        '',
        'BUCKET COUNTS',
        f"  inkout:          {len(inkout):>5}",
        f"  tatt2away:       {len(tatt2away):>5}",
        f"  review_required: {len(review_required):>5}",
        f"  TOTAL:           {len(all_reviews):>5}",
        f"  API calls:       {api_calls:>5}",
        '',
        'BY SOURCE (platform)',
    ]

    by_source: dict = defaultdict(lambda: defaultdict(int))
    for r in all_reviews:
        by_source[r.get('verified_source', 'unknown')][r['bucket']] += 1
    for src, counts in sorted(by_source.items()):
        lines.append(f"  {src}")
        for bucket, n in sorted(counts.items()):
            lines.append(f"    {bucket}: {n}")

    lines += ['', 'BY CLINIC']
    by_clinic: dict = defaultdict(lambda: defaultdict(int))
    for r in all_reviews:
        label = (
            f"{r.get('provider_name', 'unknown')} "
            f"({r.get('location_city', '')}, {r.get('location_state', '')})"
        )
        by_clinic[label][r['bucket']] += 1
    for clinic, counts in sorted(by_clinic.items()):
        lines.append(f"  {clinic}")
        for bucket, n in sorted(counts.items()):
            lines.append(f"    {bucket}: {n}")

    lines += ['', 'TOP 20 STAGE 2 MATCHED TERMS']
    term_counter: Counter = Counter()
    for r in all_reviews:
        terms = r.get('stage_2_matched_terms') or []
        if isinstance(terms, list):
            term_counter.update(t.lower() for t in terms)
    for term, n in term_counter.most_common(20):
        lines.append(f"  {term}: {n}")

    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def print_samples(buckets: 'dict[str, list]', n: int = 10):
    for bucket_name, reviews in buckets.items():
        print(f"\n{'=' * 60}")
        print(f"BUCKET: {bucket_name} ({len(reviews)} total) — showing {min(n, len(reviews))}")
        print('=' * 60)
        for i, r in enumerate(reviews[:n], 1):
            text = (r.get('review_text') or '')[:200].replace('\n', ' ')
            print(
                f"\n[{i}] {r.get('reviewer_name', 'anon')} — "
                f"{r.get('provider_name', '')} {r.get('location_city', '')}"
            )
            print(
                f"    stage_1_hit={r.get('stage_1_hit')}  "
                f"bridging={r.get('stage_1_bridging_flag')}  "
                f"stage_2_flagged={r.get('stage_2_flagged')}  "
                f"classification={r.get('stage_2_classification')}  "
                f"confidence={r.get('stage_2_confidence')}  "
                f"bucket={r['bucket']}"
            )
            s1 = r.get('stage_1_matched_terms') or []
            s2 = r.get('stage_2_matched_terms') or []
            if s1 or s2:
                print(f"    matched: {s1 + s2}")
            print(f"    \"{text}...\"")


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Separate inkOUT reviews into buckets')
    parser.add_argument(
        '--input',
        default='../data/analyzed/analyzed-v4-all-dated.json',
        help='Input JSON file — analyzed all-providers file (default) or inkout source glob',
    )
    parser.add_argument(
        '--output-dir',
        default='../output',
        help='Output directory (default: ../output)',
    )
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument(
        '--dry-run-limit',
        type=int,
        default=None,
        metavar='N',
        help='Cap LLM API calls during dry run',
    )
    parser.add_argument(
        '--clinics-csv',
        default=None,
        metavar='PATH',
        help='clinics.csv with clinic_id and rebrand_date columns',
    )
    args = parser.parse_args()

    reviews = load_input(args.input)
    clinic_dates = load_clinics_csv(args.clinics_csv)

    api_key = os.environ.get('ANTHROPIC_API_KEY')
    client = anthropic.Anthropic(api_key=api_key) if api_key else None
    if client is None:
        print("WARNING: ANTHROPIC_API_KEY not set — Stage 2B LLM calls will be skipped", file=sys.stderr)

    api_calls = 0

    for review in reviews:
        raw_text = review.get('review_text') or ''

        # Optional per-clinic pre-rebrand date auto-route
        pre_rebrand = check_pre_rebrand(review, clinic_dates)
        review['pre_rebrand_date_routed'] = pre_rebrand

        if pre_rebrand:
            review.update(_EMPTY_STAGE1)
            review.update(_EMPTY_STAGE2)
        else:
            # Stage 1
            review.update(run_stage_1(raw_text))

            if not review['stage_1_hit']:
                # Stage 2A: keyword tagging (metadata — recorded in CSV output)
                review.update(run_stage_2a(raw_text))

                # Apply result_rating to ALL reviews — not just keyword-flagged ones.
                # Negative reviews without keyword hits (e.g. "they mutilate you") would
                # otherwise fall through to inkout with classification=None.
                result_rating = review.get('result_rating', 'unknown')

                if result_rating == 'Negative':
                    review.update({
                        'stage_2_classification': 'negative',
                        'stage_2_confidence': 1.0,
                        'stage_2_reasoning': 'analyzer result_rating=Negative',
                    })
                elif result_rating == 'Mixed':
                    review.update({
                        'stage_2_classification': 'ambiguous',
                        'stage_2_confidence': 1.0,
                        'stage_2_reasoning': 'analyzer result_rating=Mixed (contradictory signals)',
                    })
                elif result_rating in ('Positive', 'Neutral'):
                    review.update({
                        'stage_2_classification': 'neutral_positive',
                        'stage_2_confidence': 1.0,
                        'stage_2_reasoning': f'analyzer result_rating={result_rating}',
                    })
                else:
                    # unknown result_rating: use LLM if flagged, star rating otherwise
                    if review['stage_2_flagged']:
                        dry_run_capped = (
                            args.dry_run
                            and args.dry_run_limit is not None
                            and api_calls >= args.dry_run_limit
                        )
                        if raw_text and client and not dry_run_capped:
                            review.update(run_stage_2b(raw_text, client))
                            api_calls += 1
                        else:
                            stars = int(review.get('star_rating') or 3)
                            if stars <= 2:
                                cls, conf, reason = 'negative', 0.8, f'{stars}★ → negative'
                            elif stars == 3:
                                cls, conf, reason = 'ambiguous', 0.6, f'{stars}★ ambiguous'
                            else:
                                cls, conf, reason = 'neutral_positive', 0.8, f'{stars}★ → positive'
                            review.update({
                                'stage_2_classification': cls,
                                'stage_2_confidence': conf,
                                'stage_2_reasoning': reason,
                            })
                    else:
                        # No keywords and no result_rating — use star rating as last signal
                        stars = int(review.get('star_rating') or 5)
                        if stars <= 2:
                            review.update({
                                'stage_2_classification': 'negative',
                                'stage_2_confidence': 0.7,
                                'stage_2_reasoning': f'{stars}★ no text/keywords → negative',
                            })
                        else:
                            review.update({
                                'stage_2_classification': None,
                                'stage_2_confidence': None,
                                'stage_2_reasoning': None,
                            })
            else:
                # Stage 1 hit → tatt2away; skip Stage 2 entirely
                review.update({
                    'stage_2_flagged': False,
                    'stage_2_matched_terms': [],
                    'stage_2_classification': None,
                    'stage_2_confidence': None,
                    'stage_2_reasoning': None,
                })

        review['bucket'] = assign_bucket(review, raw_text)

    buckets: dict[str, list] = {
        'inkout': [r for r in reviews if r['bucket'] == 'inkout'],
        'tatt2away': [r for r in reviews if r['bucket'] == 'tatt2away'],
        'review_required': [r for r in reviews if r['bucket'] == 'review_required'],
    }

    suffix = '_DRYRUN' if args.dry_run else ''
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)

    write_csv(buckets['inkout'],          out / f'inkout_reviews{suffix}.csv')
    write_csv(buckets['tatt2away'],       out / f'tatt2away_reviews{suffix}.csv')
    write_csv(buckets['review_required'], out / f'review_required_reviews{suffix}.csv')
    write_summary(buckets, out / f'summary{suffix}.txt', api_calls)
    if not args.dry_run:
        write_bucket_lookup(buckets, out / 'bucket_lookup.json')

    print(f"\nOutput → {out}/")
    print(f"  inkout:          {len(buckets['inkout'])}")
    print(f"  tatt2away:       {len(buckets['tatt2away'])}")
    print(f"  review_required: {len(buckets['review_required'])}")
    print(f"  API calls:       {api_calls}")

    if args.dry_run:
        print_samples(buckets)


if __name__ == '__main__':
    main()
