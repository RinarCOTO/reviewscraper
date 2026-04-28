"""
Batch run Qwen on ALL reviews from exported Supabase CSV.

Usage:
  1. Export competitor_reviews from Supabase as 'reviews.csv' into this folder
  2. Place qwen-analyzer-prompt.txt in this folder
  3. Make sure Ollama is running: ollama serve
  4. python run-qwen-batch.py

Output: qwen-results-full.json
Then run: python patch-qwen-results.py
"""

import json, csv, requests, time, os, sys
from pathlib import Path

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "qwen2.5:14b"

# --input flag support
_input_arg = next((a.split("=",1)[1] for a in sys.argv[1:] if a.startswith("--input=")), None)
if not _input_arg:
    _input_arg = next((sys.argv[i+1] for i, a in enumerate(sys.argv[1:]) if a == "--input" and i+1 < len(sys.argv[1:])), None)
INPUT_CSV = Path(__file__).parent / (_input_arg or "reviews.csv")

OUTPUT_FILE = Path(__file__).parent / "qwen-results-full.json"
PROMPT_FILE = Path(__file__).parent / "qwen-analyzer-prompt.txt"

with open(PROMPT_FILE, "r") as f:
    PROMPT_TEMPLATE = f.read()

reviews = []
with open(INPUT_CSV, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        text = row.get("review_text", "").strip()
        if text and len(text) > 20:
            reviews.append({
                "id": row["id"],
                "brand_name": row.get("brand_name", ""),
                "location_city": row.get("location_city", ""),
                "star_rating": row.get("star_rating", ""),
                "review_text": text
            })

print(f"Loaded {len(reviews)} reviews from {INPUT_CSV.name}")
print(f"Model: {MODEL}")
print(f"Estimated time: ~{len(reviews) * 0.4:.0f}-{len(reviews) * 0.7:.0f} seconds\n")

done_ids = set()
results = []
if OUTPUT_FILE.exists():
    with open(OUTPUT_FILE, "r") as f:
        results = json.load(f)
        done_ids = {r["id"] for r in results}
    print(f"Resuming: {len(done_ids)} already done, {len(reviews) - len(done_ids)} remaining\n")

errors = []
save_every = 10

for i, review in enumerate(reviews):
    if review["id"] in done_ids:
        continue

    brand = (review.get("brand_name") or review.get("provider_name") or "unknown")[:20]
    print(f"[{i+1}/{len(reviews)}] {brand.ljust(20)} ", end="", flush=True)

    prompt = PROMPT_TEMPLATE.replace("{{REVIEW_TEXT}}", review["review_text"])

    try:
        start = time.time()
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0}
        }, timeout=120)

        raw = resp.json()["response"].strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

        parsed = json.loads(raw)
        elapsed = time.time() - start

        results.append({"id": review["id"], **parsed})
        print(f"✅ {parsed.get('result_rating', '?')} ({elapsed:.1f}s)")

    except json.JSONDecodeError:
        print(f"⚠️  bad JSON")
        errors.append({"id": review["id"], "raw": raw[:200]})
        results.append({"id": review["id"], "result_rating": "PARSE_ERROR"})
    except Exception as e:
        print(f"❌ {e}")
        errors.append({"id": review["id"], "error": str(e)})
        results.append({"id": review["id"], "result_rating": "ERROR"})

    if (i + 1) % save_every == 0:
        with open(OUTPUT_FILE, "w") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

with open(OUTPUT_FILE, "w") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"\n{'='*50}")
print(f"Done: {len(results) - len(errors)} success, {len(errors)} errors")
print(f"Saved to {OUTPUT_FILE.name}")
print(f"\nNext step: python patch-qwen-results.py")

if errors:
    print(f"\nErrors ({len(errors)}):")
    for e in errors[:10]:
        print(f"  {e}")
