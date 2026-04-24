import re

# ── Keyword families for routing discrimination ───────────────────────────────
# These lists match the analyzer spec. "painful" and "hurt" are intentionally
# excluded — too noisy in removal reviews where some pain is expected.

_SCARRING_PATTERNS = [
    r'scar(?:ring|red)?',
    r'keloid',
    r'raised\s+tissue',
    r'indent',
    r'divot',
    r'hypopigmentation',
    r'hyperpigmentation',
    r'discoloration',
    r'white\s+patch',
    r'dark\s+patch',
    r'uneven\s+skin',
]

_SEVERE_PAIN_PATTERNS = [
    r'excruciating',
    r'unbearable',
    r'worst\s+pain',
    r'agonizing',
    r'brutal',
    r'horrible\s+pain',
]

_SCARRING_RE = re.compile(
    '|'.join(f'(?:{p})' for p in _SCARRING_PATTERNS),
    re.IGNORECASE,
)
_SEVERE_PAIN_RE = re.compile(
    '|'.join(f'(?:{p})' for p in _SEVERE_PAIN_PATTERNS),
    re.IGNORECASE,
)


def _has_scarring(text: str) -> bool:
    return bool(_SCARRING_RE.search(text))


def _has_severe_pain(text: str) -> bool:
    return bool(_SEVERE_PAIN_RE.search(text))


def assign_bucket(record: dict, raw_text: str = '') -> str:
    """Assign a bucket and set record['routing_reason']. Returns the bucket name.

    raw_text — full review text for keyword matching. Falls back to
               record['review_text'] if omitted (e.g. in tests).
    """
    text = raw_text or record.get('review_text', '') or ''

    # Per-clinic pre-rebrand date auto-route
    if record.get('pre_rebrand_date_routed'):
        record['routing_reason'] = 'pre_rebrand_date'
        return 'tatt2away'

    # Stage 1: explicit Tatt2Away name mention → tatt2away regardless of content
    if record.get('stage_1_hit'):
        record['routing_reason'] = 'stage_1_name_hit'
        return 'tatt2away'

    # Stage 1: bridging language without a name hit → manual editorial queue
    if record.get('stage_1_bridging_flag'):
        record['routing_reason'] = 'stage_1_bridging_language'
        return 'review_required'

    result_rating = record.get('result_rating') or 'unknown'

    # result_rating drives routing for all reviews the analyzer classified.
    # Only scarring and severe-pain negatives go to tatt2away — these are the
    # specific reputation issues the rebrand was meant to address. Other negative
    # outcomes (customer service, pricing, scheduling) stay in the inkOUT pool.
    if result_rating == 'Negative':
        if _has_scarring(text):
            record['routing_reason'] = 'result_rating_negative_scarring'
            return 'tatt2away'
        if _has_severe_pain(text):
            record['routing_reason'] = 'result_rating_negative_pain'
            return 'tatt2away'
        record['routing_reason'] = 'result_rating_negative_other'
        return 'inkout'

    if result_rating == 'Mixed':
        record['routing_reason'] = 'result_rating_mixed'
        return 'inkout'

    if result_rating in ('Positive', 'Neutral'):
        record['routing_reason'] = 'result_rating_positive_neutral'
        return 'inkout'

    # result_rating == 'unknown': fall back to stage_2_classification (LLM or star signal).
    # Apply the same scarring/pain discrimination to the LLM negative path.
    classification = record.get('stage_2_classification')

    if classification == 'negative':
        if _has_scarring(text):
            record['routing_reason'] = 'llm_fallback_negative_scarring'
            return 'tatt2away'
        if _has_severe_pain(text):
            record['routing_reason'] = 'llm_fallback_negative_pain'
            return 'tatt2away'
        record['routing_reason'] = 'llm_fallback_negative_other'
        return 'inkout'

    if classification == 'ambiguous':
        record['routing_reason'] = 'llm_fallback_ambiguous'
        return 'review_required'

    if classification == 'neutral_positive':
        record['routing_reason'] = 'llm_fallback_neutral_positive'
        return 'inkout'

    record['routing_reason'] = 'no_signal'
    return 'inkout'
