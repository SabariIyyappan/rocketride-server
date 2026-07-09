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
rocketride/analytics — shared opt-out contract.

Side-effect-free and env-agnostic: this module NEVER touches process
environment, files, or any host state. Every consumer reads its own
environment signals and passes them in. That keeps ONE opt-out concept
consistent across all SDK surfaces:
    (a) hosted consumers -> a real PostHog key + a host consent toggle
    (b) OSS/local        -> no PostHog key => hard no-op

Usage:
    if is_opted_out({'has_key': has_key, 'telemetry_enabled': enabled}):
        return  # suppress all capture
"""

from __future__ import annotations

from typing import TypedDict


class _OptOutRequired(TypedDict):
    """Required half of :class:`OptOutSignals`.

    Whether a PostHog project key is configured for this build. When
    ``False`` (OSS/local), telemetry is structurally impossible and every
    consumer must degrade to a no-op.
    """

    has_key: bool


class OptOutSignals(_OptOutRequired, total=False):
    """Environment signals a consumer feeds into the shared predicate.

    ``telemetry_enabled`` is host-level telemetry consent, when the host
    exposes one. It is tri-state on purpose:
        ``False`` -> user/host explicitly disabled telemetry -> opted OUT.
        ``True``  -> explicitly enabled.
        ``None``/absent -> host has no opinion; this signal does not opt out.
    """

    telemetry_enabled: bool | None


def is_opted_out(signals: OptOutSignals) -> bool:
    """Return whether all telemetry capture should be suppressed.

    The single source of truth for "should we suppress all capture?".

    Pure and total: given the same signals it always returns the same
    boolean, with no side effects. Opted OUT iff:
        - no key is configured (nothing to send to), OR
        - the host explicitly disabled telemetry (``telemetry_enabled`` is
          ``False``).

    A MISSING/``None`` ``telemetry_enabled`` does NOT opt out — absence of a
    host toggle is not a withdrawal of consent. This predicate also fails
    CLOSED: when no key is configured (OSS/local) it always reports opted out.
    """
    return not signals.get('has_key') or signals.get('telemetry_enabled') is False
