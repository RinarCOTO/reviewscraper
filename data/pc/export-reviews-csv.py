"""
Export competitor_reviews from Supabase to reviews.csv.

Usage:
  1. Set SUPABASE_SERVICE_KEY as an env var, or paste it below
  2. python export-reviews-csv.py

Output: reviews.csv (in the same folder)
"""

import csv, requests
from pathlib import Path

SUPABASE_URL = "https://rxrhvbfutjahgwaambqd.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cmh2YmZ1dGphaGd3YWFtYnFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM1MTcwNywiZXhwIjoyMDkxOTI3NzA3fQ.06-kZtLuaPlukmFE9wJESRdVzgdv-LQW5Ffr64_BbWs"

OUTPUT_FILE = Path(__file__).parent / "reviews.csv"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
}

FIELDS = ["id", "brand_name", "location_city", "location_state", "review_text", "star_rating"]

print("Fetching reviews from Supabase...")

all_rows = []
page_size = 500
offset = 0

while True:
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/competitor_reviews",
        headers={**HEADERS, "Range-Unit": "items", "Range": f"{offset}-{offset + page_size - 1}"},
        params={
            "select": ",".join(FIELDS),
            "status": "eq.published",
            "order": "brand_name.asc",
        },
        timeout=30,
    )
    rows = resp.json()
    if not rows:
        break
    all_rows.extend(rows)
    print(f"  fetched {len(all_rows)} rows...")
    if len(rows) < page_size:
        break
    offset += page_size

with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=FIELDS)
    writer.writeheader()
    writer.writerows(all_rows)

print(f"\nDone: {len(all_rows)} reviews saved to {OUTPUT_FILE.name}")
print("Next step: python run-qwen-batch.py")
