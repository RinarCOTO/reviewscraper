import re

# Explicit name-mention patterns — longest/most-specific first
_TATT2AWAY_PATTERNS = [
    r'tatt2away',
    r'tatt-2-away',
    r'tattooaway',
    r'tattoo\s+away',
    r'tatt\s+2\s+away',
    r'tatt\s+away',
    r'tat2away',
    r'\btatt2\b',
    r'\bt2a\b',
]

# Bridging-language patterns — recorded separately, do not auto-route
_BRIDGING_PATTERNS = [
    r'rebrand(?:ed)?',
    r'used\s+to\s+be\s+called',
    r'formerly\s+known\s+as',
    r'new\s+name',
    r'name\s+change',
]

_TATT2AWAY_RE = re.compile(
    '|'.join(f'(?:{p})' for p in _TATT2AWAY_PATTERNS),
    re.IGNORECASE,
)
_BRIDGING_RE = re.compile(
    '|'.join(f'(?:{p})' for p in _BRIDGING_PATTERNS),
    re.IGNORECASE,
)


def run_stage_1(text: str) -> dict:
    tatt2away_matches = [m.group() for m in _TATT2AWAY_RE.finditer(text)]
    bridging_matches = [m.group() for m in _BRIDGING_RE.finditer(text)]
    return {
        'stage_1_hit': bool(tatt2away_matches),
        'stage_1_matched_terms': tatt2away_matches,
        'stage_1_bridging_flag': bool(bridging_matches),
        'stage_1_bridging_terms': bridging_matches,
    }
