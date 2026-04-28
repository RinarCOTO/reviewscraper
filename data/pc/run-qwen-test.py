"""
Run Qwen on golden dataset via Ollama API.

Usage:
  1. Place qwen-input.json and qwen-analyzer-prompt.txt in the same folder
  2. Make sure Ollama is running (ollama serve)
  3. python run-qwen-test.py

Output: qwen-results.json
"""

import json, requests, time, sys

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "qwen2.5:14b"

# Load prompt template
with open("qwen-analyzer-prompt.txt", "r") as f:
    PROMPT_TEMPLATE = f.read()

# Load reviews
with open("qwen-input.json", "r") as f:
    reviews = json.load(f)

print(f"Loaded {len(reviews)} reviews. Running {MODEL}...\n")

results = []
errors = []

for i, review in enumerate(reviews):
    brand = (review.get("brand_name") or "unknown")[:20]
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
        # Strip markdown fences if present
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

# Save results
with open("qwen-results.json", "w") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"\n{'='*50}")
print(f"Done: {len(results) - len(errors)} success, {len(errors)} errors")
print(f"Saved to qwen-results.json")

if errors:
    print(f"\nErrors:")
    for e in errors:
        print(f"  {e}")
