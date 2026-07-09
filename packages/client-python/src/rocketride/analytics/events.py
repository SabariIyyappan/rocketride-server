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
rocketride.analytics — event taxonomy (Python mirror of ``rocketride/analytics``).

Single source of truth for RocketRide's PostHog event taxonomy, kept in parity
with the TypeScript client (``client-typescript/src/client/analytics/events.ts``).
Naming convention: ``object:action``, lowercase, colon-separated.

This module is definitions only — constants plus typing shapes. It has no
side effects and imports nothing beyond the standard library.
"""

from __future__ import annotations

from typing import Literal

# -----------------------------------------------------------------------------
# Shared prop primitives
# -----------------------------------------------------------------------------

# Where an event originated. Open union in TS via ``(string & {})`` — kept
# permissive here as ``str``; the known values are enumerated for reference.
EventSource = str

KNOWN_EVENT_SOURCES: tuple[str, ...] = (
    'canvas',
    'shell',
    'vscode',
    'store',
    'pricing',
    'hero',
    'panel',
    'suggestion',
    'nav',
    'nav_products',
    'home_bottom',
    'home_mid',
    'developers_hero',
    'businesses_hero',
    'businesses_bottom',
    'thinkers_bottom',
)

SubscribeSurface = Literal['pricing', 'store']
StripeInterval = Literal['month', 'year']
ChatErrorKind = Literal['server', 'timeout', 'socket']


# -----------------------------------------------------------------------------
# Event names (authoritative)
# -----------------------------------------------------------------------------


class EVENTS:
    """Authoritative event-name constants (mirror of the TS ``EVENTS`` const)."""

    # Auth (shared)
    AUTH_LOGIN_START = 'auth:login_start'
    AUTH_REGISTER_START = 'auth:register_start'
    AUTH_LOGIN_SUCCESS = 'auth:login_success'

    # Pipeline (product / canvas)
    PIPELINE_RUN = 'pipeline:run'
    PIPELINE_STOP = 'pipeline:stop'
    PIPELINE_SAVE = 'pipeline:save'

    # Node editing (product / canvas)
    NODE_ADD = 'node:add'
    NODE_CONNECT = 'node:connect'
    NODE_CONFIG_OPEN = 'node:config_open'

    # Checkout / subscribe lifecycle (shared)
    SUBSCRIBE_INTENT = 'subscribe:intent'
    CHECKOUT_START = 'checkout:start'
    CHECKOUT_SESSION_CREATED = 'checkout:session_created'
    SUBSCRIBE_SUCCESS = 'subscribe:success'
    PLAN_CHANGE = 'plan:change'

    # App navigation
    APP_SWITCH = 'app:switch'
    APP_LAUNCH = 'app:launch'

    # VS Code extension lifecycle (vscode-only)
    EXT_ACTIVATE = 'ext:activate'
    EXT_CANVAS_OPEN = 'ext:canvas_open'
    EXT_DEPLOY_OPEN = 'ext:deploy_open'

    # Chat (web / marketing)
    CHAT_OPEN = 'chat:open'
    CHAT_MESSAGE_SENT = 'chat:message_sent'
    CHAT_SUGGESTION_CLICKED = 'chat:suggestion_clicked'
    CHAT_RESPONSE = 'chat:response'
    CHAT_EMPTY_RESPONSE = 'chat:empty_response'
    CHAT_ERROR = 'chat:error'
    CHAT_PANEL_CLOSED = 'chat:panel_closed'

    # Site navigation (web / marketing)
    NAV_CLICK = 'nav:click'
    FOOTER_LINK = 'footer:link'
    OUTBOUND_CLICK = 'outbound:click'

    # UI chrome / marketing interactions (web / marketing)
    MENU_OPEN = 'menu:open'
    MENU_SECTION = 'menu:section'
    ANNOUNCEMENT_CYCLE = 'announcement:cycle'
    MEDIA_PLAY = 'media:play'

    # Generic action clicks / walkthrough / scroll
    CTA_CLICK = 'cta:click'
    WALKTHROUGH_STEP = 'walkthrough:step'
    LANDING_SCROLL = 'landing:scroll'

    # App store (web / marketing)
    STORE_APP_VIEW = 'store:app_view'
    STORE_CATEGORY = 'store:category'
    STORE_APP_ADD = 'store:app_add'

    # Page views (web, manual capture)
    PAGEVIEW = '$pageview'


# Union of every capturable event name (mirror of the TS ``EventName``).
EventName = Literal[
    'auth:login_start',
    'auth:register_start',
    'auth:login_success',
    'pipeline:run',
    'pipeline:stop',
    'pipeline:save',
    'node:add',
    'node:connect',
    'node:config_open',
    'subscribe:intent',
    'checkout:start',
    'checkout:session_created',
    'subscribe:success',
    'plan:change',
    'app:switch',
    'app:launch',
    'ext:activate',
    'ext:canvas_open',
    'ext:deploy_open',
    'chat:open',
    'chat:message_sent',
    'chat:suggestion_clicked',
    'chat:response',
    'chat:empty_response',
    'chat:error',
    'chat:panel_closed',
    'nav:click',
    'footer:link',
    'outbound:click',
    'menu:open',
    'menu:section',
    'announcement:cycle',
    'media:play',
    'cta:click',
    'walkthrough:step',
    'landing:scroll',
    'store:app_view',
    'store:category',
    'store:app_add',
    '$pageview',
]
