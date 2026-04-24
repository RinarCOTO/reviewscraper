#!/usr/bin/env python3
"""
Routing dry-run: applies the new scarring/pain-aware routing to all inkOUT
reviews currently in Supabase and shows which would move buckets — without
writing anything.

This script re-derives Stage 1 from review_text (those fields are not stored
in Supabase) and uses star_rating as the fallback signal when result_rating is
unknown (no LLM calls during dry-run).

Output
------
  stdout                                      — bucket-move summary
  ./output/routing_dry_run_[timestamp].csv   — full diff (all changed rows)
  stdout (tail)                               — sample of first 25 changed rows

Usage
-----
  SUPABASE_SERVICE_KEY=xxx python3 separator/routing_dry_run.py
  SUPABASE_SERVICE_KEY=xxx python3 separator/routing_dry_run.py --sample 30

Stop criteria (per spec)
  If no reviews would move  → flags and exits with code 1
  If >20 reviews would move → flags and continues (you decide whether to proceed)
"""

import argparse
import csv
import datetime
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from filters.stage_1 import run_stage_1
from routing import assign_bucket

SUPABASE_URL = 'https://rxrhvbfutjahgwaambqd.supabase.co'
SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')

if not SERVICE_KEY:
    print('ERROR: SUPABASE_SERVICE_KEY not set', file=sys.stderr)
    sys.exit(1)

_HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
}


# ── Supabase fetch ────────────────────────────────────────────────────────────

def _get(url: str) -> 'list | None':
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return None, body
    return None, 'unknown error'


def fetch_inkout_reviews() -> list[dict]:
    """Fetch all inkOUT reviews from Supabase with pagination."""
    # Try with routing_reason; fall back if column doesn't exist yet
    fields_full = (
        'id,reviewer_name,provider_name,location_city,location_state,'
        'bucket,routing_reason,review_text,result_rating,star_rating'
    )
    fields_minimal = (
        'id,reviewer_name,provider_name,location_city,location_state,'
        'bucket,review_text,result_rating,star_rating'
    )

    rows = []
    page_size = 1000
    offset = 0
    has_routing_reason = True

    while True:
        fields = fields_full if has_routing_reason else fields_minimal
        url = (
            f'{SUPABASE_URL}/rest/v1/competitor_reviews'
            f'?select={fields}'
            f'&provider_name=eq.inkOUT'
            f'&limit={page_size}&offset={offset}'
        )
        req = urllib.request.Request(url, headers=_HEADERS)
        try:
            with urllib.request.urlopen(req) as resp:
                page = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if has_routing_reason and 'routing_reason' in body:
                # Column not yet in schema — retry without it
                has_routing_reason = False
                print('  (routing_reason column not found — current_reason will show as unknown)')
                continue
            print(f'Supabase error {e.code}: {body}', file=sys.stderr)
            sys.exit(1)

        if not page:
            break
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size

    if not has_routing_reason:
        for r in rows:
            r.setdefault('routing_reason', None)

    return rows


# ── Per-review re-routing ─────────────────────────────────────────────────────

def _star_classification(star_rating) -> 'str | None':
    """Star-based classification used when result_rating=unknown (no LLM in dry-run)."""
    try:
        stars = int(star_rating or 5)
    except (TypeError, ValueError):
        return None
    if stars <= 2:
        return 'negative'
    if stars == 3:
        return 'ambiguous'
    return 'neutral_positive'


def apply_new_routing(row: dict) -> tuple[str, str]:
    """Return (proposed_bucket, proposed_reason) using the new routing logic."""
    text = row.get('review_text') or ''
    result_rating = row.get('result_rating') or 'unknown'

    # Re-derive Stage 1 from text (not stored in Supabase)
    s1 = run_stage_1(text)

    record = {
        'pre_rebrand_date_routed': False,
        'stage_1_hit': s1['stage_1_hit'],
        'stage_1_bridging_flag': s1['stage_1_bridging_flag'],
        'result_rating': result_rating,
        'review_text': text,
    }

    # For unknown result_rating, supply a star-based classification so the
    # LLM fallback path has something to work with (no LLM calls in dry-run).
    if result_rating == 'unknown':
        record['stage_2_classification'] = _star_classification(row.get('star_rating'))
    else:
        record['stage_2_classification'] = None

    bucket = assign_bucket(record, raw_text=text)
    reason = record.get('routing_reason', 'unknown')
    return bucket, reason


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Dry-run the new routing logic against Supabase inkOUT data'
    )
    parser.add_argument(
        '--sample', type=int, default=25, metavar='N',
        help='Number of changed rows to print to stdout (default: 25)',
    )
    args = parser.parse_args()

    print('\nRouting dry-run — inkOUT reviews in Supabase')
    print('=' * 60)
    print('Fetching reviews...')

    reviews = fetch_inkout_reviews()
    print(f'Fetched {len(reviews)} inkOUT reviews\n')

    if not reviews:
        print('No inkOUT reviews found — check provider_name filter', file=sys.stderr)
        sys.exit(1)

    # Apply new routing to every review
    diff_rows = []
    move_counts: dict[str, int] = {}
    unchanged = 0

    for row in reviews:
        current_bucket = row.get('bucket') or 'unknown'
        current_reason = row.get('routing_reason') or 'unknown'
        proposed_bucket, proposed_reason = apply_new_routing(row)

        move_key = f'{current_bucket} → {proposed_bucket}'
        move_counts[move_key] = move_counts.get(move_key, 0) + 1

        if proposed_bucket != current_bucket:
            preview = (row.get('review_text') or '')[:120].replace('\n', ' ')
            diff_rows.append({
                'review_id':        row.get('id', ''),
                'reviewer_name':    row.get('reviewer_name', ''),
                'provider':         f"{row.get('provider_name', '')} ({row.get('location_city', '')}, {row.get('location_state', '')})",
                'current_bucket':   current_bucket,
                'proposed_bucket':  proposed_bucket,
                'current_reason':   current_reason,
                'proposed_reason':  proposed_reason,
                'review_text_preview': preview,
            })
        else:
            unchanged += 1

    # ── Print summary ──────────────────────────────────────────────────────────
    print('Routing dry-run diff:')
    for move, count in sorted(move_counts.items(), key=lambda x: -x[1]):
        arrow_parts = move.split(' → ')
        unchanged_move = len(arrow_parts) == 2 and arrow_parts[0] == arrow_parts[1]
        flag = '' if unchanged_move else '  ← MOVES'
        print(f'  {move}: {count} reviews{flag}')
    print(f'\n  Total reviews evaluated: {len(reviews)}')
    print(f'  Total reviews that would move: {len(diff_rows)}')

    # ── Stop criteria ──────────────────────────────────────────────────────────
    if len(diff_rows) == 0:
        print('\n⚠  STOP: no reviews would move — keyword matching may not be firing.', file=sys.stderr)
        print('  Check that result_rating values are populated in Supabase.', file=sys.stderr)
        sys.exit(1)

    if len(diff_rows) > 20:
        print(f'\n⚠  NOTE: {len(diff_rows)} reviews would move (>20 expected max).')
        print('  Review the CSV before approving a production run.')

    # ── Write CSV ──────────────────────────────────────────────────────────────
    out_dir = Path(__file__).parent.parent / 'output'
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    csv_path = out_dir / f'routing_dry_run_{ts}.csv'

    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'review_id', 'reviewer_name', 'provider',
            'current_bucket', 'proposed_bucket',
            'current_reason', 'proposed_reason',
            'review_text_preview',
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(diff_rows)

    print(f'\nFull diff saved → {csv_path}')

    # ── Print sample ───────────────────────────────────────────────────────────
    sample = diff_rows[:args.sample]
    print(f'\nSample — first {len(sample)} of {len(diff_rows)} reviews that would move:')
    print('-' * 60)
    for i, r in enumerate(sample, 1):
        print(f"\n[{i}] {r['reviewer_name']} — {r['provider']}")
        print(f"    {r['current_bucket']} ({r['current_reason']}) → {r['proposed_bucket']} ({r['proposed_reason']})")
        print(f"    \"{r['review_text_preview']}\"")

    print('\n' + '=' * 60)
    print('Next step: review the CSV, then run separator/run.py on current data')
    print('with the new logic and re-import if you approve.')


if __name__ == '__main__':
    main()
