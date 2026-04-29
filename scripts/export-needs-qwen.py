"""
Export reviews that need Qwen classification:
- result_rating is NULL or 'unknown', OR service_type is NULL
- review_text has meaningful content (> 20 chars)
"""

import json, csv, urllib.request, urllib.parse
from pathlib import Path

SUPABASE_URL = "https://rxrhvbfutjahgwaambqd.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cmh2YmZ1dGphaGd3YWFtYnFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM1MTcwNywiZXhwIjoyMDkxOTI3NzA3fQ.06-kZtLuaPlukmFE9wJESRdVzgdv-LQW5Ffr64_BbWs"
headers = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}

all_rows = []
offset = 0
while True:
    # Fetch rows where result_rating is null/unknown OR service_type is null
    url = (
        f"{SUPABASE_URL}/rest/v1/competitor_reviews"
        f"?select=id,provider_name,location_city,location_state,star_rating,review_text"
        f"&or=(result_rating.is.null,result_rating.eq.unknown,service_type.is.null)"
        f"&limit=1000&offset={offset}&order=id"
    )
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as r:
        rows = json.loads(r.read())
    all_rows.extend(rows)
    if len(rows) < 1000:
        break
    offset += 1000

# Filter to rows with meaningful text
filtered = [r for r in all_rows if len((r.get("review_text") or "").strip()) > 20]

out = Path(__file__).parent / "reviews-needs-qwen.csv"
with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["id","provider_name","location_city","location_state","star_rating","review_text"])
    w.writeheader()
    for row in filtered:
        w.writerow({k: row.get(k, "") or "" for k in ["id","provider_name","location_city","location_state","star_rating","review_text"]})

print(f"Exported {len(filtered)} reviews (from {len(all_rows)} total needing classification)")
print(f"Saved to {out.name}")
