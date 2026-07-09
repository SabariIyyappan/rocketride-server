---
title: "Analytics / Telemetry Taxonomy"
date: 2026-07-08
---

- [Overview](#overview)
- [Import](#import)
- [Event Catalog](#event-catalog)
- [Standard Properties](#standard-properties)
- [Group Attribution (`$groups`)](#group-attribution-groups)
- [Anonymous ID Store](#anonymous-id-store)
- [Opt-out Semantics](#opt-out-semantics)
- [`$lib_version` Contract](#lib_version-contract)
- [Parity with the TypeScript SDK](#parity-with-the-typescript-sdk)

## **Overview**

`rocketride.analytics` is the Python mirror of RocketRide's shared PostHog
telemetry taxonomy. It is kept in parity with the TypeScript client
(`rocketride/analytics`) so events emitted from any surface stay comparable.

Every module is **definitions only** — constants plus typing shapes and pure
functions. It has **no side effects** and imports nothing beyond the standard
library. It **sends nothing on its own**: there is no network traffic. The
module defines *what* an event looks like; the consumer supplies the transport
(`client.report()`), the persistence store for the anonymous id, and the
`$lib_version` value. Every function is pure — the same inputs always produce
the same output.

Event names follow the convention `object:action` — lowercase,
colon-separated.

## **Import**

```python
from rocketride.analytics import (
    EVENTS,
    EVENT_PROPS,
    EventName,
    standard_props,
    get_or_create_anon_id,
    is_opted_out,
)
```

## **Event Catalog**

`EVENTS` is a class of authoritative event-name constants (mirror of the TS
`EVENTS` const). `EventName` is a `Literal` union of every wire value.
`EVENT_PROPS` is a runtime dict mapping each event name to its property
`TypedDict` (the Python-faithful equivalent of the TS `EventProperties` map);
every `EventName` has an entry. Events with no properties use `NoProps` (an
empty `TypedDict`).

The **wire name and every property key below are identical in the TypeScript
SDK** — these are two SDKs for one product. Each event's `TypedDict` class is
listed; `?` marks optional keys (modeled with a `total=False` subclass, since
Python 3.10 has no `Required`/`NotRequired`).

| Constant | Event name | `TypedDict` | Properties |
| --- | --- | --- | --- |
| `EVENTS.AUTH_LOGIN_START` | `auth:login_start` | `AuthLoginStartProps` | `source: EventSource`, `app_id?: str` |
| `EVENTS.AUTH_REGISTER_START` | `auth:register_start` | `AuthRegisterStartProps` | `source: EventSource`, `app_id?: str` |
| `EVENTS.AUTH_LOGIN_SUCCESS` | `auth:login_success` | `AuthLoginSuccessProps` | `source?: EventSource` |
| `EVENTS.PIPELINE_RUN` | `pipeline:run` | `PipelineRunProps` | `node_types: list[str]`, `node_count: int`, `edge_count: int`, `source: EventSource` |
| `EVENTS.PIPELINE_STOP` | `pipeline:stop` | `PipelineStopProps` | `source?: EventSource` |
| `EVENTS.PIPELINE_SAVE` | `pipeline:save` | `PipelineSaveProps` | `source?: EventSource` |
| `EVENTS.NODE_ADD` | `node:add` | `NodeAddProps` | `node_type: str`, `source?: EventSource` |
| `EVENTS.NODE_CONNECT` | `node:connect` | `NodeConnectProps` | `source_node_type?: str`, `target_node_type?: str` |
| `EVENTS.NODE_CONFIG_OPEN` | `node:config_open` | `NodeConfigOpenProps` | `node_type: str` |
| `EVENTS.SUBSCRIBE_INTENT` | `subscribe:intent` | `SubscribeIntentProps` | `source: SubscribeSurface`, `plan?: str`, `stripe_price_id?: str`, `interval?: StripeInterval`, `app_id?: str` |
| `EVENTS.CHECKOUT_START` | `checkout:start` | `CheckoutStartProps` | `source?: EventSource`, `plan?: str` |
| `EVENTS.CHECKOUT_SESSION_CREATED` | `checkout:session_created` | `CheckoutSessionCreatedProps` | `session_id?: str`, `plan?: str` |
| `EVENTS.SUBSCRIBE_SUCCESS` | `subscribe:success` | `SubscribeSuccessProps` | `plan?: str`, `stripe_price_id?: str` |
| `EVENTS.PLAN_CHANGE` | `plan:change` | `PlanChangeProps` | `from_price_id: str`, `to_price_id: str` |
| `EVENTS.APP_SWITCH` | `app:switch` | `AppSwitchProps` | `to?: str`, `from?: str` (see note) |
| `EVENTS.APP_LAUNCH` | `app:launch` | `AppLaunchProps` | `app_id: str`, `status?: str`, `source?: EventSource` |
| `EVENTS.EXT_ACTIVATE` | `ext:activate` | `ExtActivateProps` | `version?: str` |
| `EVENTS.EXT_CANVAS_OPEN` | `ext:canvas_open` | `NoProps` | *none* |
| `EVENTS.EXT_DEPLOY_OPEN` | `ext:deploy_open` | `NoProps` | *none* |
| `EVENTS.CHAT_OPEN` | `chat:open` | `NoProps` | *none* |
| `EVENTS.CHAT_MESSAGE_SENT` | `chat:message_sent` | `ChatMessageSentProps` | `len: int`, `is_follow_up: bool`, `source?: EventSource` |
| `EVENTS.CHAT_SUGGESTION_CLICKED` | `chat:suggestion_clicked` | `ChatSuggestionClickedProps` | `label: str` |
| `EVENTS.CHAT_RESPONSE` | `chat:response` | `ChatResponseProps` | `latency_ms: int`, `answer_len: int`, `ok: bool` |
| `EVENTS.CHAT_EMPTY_RESPONSE` | `chat:empty_response` | `NoProps` | *none* |
| `EVENTS.CHAT_ERROR` | `chat:error` | `ChatErrorProps` | `kind: ChatErrorKind` |
| `EVENTS.CHAT_PANEL_CLOSED` | `chat:panel_closed` | `ChatPanelClosedProps` | `reason?: Literal['manual', 'scroll', 'responsive']` |
| `EVENTS.NAV_CLICK` | `nav:click` | `NavClickProps` | `target: str` |
| `EVENTS.FOOTER_LINK` | `footer:link` | `FooterLinkProps` | `label: str` |
| `EVENTS.OUTBOUND_CLICK` | `outbound:click` | `OutboundClickProps` | `dest: str` |
| `EVENTS.MENU_OPEN` | `menu:open` | `MenuOpenProps` | `menu: str`, `surface: Literal['desktop', 'mobile']` |
| `EVENTS.MENU_SECTION` | `menu:section` | `MenuSectionProps` | `section: str`, `state: Literal['open', 'close']`, `surface: Literal['mobile']` |
| `EVENTS.ANNOUNCEMENT_CYCLE` | `announcement:cycle` | `AnnouncementCycleProps` | `dir: Literal['prev', 'next']` |
| `EVENTS.MEDIA_PLAY` | `media:play` | `MediaPlayProps` | `id: str` |
| `EVENTS.CTA_CLICK` | `cta:click` | `CtaClickProps` | `cta_id: str`, `cta_location: str` |
| `EVENTS.WALKTHROUGH_STEP` | `walkthrough:step` | `WalkthroughStepProps` | `index: int`, `title?: str`, `trigger?: Literal['click', 'auto']` |
| `EVENTS.LANDING_SCROLL` | `landing:scroll` | `LandingScrollProps` | `depth: int` |
| `EVENTS.STORE_APP_VIEW` | `store:app_view` | `StoreAppViewProps` | `app_id: str`, `source?: EventSource` |
| `EVENTS.STORE_CATEGORY` | `store:category` | `StoreCategoryProps` | `category: str` |
| `EVENTS.STORE_APP_ADD` | `store:app_add` | `StoreAppAddProps` | `app_id: str` |
| `EVENTS.PAGEVIEW` | `$pageview` | `PageviewProps` | `page: str` |

> **`app:switch` note.** In the TypeScript SDK, `to` is required and `from` is
> optional. In Python, `from` is a reserved word, so `AppSwitchProps` uses the
> functional `TypedDict` form — `TypedDict('AppSwitchProps', {'to': str,
> 'from': str}, total=False)` — which cannot mix required and optional keys.
> Both keys are therefore optional under `total=False`, even though `to` is
> semantically required.

### Shared prop primitives

- `EventSource` — aliased to `str` (the TS open union is kept permissive here).
  The known values are enumerated for reference in
  `KNOWN_EVENT_SOURCES` (`'canvas'`, `'shell'`, `'vscode'`, `'store'`,
  `'pricing'`, `'hero'`, `'panel'`, `'suggestion'`, `'nav'`, `'nav_products'`,
  `'home_bottom'`, `'home_mid'`, `'developers_hero'`, `'businesses_hero'`,
  `'businesses_bottom'`, `'thinkers_bottom'`).
- `SubscribeSurface` — `Literal['pricing', 'store']`.
- `StripeInterval` — `Literal['month', 'year']`.
- `ChatErrorKind` — `Literal['server', 'timeout', 'socket']`.

## **Standard Properties**

`standard_props(env, mode)` builds the context props attached to **every**
event. It is pure — the environment is passed in, never read from process
globals — and returns a plain `dict[str, object]` ready to merge into a
per-event payload.

```python
def standard_props(env: AnalyticsEnv, mode: CaptureMode = 'raw') -> dict[str, object]: ...
```

`AnalyticsEnv` is a `TypedDict` (required keys in a base class, optional keys via
`total=False`):

| Key | Type | Required | Notes |
| --- | --- | --- | --- |
| `platform` | `Platform` (`Literal['web', 'vscode', 'node']`) | Yes | Runtime platform. |
| `surface` | `Surface` (`Literal['marketing', 'app', 'canvas', 'extension']`) | Yes | Product surface. |
| `app_version` | `str` | Yes | Host app version. |
| `session_id` | `str` | No | Stable-per-session id. Emitted as `session_id` (and `$session_id` in `'raw'` mode). |
| `anonymous` | `bool` | No | When true (raw mode) emits `$process_person_profile: False`. |
| `groups` | `dict[str, str]` | No | PostHog group attribution (`app` / `organization`; see below). |
| `lib_version` | `str` | No | Reported as `$lib_version`; omitted when unset. |

`CaptureMode` is `Literal['posthog-js', 'raw']`, defaulting to `'raw'`:

- **`'raw'`** — the `client.report()` path. No auto-context exists, so
  `standard_props` emits the full set, including `$session_id` and, when
  `anonymous`, `$process_person_profile: False`.
- **`'posthog-js'`** — the browser library auto-adds `$browser`,
  `$current_url`, utm params, and `$session_id`, so only the RocketRide-specific
  props are emitted.

Emitted wire keys (identical across both SDKs):

| Key | Type | Emitted |
| --- | --- | --- |
| `platform` | `Platform` | Always |
| `surface` | `Surface` | Always |
| `app_version` | `str` | Always |
| `$lib` | `'rocketride-js'` (the `RR_LIB` constant) | Always |
| `$lib_version` | `str` | Only when `env['lib_version']` is set |
| `session_id` | `str` | When `env['session_id']` is set |
| `$session_id` | `str` | `'raw'` mode only, when `env['session_id']` is set |
| `$process_person_profile` | `False` | `'raw'` mode only, when `env['anonymous']` |
| `$groups` | `dict[str, str]` | When `env['groups']` has entries |

Note `$lib` is the constant string `'rocketride-js'` on **both** the Python and
TypeScript SDKs — it identifies the wire format, not the language.

```python
from rocketride.analytics import standard_props

props = {
    **standard_props({'platform': 'node', 'surface': 'app', 'app_version': '1.4.0'}, 'raw'),
    'target': 'pricing',
}
await client.report('nav:click', props)  # transport is consumer-supplied
```

### `detect_platform()`

An **optional** convenience for API parity with the TS `detectPlatform`. Python
has no browser `window`, so it **always returns `'node'`** — never `'web'` or
`'vscode'`. Callers that know their platform (e.g. a VS Code extension host)
should pass it explicitly.

## **Group Attribution (`$groups`)**

When `env['groups']` is provided, `standard_props` emits a `$groups` dict using
PostHog's native group-analytics key, copying through only the keys present
(`app`, `organization`):

```python
standard_props({
    'platform': 'node',
    'surface': 'app',
    'app_version': '1.4.0',
    'groups': {'app': 'my-app-id', 'organization': 'org-123'},
})
# => {..., '$groups': {'app': 'my-app-id', 'organization': 'org-123'}}
```

> The TypeScript SDK additionally exposes `GROUPS`, `GroupType`, and
> `AppGroupProps` for the browser-only `posthog.group()` `$groupidentify` call.
> Those symbols have **no Python equivalent** — Python emits telemetry over the
> raw `client.report()` path, not `posthog-js`. `$groups` attribution via
> `standard_props`, however, works in both SDKs.

## **Anonymous ID Store**

Only the raw `client.report()` path (product servers, tools, non-browser hosts)
needs to supply its own `distinct_id`. This module **owns id generation and the
get-or-create orchestration**, while **each consumer owns persistence** by
implementing the tiny `AnonIdStore` `Protocol` for its environment, so the
module stays side-effect-free and environment-agnostic.

```python
from typing import Protocol

class AnonIdStore(Protocol):
    def get(self) -> str | None:
        """Return the persisted id, or None if none has been stored yet."""
        ...

    def set(self, anon_id: str) -> None:
        """Durably persist the id."""
        ...
```

- `ANON_ID_KEY` — `'rr_anon_id'`, the stable key/filename consumers should use.
- `new_anon_id()` — returns a canonical RFC 4122 v4 UUID from `uuid.uuid4()`,
  which is CSPRNG-backed (drawn from `os.urandom`). Unlike the TypeScript
  sibling, there is **no fallback and no throw path**: this generator is always
  available and always cryptographically strong.
- `get_or_create_anon_id(store)` — returns the persisted id, generating and
  persisting one via `store.set(...)` on first use.

```python
class MemoryStore:
    def __init__(self) -> None:
        self._id: str | None = None
    def get(self) -> str | None:
        return self._id
    def set(self, anon_id: str) -> None:
        self._id = anon_id

distinct_id = get_or_create_anon_id(MemoryStore())
```

## **Opt-out Semantics**

`is_opted_out(signals)` is the single source of truth for "should we suppress
all capture?". It is pure and total, and reads no environment itself — the
consumer feeds in its own signals:

```python
from typing import TypedDict

class OptOutSignals(TypedDict, total=False):
    has_key: bool               # required (declared in the base class)
    telemetry_enabled: bool | None

def is_opted_out(signals: OptOutSignals) -> bool: ...
```

Opted **out** iff:

- no key is configured (`has_key` is falsy) — telemetry is structurally
  impossible (OSS/local), so every consumer degrades to a no-op; **or**
- the host explicitly disabled telemetry (`telemetry_enabled` is `False`).

A missing / `None` `telemetry_enabled` does **not** opt out — absence of a host
toggle is not a withdrawal of consent. The predicate fails **closed**: with no
key configured it always reports opted out.

```python
if is_opted_out({'has_key': has_key, 'telemetry_enabled': enabled}):
    return  # suppress all capture
```

## **`$lib_version` Contract**

`$lib_version` is **consumer-supplied**. An earlier hardcoded `RR_LIB_VERSION`
was deliberately dropped, and the value is now provided by the consumer's own
build (pass `lib_version` in `AnalyticsEnv`). When omitted, `standard_props`
does not emit `$lib_version` at all. `$lib` (`'rocketride-js'`) is still always
emitted; only the *version* is consumer-controlled.

## **Parity with the TypeScript SDK**

The wire contract — every event name and property key — is identical to the
TypeScript SDK (`rocketride/analytics`). The two differ only where a language
requires it:

- **Field naming of *inputs*.** Python uses snake_case for the `AnalyticsEnv`
  keys (`app_version`, `session_id`, `lib_version`) and `OptOutSignals` keys
  (`telemetry_enabled`, `has_key`); TypeScript uses camelCase (`appVersion`,
  `sessionId`, `libVersion`, `telemetryEnabled`, `hasKey`). The **emitted wire
  keys are identical** (`app_version`, `session_id`, `$lib_version`, `$groups`,
  …).
- **`app:switch`.** Because `from` is a Python reserved word, `AppSwitchProps`
  uses the functional `TypedDict` form and both `to` and `from` are optional
  (`total=False`). In TypeScript, `to` is required and `from` is optional.
- **Groups.** `GROUPS`, `GroupType`, and `AppGroupProps` are TypeScript-only
  (browser-only `posthog.group()`); there is no Python equivalent.
- **Anonymous id.** Python's `new_anon_id()` calls `uuid.uuid4()`
  unconditionally (always CSPRNG-backed), so there is no crypto fallback and no
  throw path; TypeScript carries a `crypto.getRandomValues()` fallback and
  throws when no CSPRNG exists.
- **`detect_platform()`.** Python always returns `'node'`; TypeScript's
  `detectPlatform()` returns `'web'` or `'node'`.
- **Runtime properties map.** Python ships an `EVENT_PROPS` dict (name →
  `TypedDict`); TypeScript's `EventProperties` is type-only.

See the [TypeScript analytics reference](../typescript/analytics) for the
TypeScript-side API.
