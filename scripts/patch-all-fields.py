"""
Patch ALL Qwen output fields to Supabase (service_type + result_rating + all others).
Use this after running Qwen with the service_type prompt.

Usage:
  python patch-all-fields.py
  python patch-all-fields.py --input qwen-service-type-batch2.json
"""

import json, sys, urllib.request
from pathlib import Path

SUPABASE_URL = "https://rxrhvbfutjahgwaambqd.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cmh2YmZ1dGphaGd3YWFtYnFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM1MTcwNywiZXhwIjoyMDkxOTI3NzA3fQ.06-kZtLuaPlukmFE9wJESRdVzgdv-LQW5Ffr64_BbWs"

_args = sys.argv[1:]
_input_arg = None
for _i, _a in enumerate(_args):
    if _a.startswith("--input="):
        _input_arg = _a.split("=", 1)[1]
        break
    elif _a == "--input" and _i + 1 < len(_args):
        _input_arg = _args[_i + 1]
        break
INPUT_FILE = Path(__file__).parent / (_input_arg or "qwen-results-full.json")

PATCHABLE_FIELDS = [
    "service_type", "result_rating", "pain_level",
    "scarring_mentioned", "sessions_completed",
    "skin_type", "use_case", "review_summary",
]

VALID_SERVICE_TYPES = {"tattoo_removal", "hair_removal", "facial", "injectables", "microblading", "other", "unknown"}

with open(INPUT_FILE) as f:
    results = json.load(f)

print(f"Loaded {len(results)} results from {INPUT_FILE.name}")

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

patched = skipped = errors = 0
for i, row in enumerate(results):
    rid = row.get("id")
    if not rid:
        skipped += 1
        continue

    patch = {}
    for field in PATCHABLE_FIELDS:
        val = row.get(field)
        if val is None:
            continue
        if field == "service_type" and val not in VALID_SERVICE_TYPES:
            continue
        if field == "result_rating" and val in ("PARSE_ERROR", "ERROR"):
            continue
        patch[field] = val

    if not patch:
        skipped += 1
        continue

    url = f"{SUPABASE_URL}/rest/v1/competitor_reviews?id=eq.{rid}"
    body = json.dumps(patch).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req) as r:
            r.read()
        patched += 1
    except Exception as e:
        print(f"  Error on {rid}: {e}")
        errors += 1

    if (i + 1) % 100 == 0:
        print(f"  {i+1}/{len(results)} processed...")

print(f"\nDone: {patched} patched, {skipped} skipped, {errors} errors")
