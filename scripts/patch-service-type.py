"""
Patch service_type field from Qwen results to Supabase.

Usage:
  python patch-service-type.py
  python patch-service-type.py --input qwen-service-type-full.json
"""

import json, sys, time, urllib.request
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
INPUT_FILE = Path(__file__).parent / (_input_arg or "qwen-service-type-full.json")

VALID_VALUES = {"tattoo_removal", "hair_removal", "facial", "injectables", "microblading", "other", "unknown"}

with open(INPUT_FILE) as f:
    results = json.load(f)

print(f"Loaded {len(results)} results from {INPUT_FILE.name}")

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

skipped = patched = errors = 0
for i, row in enumerate(results):
    rid = row.get("id")
    service_type = row.get("service_type", "").strip()

    if not rid or service_type not in VALID_VALUES:
        skipped += 1
        continue

    url = f"{SUPABASE_URL}/rest/v1/competitor_reviews?id=eq.{rid}"
    body = json.dumps({"service_type": service_type}).encode()
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
