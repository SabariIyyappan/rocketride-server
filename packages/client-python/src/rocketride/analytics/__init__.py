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
rocketride.analytics — RocketRide telemetry primitives (Python SDK).

Public entry point for the analytics subpackage: the PostHog event taxonomy
(:mod:`events`), anonymous ``distinct_id`` generation and persistence
(:mod:`anon_id`), the shared opt-out predicate (:mod:`opt_out`), and the
standard event-context props builder (:mod:`standard_props`).

Every module is pure and side-effect-free; consumers supply their own
environment and persistence. See each submodule for details. This barrel
simply re-exports the useful public surface so callers can write, e.g.::

    from rocketride.analytics import EVENTS, standard_props, is_opted_out
"""

from __future__ import annotations

from .anon_id import (
    ANON_ID_KEY,
    AnonIdStore,
    get_or_create_anon_id,
    new_anon_id,
)
from .events import (
    EVENT_PROPS,
    EVENTS,
    ChatErrorKind,
    EventName,
    EventSource,
    StripeInterval,
    SubscribeSurface,
)
from .opt_out import (
    OptOutSignals,
    is_opted_out,
)
from .standard_props import (
    RR_LIB,
    AnalyticsEnv,
    CaptureMode,
    Platform,
    Surface,
    detect_platform,
    standard_props,
)

__all__ = [
    # events
    'EVENTS',
    'EventName',
    'EventSource',
    'SubscribeSurface',
    'StripeInterval',
    'ChatErrorKind',
    'EVENT_PROPS',
    # anon_id
    'ANON_ID_KEY',
    'new_anon_id',
    'AnonIdStore',
    'get_or_create_anon_id',
    # opt_out
    'OptOutSignals',
    'is_opted_out',
    # standard_props
    'Platform',
    'Surface',
    'CaptureMode',
    'RR_LIB',
    'AnalyticsEnv',
    'standard_props',
    'detect_platform',
]
