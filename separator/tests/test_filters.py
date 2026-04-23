"""
Unit tests covering all six specified fixtures plus edge cases.
LLM calls in Stage 2B are mocked — no real API calls.
"""
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Make sure separator/ is importable regardless of cwd
sys.path.insert(0, str(Path(__file__).parent.parent))

from filters.stage_1 import run_stage_1
from filters.stage_2 import run_stage_2a, run_stage_2b
from routing import assign_bucket


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _llm_response(classification: str, confidence: float, reasoning: str) -> MagicMock:
    """Build a fake anthropic response object."""
    import json
    content = json.dumps({
        'classification': classification,
        'confidence': confidence,
        'reasoning': reasoning,
    })
    msg = MagicMock()
    msg.content = [MagicMock(text=content)]
    return msg


def _make_client(classification: str, confidence: float = 0.9, reasoning: str = 'test') -> MagicMock:
    client = MagicMock()
    client.messages.create.return_value = _llm_response(classification, confidence, reasoning)
    return client


# ---------------------------------------------------------------------------
# Stage 1 tests
# ---------------------------------------------------------------------------

class TestStage1(unittest.TestCase):

    # Fixture 1
    def test_tatt2away_exact(self):
        result = run_stage_1("I went to Tatt2Away")
        self.assertTrue(result['stage_1_hit'])
        self.assertIn('Tatt2Away', result['stage_1_matched_terms'])
        self.assertFalse(result['stage_1_bridging_flag'])

    def test_tatt_2_away_spaced(self):
        result = run_stage_1("The clinic is tatt 2 away")
        self.assertTrue(result['stage_1_hit'])

    def test_tatt_hyphen(self):
        result = run_stage_1("went to tatt-2-away last week")
        self.assertTrue(result['stage_1_hit'])

    def test_t2a_word_boundary(self):
        result = run_stage_1("treated at T2A clinic")
        self.assertTrue(result['stage_1_hit'])

    def test_t2a_no_word_boundary(self):
        # "t2ar" should NOT match \bt2a\b
        result = run_stage_1("t2ar is not a match")
        self.assertFalse(result['stage_1_hit'])

    def test_tattoo_away(self):
        result = run_stage_1("tattoo away worked great")
        self.assertTrue(result['stage_1_hit'])

    def test_case_insensitive(self):
        result = run_stage_1("TATT2AWAY was amazing")
        self.assertTrue(result['stage_1_hit'])

    # Fixture 4 — bridging flag
    def test_bridging_rebranded(self):
        result = run_stage_1("they rebranded from the old name")
        self.assertFalse(result['stage_1_hit'])
        self.assertTrue(result['stage_1_bridging_flag'])
        self.assertTrue(any('rebrand' in t.lower() for t in result['stage_1_bridging_terms']))

    def test_bridging_formerly_known_as(self):
        result = run_stage_1("formerly known as something else")
        self.assertFalse(result['stage_1_hit'])
        self.assertTrue(result['stage_1_bridging_flag'])

    def test_bridging_name_change(self):
        result = run_stage_1("after the name change I came back")
        self.assertFalse(result['stage_1_hit'])
        self.assertTrue(result['stage_1_bridging_flag'])

    # Fixture 5 — clean review
    def test_clean_review(self):
        result = run_stage_1("Amazing results, highly recommend this place!")
        self.assertFalse(result['stage_1_hit'])
        self.assertFalse(result['stage_1_bridging_flag'])
        self.assertEqual(result['stage_1_matched_terms'], [])

    def test_multiple_matches_recorded(self):
        result = run_stage_1("went to Tatt2Away, also known as tatt away")
        self.assertTrue(result['stage_1_hit'])
        self.assertGreaterEqual(len(result['stage_1_matched_terms']), 2)


# ---------------------------------------------------------------------------
# Stage 2A tests
# ---------------------------------------------------------------------------

class TestStage2A(unittest.TestCase):

    # Fixture 2 — "no scarring at all" still gets flagged by keyword
    def test_scarring_keyword_flagged(self):
        result = run_stage_2a("no scarring at all, amazing results")
        self.assertTrue(result['stage_2_flagged'])
        self.assertTrue(any('scarring' in t.lower() for t in result['stage_2_matched_terms']))

    # Fixture 3 — "left a permanent scar"
    def test_scar_keyword_flagged(self):
        result = run_stage_2a("left a permanent scar on my arm")
        self.assertTrue(result['stage_2_flagged'])

    def test_severe_pain_excruciating(self):
        result = run_stage_2a("the pain was excruciating")
        self.assertTrue(result['stage_2_flagged'])

    def test_bare_painful_not_flagged(self):
        # "painful" alone should NOT trigger (excluded by design)
        result = run_stage_2a("it was a bit painful but worth it")
        self.assertFalse(result['stage_2_flagged'])

    def test_bare_hurt_not_flagged(self):
        result = run_stage_2a("it hurt a little during treatment")
        self.assertFalse(result['stage_2_flagged'])

    def test_failure_didnt_work(self):
        result = run_stage_2a("the treatment didn't work at all")
        self.assertTrue(result['stage_2_flagged'])

    def test_abandonment_switched_providers(self):
        result = run_stage_2a("I switched providers after two sessions")
        self.assertTrue(result['stage_2_flagged'])

    def test_clean_passes(self):
        result = run_stage_2a("Really love the results, skin looks great!")
        self.assertFalse(result['stage_2_flagged'])
        self.assertEqual(result['stage_2_matched_terms'], [])

    def test_keloid(self):
        result = run_stage_2a("developed a keloid after treatment")
        self.assertTrue(result['stage_2_flagged'])

    def test_hyperpigmentation(self):
        result = run_stage_2a("some hyperpigmentation but fading")
        self.assertTrue(result['stage_2_flagged'])


# ---------------------------------------------------------------------------
# Stage 2B tests (mocked LLM)
# ---------------------------------------------------------------------------

class TestStage2B(unittest.TestCase):

    def test_returns_neutral_positive(self):
        client = _make_client('neutral_positive', 0.95, 'negation context')
        result = run_stage_2b("no scarring at all, amazing results", client)
        self.assertEqual(result['stage_2_classification'], 'neutral_positive')
        self.assertAlmostEqual(result['stage_2_confidence'], 0.95)

    def test_returns_negative(self):
        client = _make_client('negative', 0.9, 'clear scar complaint')
        result = run_stage_2b("left a permanent scar", client)
        self.assertEqual(result['stage_2_classification'], 'negative')
        self.assertAlmostEqual(result['stage_2_confidence'], 0.9)

    def test_returns_ambiguous(self):
        client = _make_client('ambiguous', 0.55, 'unclear context')
        result = run_stage_2b("kind of hurt more than expected", client)
        self.assertEqual(result['stage_2_classification'], 'ambiguous')

    def test_malformed_json_falls_back_to_ambiguous(self):
        client = MagicMock()
        client.messages.create.return_value = MagicMock(
            content=[MagicMock(text='not json at all')]
        )
        result = run_stage_2b("some text", client)
        self.assertEqual(result['stage_2_classification'], 'ambiguous')
        self.assertIsNotNone(result['stage_2_reasoning'])

    def test_partial_json_extracted(self):
        import json
        payload = json.dumps({'classification': 'negative', 'confidence': 0.8, 'reasoning': 'ok'})
        client = MagicMock()
        client.messages.create.return_value = MagicMock(
            content=[MagicMock(text=f'Here is the result:\n{payload}\nDone.')]
        )
        result = run_stage_2b("some text", client)
        self.assertEqual(result['stage_2_classification'], 'negative')


# ---------------------------------------------------------------------------
# Routing tests (all six fixtures)
# ---------------------------------------------------------------------------

class TestRouting(unittest.TestCase):

    def _base(self, post_rebrand=False, **overrides) -> dict:
        base = {
            'pre_rebrand_date_routed': False,
            'post_rebrand': post_rebrand,
            'stage_1_hit': False,
            'stage_1_matched_terms': [],
            'stage_1_bridging_flag': False,
            'stage_1_bridging_terms': [],
            'stage_2_flagged': False,
            'stage_2_matched_terms': [],
            'stage_2_classification': None,
            'stage_2_confidence': None,
            'stage_2_reasoning': None,
        }
        base.update(overrides)
        return base

    # --- Original fixtures (pre-rebrand era) ---

    # Fixture 1: Stage 1 hit → tatt2away (any era)
    def test_stage1_hit_routes_tatt2away(self):
        r = self._base(stage_1_hit=True, stage_1_matched_terms=['Tatt2Away'])
        self.assertEqual(assign_bucket(r), 'tatt2away')

    # Fixture 2: pre-rebrand, Stage 2 neutral_positive → inkout
    def test_neutral_positive_routes_inkout(self):
        r = self._base(
            stage_2_flagged=True,
            stage_2_matched_terms=['scarring'],
            stage_2_classification='neutral_positive',
            stage_2_confidence=0.95,
        )
        self.assertEqual(assign_bucket(r), 'inkout')

    # Fixture 3: pre-rebrand, Stage 2 negative high-confidence → tatt2away
    def test_negative_high_confidence_pre_rebrand_routes_tatt2away(self):
        r = self._base(
            post_rebrand=False,
            stage_2_flagged=True,
            stage_2_matched_terms=['scar'],
            stage_2_classification='negative',
            stage_2_confidence=0.9,
        )
        self.assertEqual(assign_bucket(r), 'tatt2away')

    # Fixture 4: Bridging flag, no Stage 1 hit → inkout (recorded but not auto-routed)
    def test_bridging_no_stage1_routes_inkout(self):
        r = self._base(
            stage_1_bridging_flag=True,
            stage_1_bridging_terms=['rebranded'],
        )
        self.assertEqual(assign_bucket(r), 'inkout')

    # Fixture 5: Clean review → inkout
    def test_clean_review_routes_inkout(self):
        r = self._base()
        self.assertEqual(assign_bucket(r), 'inkout')

    # Fixture 6: Pre-rebrand date auto-route → tatt2away
    def test_pre_rebrand_date_routes_tatt2away(self):
        r = self._base(pre_rebrand_date_routed=True)
        self.assertEqual(assign_bucket(r), 'tatt2away')

    # --- Pre-rebrand era edge cases ---

    def test_negative_pre_rebrand_any_confidence_routes_tatt2away(self):
        for conf in [0.4, 0.6, 0.9]:
            r = self._base(
                post_rebrand=False,
                stage_2_flagged=True,
                stage_2_classification='negative',
                stage_2_confidence=conf,
            )
            self.assertEqual(assign_bucket(r), 'tatt2away', f"conf={conf}")

    # --- Post-rebrand era: everything goes to inkout except Stage 1 hits ---

    def test_negative_post_rebrand_routes_inkout(self):
        # Bad inkOUT review → inkout, user reviews it personally
        r = self._base(
            post_rebrand=True,
            stage_2_flagged=True,
            stage_2_classification='negative',
            stage_2_confidence=0.9,
        )
        self.assertEqual(assign_bucket(r), 'inkout')

    def test_ambiguous_post_rebrand_routes_inkout(self):
        r = self._base(
            post_rebrand=True,
            stage_2_flagged=True,
            stage_2_classification='ambiguous',
            stage_2_confidence=0.8,
        )
        self.assertEqual(assign_bucket(r), 'inkout')

    def test_neutral_positive_post_rebrand_routes_inkout(self):
        r = self._base(
            post_rebrand=True,
            stage_2_flagged=True,
            stage_2_classification='neutral_positive',
            stage_2_confidence=0.95,
        )
        self.assertEqual(assign_bucket(r), 'inkout')

    def test_clean_post_rebrand_routes_inkout(self):
        r = self._base(post_rebrand=True)
        self.assertEqual(assign_bucket(r), 'inkout')

    def test_stage1_hit_post_rebrand_still_routes_tatt2away(self):
        # Explicitly naming Tatt2Away in a post-rebrand review → still tatt2away
        r = self._base(
            post_rebrand=True,
            stage_1_hit=True,
            stage_1_matched_terms=['Tatt2Away'],
        )
        self.assertEqual(assign_bucket(r), 'tatt2away')

    # --- Pre-rebrand era: negative + ambiguous → tatt2away ---

    def test_ambiguous_pre_rebrand_routes_tatt2away(self):
        r = self._base(
            post_rebrand=False,
            stage_2_flagged=True,
            stage_2_classification='ambiguous',
            stage_2_confidence=0.6,
        )
        self.assertEqual(assign_bucket(r), 'tatt2away')

    def test_stage1_hit_overrides_bridging(self):
        # If both hit, Stage 1 name match wins → tatt2away (not review_required)
        r = self._base(stage_1_hit=True, stage_1_bridging_flag=True)
        self.assertEqual(assign_bucket(r), 'tatt2away')

    def test_pre_rebrand_overrides_everything(self):
        # Even with stage_1_hit = False, pre_rebrand auto-routes
        r = self._base(pre_rebrand_date_routed=True, stage_1_hit=False)
        self.assertEqual(assign_bucket(r), 'tatt2away')


if __name__ == '__main__':
    unittest.main(verbosity=2)
