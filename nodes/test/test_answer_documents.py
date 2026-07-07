# =============================================================================
# MIT License
# Copyright (c) 2026 Aparavi Software AG
# =============================================================================

"""Unit tests for the answer_documents node (adapt.answer_contents).

Verifies the pure answers -> document-content mapping without the engine:
  - a JSON list yields one page_content per item (each fact indexed separately)
  - a JSON object yields a single page_content
  - a plain-text answer yields a single page_content
  - an empty / whitespace / null answer yields nothing
  - JSON list items that are already strings are used verbatim
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'nodes', 'answer_documents'))
from adapt import answer_contents  # noqa: E402


class FakeAnswer:
    """Minimal stand-in for ai.common.schema.Answer (duck-typed)."""

    def __init__(self, value, is_json):
        self._value = value
        self._is_json = is_json

    def isJson(self):
        return self._is_json

    def getJson(self):
        return self._value

    def getText(self):
        if self._value is None:
            return ''
        if isinstance(self._value, (dict, list)):
            return json.dumps(self._value)
        return str(self._value)


def test_json_list_yields_one_document_per_fact():
    facts = [
        {'metric': 'revenue', 'period': 'FY2024', 'value': '5.2M'},
        {'metric': 'gross_margin', 'period': 'FY2024', 'value': '61%'},
    ]
    contents = answer_contents(FakeAnswer(facts, is_json=True))
    assert len(contents) == 2
    assert json.loads(contents[0])['metric'] == 'revenue'
    assert json.loads(contents[1])['value'] == '61%'


def test_json_object_yields_single_document():
    contents = answer_contents(FakeAnswer({'total': 5, 'currency': 'USD'}, is_json=True))
    assert contents == [json.dumps({'total': 5, 'currency': 'USD'}, ensure_ascii=False)]


def test_json_list_of_strings_uses_items_verbatim():
    contents = answer_contents(FakeAnswer(['fact one', 'fact two'], is_json=True))
    assert contents == ['fact one', 'fact two']


def test_plain_text_yields_single_document():
    contents = answer_contents(FakeAnswer('The 2024 audited revenue was $5.2M.', is_json=False))
    assert contents == ['The 2024 audited revenue was $5.2M.']


def test_empty_and_null_answers_yield_nothing():
    assert answer_contents(FakeAnswer('   ', is_json=False)) == []
    assert answer_contents(FakeAnswer('', is_json=False)) == []
    assert answer_contents(FakeAnswer(None, is_json=True)) == []


def test_json_empty_list_yields_nothing():
    assert answer_contents(FakeAnswer([], is_json=True)) == []
