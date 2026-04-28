"""
Push Qwen results back to Supabase.

Usage:
  1. pip install supabase
  2. Set your SUPABASE_KEY below or as env var
  3. python upsert-qwen.py

Reads: qwen-results-full.json
Updates: competitor_reviews table
"""

import json, os

from supabase import create_client

URL = "https://rxrhvbfutjahgwaambqd.supabase.co"
KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cmh2YmZ1dGphaGd3YWFtYnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTE3MDcsImV4cCI6MjA5MTkyNzcwN30.d9juaTC-mzWsxtej5MbK0neIZ6bKv73BgtGrMydhLsA")

supabase = create_client(URL, KEY)

results = json.load(open("qwen-results-full.json", "r", encoding="utf-8-sig", errors="replace"))
print(f"Loaded {len(results)} results\n")

success = 0
errors = 0

for i, r in enumerate(results):
    if r.get("result_rating") in ("PARSE_ERROR", "ERROR"):
        print(f"[{i+1}] Skipping {r['id'][:8]} (error)")
        errors += 1
        continue

    try:
        supabase.table("competitor_reviews").update({
            "result_rating": r.get("result_rating"),
            "pain_level": r.get("pain_level"),
            "scarring_mentioned": r.get("scarring_mentioned"),
            "sessions_completed": r.get("sessions_completed"),
            "skin_type": r.get("skin_type"),
            "use_case": r.get("use_case"),
            "review_summary": r.get("review_summary")
        }).eq("id", r["id"]).execute()

        success += 1
        if (i + 1) % 50 == 0:
            print(f"[{i+1}/{len(results)}] {success} updated...")

    except Exception as e:
        print(f"[{i+1}] ERROR on {r['id'][:8]}: {e}")
        errors += 1

print(f"\nDone: {success} updated, {errors} errors")
