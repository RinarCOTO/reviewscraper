def assign_bucket(record: dict) -> str:
    # Per-clinic pre-rebrand date auto-route (optional clinics.csv)
    if record.get('pre_rebrand_date_routed'):
        return 'tatt2away'

    # Stage 1: explicit Tatt2Away name mention → tatt2away regardless of content
    if record.get('stage_1_hit'):
        return 'tatt2away'

    # Bridging language without a Stage 1 hit → manual queue for editorial judgment
    if record.get('stage_1_bridging_flag'):
        return 'review_required'

    classification = record.get('stage_2_classification')
    confidence = float(record.get('stage_2_confidence') or 0.0)

    if classification == 'negative':
        return 'tatt2away' if confidence >= 0.75 else 'review_required'
    if classification == 'ambiguous':
        return 'review_required'

    return 'inkout'
