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
rocketride.analytics — standard event-context props (Python mirror).

Kept in parity with the TypeScript client
(``client-typescript/src/client/analytics/standardProps.ts``). Pure and
env-agnostic: the caller supplies its ``AnalyticsEnv`` and gets back a dict of
the standard PostHog context props, ready to merge into a per-event payload.

The emitted keys (``$lib``, ``$lib_version``, ``session_id``, ``$session_id``,
``$process_person_profile``, ...) are the PostHog wire keys and match the
TypeScript/browser path exactly, so events from both surfaces stay comparable.
"""

from __future__ import annotations

from typing import Literal, TypedDict

# Runtime platform / product surface / transport mode (mirror the TS unions).
Platform = Literal['web', 'vscode', 'node']
Surface = Literal['marketing', 'app', 'canvas', 'extension']
CaptureMode = Literal['posthog-js', 'raw']

# SDK identity reported on every event.
RR_LIB = 'rocketride-js'


class _AnalyticsEnvRequired(TypedDict):
    platform: Platform
    surface: Surface
    app_version: str


class AnalyticsEnv(_AnalyticsEnvRequired, total=False):
    """
    Environment the caller supplies. Pure in => pure out.

    Required: ``platform``, ``surface``, ``app_version``.
    Optional: ``session_id``, ``anonymous``, ``groups`` (``app``/``organization``),
    ``lib_version`` (SDK/lib version reported as ``$lib_version``; omitted when unset).
    """

    session_id: str
    anonymous: bool
    groups: dict[str, str]
    lib_version: str


def standard_props(env: AnalyticsEnv, mode: CaptureMode = 'raw') -> dict[str, object]:
    """
    Build the standard context props for a single event.

    Args:
        env: Runtime environment (passed in — never detected here).
        mode: How the props will be transmitted. Defaults to ``'raw'`` (the
            ``client.report()`` path), which is the maximal / self-contained set.
            ``'posthog-js'`` emits only RocketRide-specific props and lets the
            browser library add its own context.
    """
    props: dict[str, object] = {
        'platform': env['platform'],
        'surface': env['surface'],
        'app_version': env['app_version'],
        '$lib': RR_LIB,
    }

    # Only set $lib_version when a consumer supplies one (from its own build).
    lib_version = env.get('lib_version')
    if lib_version is not None:
        props['$lib_version'] = lib_version

    session_id = env.get('session_id')
    if session_id is not None:
        props['session_id'] = session_id

    groups = env.get('groups')
    if groups:
        g: dict[str, str] = {}
        if groups.get('app') is not None:
            g['app'] = groups['app']
        if groups.get('organization') is not None:
            g['organization'] = groups['organization']
        if g:
            props['$groups'] = g

    # posthog-js auto-adds $browser/$current_url/utm_*/$session_id and manages
    # person profiles via init config, so we stop here for that path.
    if mode == 'posthog-js':
        return props

    # raw (client.report()) path: no auto-context exists, add it here.
    if session_id is not None:
        props['$session_id'] = session_id
    if env.get('anonymous'):
        # Suppress PostHog person-profile creation for anonymous events.
        props['$process_person_profile'] = False
    return props


def detect_platform() -> Platform:
    """
    OPTIONAL convenience. Python has no browser ``window``, so this always
    returns ``'node'`` — it NEVER returns ``'web'`` or ``'vscode'``. It exists
    only for API parity with the TS ``detectPlatform``; callers that know their
    platform (e.g. a VS Code extension host) should pass it explicitly.
    """
    return 'node'
