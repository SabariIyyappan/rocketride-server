# MIT License
#
# Copyright (c) 2026 Aparavi Software AG
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

"""
Unit tests for the ``rocketride.analytics`` subpackage.

Pure/synchronous coverage of the four primitives: anonymous-id generation and
get-or-create orchestration (:mod:`rocketride.analytics.anon_id`), the shared
opt-out predicate (:mod:`rocketride.analytics.opt_out`), the standard
event-context props builder (:mod:`rocketride.analytics.standard_props`), and
event-taxonomy completeness (:mod:`rocketride.analytics.events`). No network,
no asyncio — everything here is deterministic and side-effect-free.
"""

import re

from rocketride.analytics import (
    EVENT_PROPS,
    EVENTS,
    EventName,
    get_or_create_anon_id,
    is_opted_out,
    new_anon_id,
    standard_props,
)

# Canonical RFC 4122 version-4 UUID (variant 8/9/a/b, version nibble 4).
_UUID_V4_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')


# =========================================================================
# TEST FAKES
# =========================================================================


class _FakeStore:
    """In-memory :class:`AnonIdStore` that records ``set`` calls."""

    def __init__(self, initial: str | None = None) -> None:
        self._value = initial
        self.set_calls: list[str] = []

    def get(self) -> str | None:
        return self._value

    def set(self, anon_id: str) -> None:
        self.set_calls.append(anon_id)
        self._value = anon_id


# =========================================================================
# anon_id
# =========================================================================


def test_new_anon_id_is_uuid_v4():
    for _ in range(20):
        assert _UUID_V4_RE.match(new_anon_id())


def test_get_or_create_returns_existing_without_persisting():
    store = _FakeStore(initial='existing-id')
    result = get_or_create_anon_id(store)
    assert result == 'existing-id'
    assert store.set_calls == []


def test_get_or_create_generates_and_persists_when_empty():
    store = _FakeStore(initial=None)
    result = get_or_create_anon_id(store)
    assert _UUID_V4_RE.match(result)
    # Persisted exactly once, with the returned id.
    assert store.set_calls == [result]
    # A subsequent call returns the same persisted id and does not re-persist.
    again = get_or_create_anon_id(store)
    assert again == result
    assert store.set_calls == [result]


# =========================================================================
# opt_out
# =========================================================================


def test_is_opted_out_truth_table():
    assert is_opted_out({'has_key': False}) is True
    assert is_opted_out({'has_key': False, 'telemetry_enabled': True}) is True
    assert is_opted_out({'has_key': True, 'telemetry_enabled': False}) is True
    assert is_opted_out({'has_key': True}) is False
    assert is_opted_out({'has_key': True, 'telemetry_enabled': True}) is False


# =========================================================================
# standard_props
# =========================================================================


def _base_env(**overrides):
    env = {'platform': 'node', 'surface': 'app', 'app_version': '1.2.3'}
    env.update(overrides)
    return env


def test_standard_props_lib_identity():
    props = standard_props(_base_env())
    assert props['$lib'] == 'rocketride-js'


def test_standard_props_lib_version_only_when_supplied():
    without = standard_props(_base_env())
    assert '$lib_version' not in without

    with_version = standard_props(_base_env(lib_version='9.9.9'))
    assert with_version['$lib_version'] == '9.9.9'


def test_standard_props_posthog_js_mode_omits_raw_only_keys():
    props = standard_props(_base_env(session_id='sess-1'), mode='posthog-js')
    assert props['session_id'] == 'sess-1'
    assert '$session_id' not in props
    assert '$process_person_profile' not in props


def test_standard_props_raw_anonymous_sets_session_and_person_profile():
    props = standard_props(_base_env(session_id='sess-1', anonymous=True), mode='raw')
    assert props['$session_id'] == 'sess-1'
    assert props['$process_person_profile'] is False


# =========================================================================
# events
# =========================================================================


def test_event_props_covers_every_event_name():
    assert set(EVENT_PROPS.keys()) == set(EventName.__args__)


def test_events_constant_value():
    assert EVENTS.AUTH_LOGIN_START == 'auth:login_start'
