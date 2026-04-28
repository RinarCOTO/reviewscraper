import json, csv
from pathlib import Path

results_file = Path(__file__).parent / "qwen-service-type-results.json"
csv_file = Path(__file__).parent / "reviews-service-type-test.csv"

# Load results keyed by id
with open(results_file) as f:
    results = {r["id"]: r for r in json.load(f)}

# Load reviews for text context
with open(csv_file, encoding="utf-8") as f:
    reviews = {r["id"]: r for r in csv.DictReader(f)}

print(f"{'#':<3} {'Provider':<22} {'service_type':<18} {'result_rating':<14} Review snippet")
print("-" * 95)
for i, (rid, res) in enumerate(results.items(), 1):
    rev = reviews.get(rid, {})
    provider = (rev.get("provider_name", "") or "")[:20]
    text = (rev.get("review_text", "") or "").replace("\n", " ")[:55]
    st = res.get("service_type", "—")
    rr = res.get("result_rating", "—")
    print(f"{i:<3} {provider:<22} {st:<18} {rr:<14} {text}")

print()
print("=== service_type breakdown ===")
from collections import Counter
counts = Counter(r.get("service_type", "unknown") for r in results.values())
for st, count in sorted(counts.items(), key=lambda x: -x[1]):
    print(f"  {st:<20} {count}")
