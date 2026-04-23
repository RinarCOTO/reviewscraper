import json
import re
from typing import Optional

import anthropic

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

# Bare "painful" or "hurt" excluded intentionally — too noisy
_SEVERE_PAIN_PATTERNS = [
    r'excruciating',
    r'unbearable',
    r'worst\s+pain',
    r'agonizing',
    r'brutal',
    r'horrible\s+pain',
]

_FAILURE_PATTERNS = [
    r"didn[’']t\s+work",
    r'no\s+results',
    r'wasted\s+money',
    r'regret',
    r'botched',
    r'ruined',
    r'made\s+it\s+worse',
    r'permanent\s+damage',
    r'burn(?:ed)?',
    r'blister',
]

_ABANDONMENT_PATTERNS = [
    r'stopped\s+treatment',
    r'gave\s+up',
    r'\bquit\b',
    r'switched\s+providers',
    r'had\s+to\s+go\s+elsewhere',
]

_STAGE2A_RE = re.compile(
    '|'.join(
        f'(?:{p})'
        for p in (
            _SCARRING_PATTERNS
            + _SEVERE_PAIN_PATTERNS
            + _FAILURE_PATTERNS
            + _ABANDONMENT_PATTERNS
        )
    ),
    re.IGNORECASE,
)

_CLASSIFY_PROMPT = """\
You are classifying a tattoo removal customer review. The review has been \
flagged because it contains language that may describe a negative outcome \
(scarring, severe pain, treatment failure, or abandonment).

Determine whether the review actually describes a negative outcome the \
customer experienced, or whether the flagged language appears in a \
positive or neutral context (e.g., "no scarring at all," "painless \
compared to what I feared," "didn't work for my friend but worked for me").

Review text:
---
{raw_text}
---

Respond in JSON only:
{{
  "classification": "negative" | "neutral_positive" | "ambiguous",
  "confidence": 0.0 to 1.0,
  "reasoning": "one sentence"
}}"""


def run_stage_2a(text: str) -> dict:
    matches = [m.group() for m in _STAGE2A_RE.finditer(text)]
    return {
        'stage_2_flagged': bool(matches),
        'stage_2_matched_terms': matches,
    }


def run_stage_2b(text: str, client: anthropic.Anthropic) -> dict:
    prompt = _CLASSIFY_PROMPT.format(raw_text=text)
    message = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=256,
        messages=[{'role': 'user', 'content': prompt}],
    )
    raw = message.content[0].text.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract the first JSON object from the response
        m = re.search(r'\{[^{}]+\}', raw, re.DOTALL)
        if m:
            try:
                result = json.loads(m.group())
            except json.JSONDecodeError:
                result = {}
        else:
            result = {}

    return {
        'stage_2_classification': result.get('classification', 'ambiguous'),
        'stage_2_confidence': float(result.get('confidence', 0.5)),
        'stage_2_reasoning': result.get('reasoning', 'parse error'),
    }
