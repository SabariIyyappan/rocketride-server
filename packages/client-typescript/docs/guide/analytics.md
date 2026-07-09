---
title: "Analytics / Telemetry Taxonomy"
sidebar_position: 3
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
- [Parity with the Python SDK](#parity-with-the-python-sdk)

## **Overview**

`rocketride/analytics` is the single source of truth for RocketRide's PostHog
telemetry taxonomy. It is imported by both transports that emit events:

- the product SDK's `client.report()` (raw `fetch`, Node + browser), and
- the marketing site's `posthog-js` wrapper (browser).

The module is **zero-runtime**: it ships only `const` objects, pure functions,
and TypeScript types, with **no imports from the rest of the SDK**. Importing
`rocketride/analytics` therefore never drags the WebSocket transport (or `ws`)
into a browser bundle, and it is fully tree-shakeable.

**It sends nothing on its own.** There are no side effects and no network
traffic. The module defines *what* an event looks like; the consumer supplies
the transport (`report()` / `posthog.capture()`), the persistence store for the
anonymous id, and the `$lib_version` value. Every function here is pure: the
same inputs always produce the same output.

Event names follow the convention `object:action` — lowercase,
colon-separated.

## **Import**

The taxonomy is published under the `./analytics` subpath export:

```typescript
import {
	EVENTS,
	type EventName,
	type EventProperties,
	standardProps,
	getOrCreateAnonId,
	isOptedOut,
} from 'rocketride/analytics';
```

## **Event Catalog**

`EVENTS` is the authoritative map of constant → wire name. `EventName` is the
union of every wire value. `EventProperties` is a type-only map from each event
name to its property shape; there is no runtime properties object in the
TypeScript build. Events marked *NoProps* carry `Record<string, never>` (no
properties).

The **wire name and every property key below are identical in the Python SDK** —
these are two SDKs for one product. Types are shown with `?` marking optional
properties.

| Constant | Event name | Properties |
| --- | --- | --- |
| `AUTH_LOGIN_START` | `auth:login_start` | `source: EventSource`, `app_id?: string` |
| `AUTH_REGISTER_START` | `auth:register_start` | `source: EventSource`, `app_id?: string` |
| `AUTH_LOGIN_SUCCESS` | `auth:login_success` | `source?: EventSource` |
| `PIPELINE_RUN` | `pipeline:run` | `node_types: string[]`, `node_count: number`, `edge_count: number`, `source: EventSource` |
| `PIPELINE_STOP` | `pipeline:stop` | `source?: EventSource` |
| `PIPELINE_SAVE` | `pipeline:save` | `source?: EventSource` |
| `NODE_ADD` | `node:add` | `node_type: string`, `source?: EventSource` |
| `NODE_CONNECT` | `node:connect` | `source_node_type?: string`, `target_node_type?: string` |
| `NODE_CONFIG_OPEN` | `node:config_open` | `node_type: string` |
| `SUBSCRIBE_INTENT` | `subscribe:intent` | `source: SubscribeSurface`, `plan?: string`, `stripe_price_id?: string`, `interval?: StripeInterval`, `app_id?: string` |
| `CHECKOUT_START` | `checkout:start` | `source?: EventSource`, `plan?: string` |
| `CHECKOUT_SESSION_CREATED` | `checkout:session_created` | `session_id?: string`, `plan?: string` |
| `SUBSCRIBE_SUCCESS` | `subscribe:success` | `plan?: string`, `stripe_price_id?: string` |
| `PLAN_CHANGE` | `plan:change` | `from_price_id: string`, `to_price_id: string` |
| `APP_SWITCH` | `app:switch` | `to: string`, `from?: string` |
| `APP_LAUNCH` | `app:launch` | `app_id: string`, `status?: string`, `source?: EventSource` |
| `EXT_ACTIVATE` | `ext:activate` | `version?: string` |
| `EXT_CANVAS_OPEN` | `ext:canvas_open` | *NoProps* |
| `EXT_DEPLOY_OPEN` | `ext:deploy_open` | *NoProps* |
| `CHAT_OPEN` | `chat:open` | *NoProps* |
| `CHAT_MESSAGE_SENT` | `chat:message_sent` | `len: number`, `is_follow_up: boolean`, `source?: EventSource` |
| `CHAT_SUGGESTION_CLICKED` | `chat:suggestion_clicked` | `label: string` |
| `CHAT_RESPONSE` | `chat:response` | `latency_ms: number`, `answer_len: number`, `ok: boolean` |
| `CHAT_EMPTY_RESPONSE` | `chat:empty_response` | *NoProps* |
| `CHAT_ERROR` | `chat:error` | `kind: ChatErrorKind` |
| `CHAT_PANEL_CLOSED` | `chat:panel_closed` | `reason?: 'manual' \| 'scroll' \| 'responsive'` |
| `NAV_CLICK` | `nav:click` | `target: string` |
| `FOOTER_LINK` | `footer:link` | `label: string` |
| `OUTBOUND_CLICK` | `outbound:click` | `dest: string` |
| `MENU_OPEN` | `menu:open` | `menu: string`, `surface: 'desktop' \| 'mobile'` |
| `MENU_SECTION` | `menu:section` | `section: string`, `state: 'open' \| 'close'`, `surface: 'mobile'` |
| `ANNOUNCEMENT_CYCLE` | `announcement:cycle` | `dir: 'prev' \| 'next'` |
| `MEDIA_PLAY` | `media:play` | `id: string` |
| `CTA_CLICK` | `cta:click` | `cta_id: string`, `cta_location: string` |
| `WALKTHROUGH_STEP` | `walkthrough:step` | `index: number`, `title?: string`, `trigger?: 'click' \| 'auto'` |
| `LANDING_SCROLL` | `landing:scroll` | `depth: number` |
| `STORE_APP_VIEW` | `store:app_view` | `app_id: string`, `source?: EventSource` |
| `STORE_CATEGORY` | `store:category` | `category: string` |
| `STORE_APP_ADD` | `store:app_add` | `app_id: string` |
| `PAGEVIEW` | `$pageview` | `page: string` |

### Shared prop primitives

- `EventSource` — an **open** string union: known values (`'canvas'`, `'shell'`,
  `'vscode'`, `'store'`, `'pricing'`, `'hero'`, `'panel'`, `'suggestion'`,
  `'nav'`, `'nav_products'`, `'home_bottom'`, `'home_mid'`, `'developers_hero'`,
  `'businesses_hero'`, `'businesses_bottom'`, `'thinkers_bottom'`) autocomplete,
  but any string is accepted (via the `(string & {})` trick).
- `SubscribeSurface` — `'pricing' | 'store'`.
- `StripeInterval` — `'month' | 'year'`.
- `ChatErrorKind` — `'server' | 'timeout' | 'socket'`.

### Type-safe capture helper

`EventArgs<E>` is a tuple helper for wrapping `report()` / `capture()` so
`properties` is optional exactly when the event has no *required* props (this
covers both *NoProps* events and events whose props are all optional, e.g.
`pipeline:stop`):

```typescript
export type EventArgs<E extends EventName> = {} extends EventProperties[E]
	? [event: E, properties?: EventProperties[E]]
	: [event: E, properties: EventProperties[E]];
```

`AssertEventPropsComplete` is a compile-time, fully-erased guard that fails the
build if `EventProperties` ever holds a key that is not a valid `EventName`
(e.g. an orphaned entry left after renaming an event). It carries no runtime
value.

## **Standard Properties**

`standardProps(env, mode)` builds the context props attached to **every** event.
It is pure — environment is passed in, never read from globals.

```typescript
function standardProps(env: AnalyticsEnv, mode: CaptureMode = 'raw'): StandardProps;
```

`AnalyticsEnv` (the input the caller supplies):

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `platform` | `Platform` (`'web' \| 'vscode' \| 'node'`) | Yes | Runtime platform. |
| `surface` | `Surface` (`'marketing' \| 'app' \| 'canvas' \| 'extension'`) | Yes | Product surface. |
| `appVersion` | `string` | Yes | Host app version (build id, extension version, …). |
| `sessionId` | `string` | No | Stable-per-session id. **Required in `'raw'` mode** (nothing else supplies `$session_id`); in `'posthog-js'` mode leave undefined and let posthog-js manage it. |
| `anonymous` | `boolean` | No | When true (raw mode) emits `$process_person_profile: false`. |
| `groups` | `{ app?: string; organization?: string }` | No | PostHog group attribution (see below). |
| `libVersion` | `string` | No | Reported as `$lib_version`; omitted when unset. |

`CaptureMode` is `'posthog-js' | 'raw'`, defaulting to `'raw'`:

- **`'raw'`** — the `client.report()` path (raw `fetch` to `/capture`). No
  auto-context exists, so `standardProps` emits the full set, including
  `$session_id` and, when `anonymous`, `$process_person_profile: false`.
- **`'posthog-js'`** — posthog-js auto-captures `$browser`, `$current_url`, utm
  params, and `$session_id`, and governs person profiles via its own init
  config, so `standardProps` emits only the RocketRide-specific props.

`StandardProps` (the emitted wire keys — identical across both SDKs):

| Key | Type | Emitted |
| --- | --- | --- |
| `platform` | `Platform` | Always |
| `surface` | `Surface` | Always |
| `app_version` | `string` | Always |
| `$lib` | `'rocketride-js'` (the `RR_LIB` constant) | Always |
| `$lib_version` | `string` | Only when `env.libVersion` is set |
| `session_id` | `string` | When `env.sessionId` is set |
| `$session_id` | `string` | `'raw'` mode only, when `env.sessionId` is set |
| `$process_person_profile` | `false` | `'raw'` mode only, when `env.anonymous` |
| `$groups` | `Record<string, string>` | When `env.groups` has entries |

Note `$lib` is the constant string `'rocketride-js'` on **both** the TypeScript
and Python SDKs — it identifies the wire format, not the language.

```typescript
posthog.capture('nav:click', {
	...standardProps(env, 'posthog-js'),
	target: 'pricing',
});
```

### `detectPlatform()`

An **optional, impure** convenience mirroring the SDK's `typeof window`
heuristic. It returns `'web'` when a `window` global exists, otherwise `'node'`
— it **never** returns `'vscode'`. VS Code callers must pass
`platform: 'vscode'` explicitly. Callers that already know their platform should
pass it rather than call this.

## **Group Attribution (`$groups`)**

When `env.groups` is provided, `standardProps` emits a `$groups` object using
PostHog's native group-analytics key, copying through only the keys that are
present:

```typescript
standardProps({
	platform: 'web',
	surface: 'app',
	appVersion: '1.4.0',
	groups: { app: 'my-app-id', organization: 'org-123' },
});
// => { ..., $groups: { app: 'my-app-id', organization: 'org-123' } }
```

Separately, registering group *properties* is a PostHog `$groupidentify` call —
not a captured event — so it is kept out of `EventName`. The TypeScript SDK
provides the pieces for the browser-only `posthog.group()` call:

- `GROUPS` — `{ APP: 'app' }`, and `GroupType` (`'app'`).
- `AppGroupProps` — `{ name?: string; version?: string; publisher?: string;
  [key: string]: string | number | boolean | undefined }`.

```typescript
posthog.group(GROUPS.APP, appId, { name, version, publisher });
```

> These `GROUPS` / `GroupType` / `AppGroupProps` symbols exist **only in the
> TypeScript SDK** because they serve the browser-only `posthog.group()` call.
> The Python SDK has no equivalent. `$groups` attribution via `standardProps`,
> however, exists in both.

## **Anonymous ID Store**

Only the raw `client.report()` path (VS Code host, product servers) needs to
supply its own `distinct_id`; posthog-js manages identity itself. This module
**owns id generation and the get-or-create orchestration**, while **each
consumer owns persistence** by implementing the tiny `AnonIdStore` interface for
its environment. The module never reaches for a storage API, keeping it
side-effect-free.

```typescript
export interface AnonIdStore {
	/** Return the persisted id, or null if none has been stored yet. */
	get(): string | null;
	/** Durably persist the id. */
	set(id: string): void;
}
```

- `ANON_ID_KEY` — `'rr_anon_id'`, the stable key/filename consumers should use.
- `newAnonId(cryptoRef?)` — generates a fresh id. Prefers
  `crypto.randomUUID()`; falls back to an RFC 4122 v4 UUID built from
  `crypto.getRandomValues()` when `randomUUID` is unavailable (e.g. an insecure
  origin or older runtime). It **never** falls back to `Math.random()`, and
  **throws** if neither crypto source exists, so the consumer can disable
  telemetry rather than emit a weak, collision-prone id. `cryptoRef` (a
  `CryptoLike`, default `globalThis.crypto`) is injectable for testing.
- `CryptoLike` — the minimal structural shape used
  (`randomUUID?()`, `getRandomValues()`); declared locally so the published
  `.d.ts` stays DOM-lib-agnostic.
- `getOrCreateAnonId(store, cryptoRef?)` — returns the persisted id, generating
  and persisting one on first use.

```typescript
const memoryStore: AnonIdStore = (() => {
	let id: string | null = null;
	return { get: () => id, set: (v) => { id = v; } };
})();

const distinctId = getOrCreateAnonId(memoryStore);
```

## **Opt-out Semantics**

`isOptedOut(signals)` is the single source of truth for "should we suppress all
capture?". It is pure and total, and reads no environment itself — the consumer
feeds in its own signals:

```typescript
export interface OptOutSignals {
	/** Host-level consent, tri-state; only `false` opts out. `undefined` does not. */
	telemetryEnabled?: boolean;
	/** Whether a PostHog project key is configured for this build. */
	hasKey: boolean;
}

function isOptedOut(signals: OptOutSignals): boolean;
```

Opted **out** iff:

- no key is configured (`hasKey === false`) — telemetry is structurally
  impossible (OSS/local), so every consumer degrades to a no-op; **or**
- the host explicitly disabled telemetry (`telemetryEnabled === false`).

A `undefined` `telemetryEnabled` does **not** opt out — absence of a host toggle
is not a withdrawal of consent. Browser consent is expressed elsewhere (a
settings toggle flipping `hasKey`, or `posthog.opt_out_capturing()`).

## **`$lib_version` Contract**

`$lib_version` is **consumer-supplied**. An earlier hardcoded `RR_LIB_VERSION`
was deliberately dropped, and the value is now provided by the consumer's own
build (pass `libVersion` in `AnalyticsEnv`). When omitted, `standardProps` does
not emit `$lib_version` at all — on the browser path this lets posthog-js report
its own native library version. `$lib` (`'rocketride-js'`) is still always
emitted; only the *version* is consumer-controlled.

## **Parity with the Python SDK**

The wire contract — every event name and property key — is identical to the
Python SDK (`rocketride.analytics`). The two differ only where a language
requires it:

- **Field naming of *inputs*.** TypeScript uses camelCase for the
  `AnalyticsEnv` fields (`appVersion`, `sessionId`, `libVersion`) and
  `OptOutSignals` fields (`telemetryEnabled`, `hasKey`); Python uses snake_case
  (`app_version`, `session_id`, `lib_version`, `telemetry_enabled`, `has_key`).
  The **emitted wire keys are identical** (`app_version`, `session_id`,
  `$lib_version`, `$groups`, …).
- **`app:switch`.** Here `to` is required and `from` optional. In Python, `from`
  is a reserved word, forcing the functional `TypedDict` form, which cannot mix
  required and optional keys — so both `to` and `from` are optional there.
- **Groups.** `GROUPS`, `GroupType`, and `AppGroupProps` are TypeScript-only
  (browser-only `posthog.group()`).
- **Anonymous id.** TypeScript carries a crypto fallback and throws when no
  CSPRNG exists; Python's `new_anon_id()` calls `uuid.uuid4()` unconditionally
  (always CSPRNG-backed), so it has no fallback and no throw path.
- **`detectPlatform()`.** TypeScript returns `'web'` or `'node'`; Python's
  `detect_platform()` always returns `'node'` (no browser `window`).
- **Runtime properties map.** Python ships an `EVENT_PROPS` dict (name →
  `TypedDict`); TypeScript's `EventProperties` is type-only.

See the [Python analytics reference](../python/analytics) for the Python-side
API.
