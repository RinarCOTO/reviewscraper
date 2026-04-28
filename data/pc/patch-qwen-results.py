"""
Patch competitor_reviews in Supabase with Qwen analysis results.

Usage:
  1. Place qwen-results-full.json in the same folder as this script (or update INPUT_FILE)
  2. Run: python scripts/patch-qwen-results.py

Requires SUPABASE_SERVICE_KEY in .env (loaded automatically).
"""

import json, os, requests
from pathlib import Path

# Load .env from project root
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = "https://rxrhvbfutjahgwaambqd.supabase.co"
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cmh2YmZ1dGphaGd3YWFtYnFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM1MTcwNywiZXhwIjoyMDkxOTI3NzA3fQ.06-kZtLuaPlukmFE9wJESRdVzgdv-LQW5Ffr64_BbWs")

INPUT_FILE = Path(__file__).parent / "qwen-results-full.json"
if not INPUT_FILE.exists():
    raise SystemExit(f"Not found: {INPUT_FILE}\nPlace qwen-results-full.json next to this script.")

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

FIELDS = ["result_rating", "pain_level", "scarring_mentioned",
          "sessions_completed", "skin_type", "use_case", "review_summary"]

with open(INPUT_FILE, encoding="utf-8", errors="replace") as f:
    results = json.load(f)

print(f"Loaded {len(results)} Qwen results")
print(f"Patching competitor_reviews...\n")

ok = 0
skipped = 0
errors = []

for i, row in enumerate(results):
    rid = row.get("id")
    if not rid:
        skipped += 1
        continue

    patch = {k: row[k] for k in FIELDS if k in row}

    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/competitor_reviews?id=eq.{rid}",
        headers=HEADERS,
        json=patch,
        timeout=30,
    )

    if resp.status_code in (200, 204):
        ok += 1
    else:
        errors.append({"id": rid, "status": resp.status_code, "body": resp.text[:200]})

    if (i + 1) % 100 == 0:
        print(f"  [{i+1}/{len(results)}] {ok} updated, {len(errors)} errors")

print(f"\n{'='*50}")
print(f"Done: {ok} updated, {skipped} skipped, {len(errors)} errors")

if errors:
    print("\nFirst errors:")
    for e in errors[:5]:
        print(f"  {e}")
