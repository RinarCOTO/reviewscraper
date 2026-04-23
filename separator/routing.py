from datetime import datetime, timezone

# Universal rebrand date — all clinics switched to inkOUT on this date
REBRAND_DATE = datetime(2025, 12, 20, tzinfo=timezone.utc)


def assign_bucket(record: dict) -> str:
    # Per-clinic pre-rebrand date auto-route (optional clinics.csv)
    if record.get('pre_rebrand_date_routed'):
        return 'tatt2away'

    # Stage 1 name match → tatt2away regardless of era
    if record.get('stage_1_hit'):
        return 'tatt2away'

    # Post-rebrand (inkOUT era): all reviews go to inkout
    # User reviews the inkout bucket personally
    if record.get('post_rebrand'):
        return 'inkout'

    # Pre-rebrand era: route by LLM outcome classification
    classification = record.get('stage_2_classification')
    if classification == 'negative':
        return 'tatt2away'
    if classification == 'ambiguous':
        # Ambiguous pre-rebrand → conservative, send to tatt2away
        return 'tatt2away'

    return 'inkout'
