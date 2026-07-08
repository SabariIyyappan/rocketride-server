// MIT License
//
// Copyright (c) 2026 Aparavi Software AG
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// =============================================================================
// rocketride/analytics — shared opt-out contract
// =============================================================================
//
// Side-effect-free & env-agnostic: this module NEVER touches `window`, `vscode`,
// `process`, `localStorage`, or `crypto`. Every consumer reads its own
// environment signals and passes them in. That keeps ONE opt-out concept
// consistent across:
//   (a) home-ui       -> posthog-js in the browser
//   (b) VS Code host  -> client.report() raw-fetch, gated by vscode.env
//   (c) OSS/local     -> no PostHog key => hard no-op
// =============================================================================

/** Environment signals a consumer feeds into the shared predicate. */
export interface OptOutSignals {
	/**
	 * Host-level telemetry consent, when the host exposes one.
	 *   - VS Code: `vscode.env.isTelemetryEnabled` (a definite boolean).
	 *   - Browser: usually `undefined` (no host toggle) — see note below.
	 *
	 * Tri-state on purpose:
	 *   `false`     -> user/host explicitly disabled telemetry -> opted OUT.
	 *   `true`      -> explicitly enabled.
	 *   `undefined` -> host has no opinion; this signal does not opt out.
	 */
	telemetryEnabled?: boolean;

	/**
	 * Whether a PostHog project key is configured for this build.
	 * When `false` (OSS/local), telemetry is structurally impossible and every
	 * consumer must degrade to a no-op.
	 */
	hasKey: boolean;
}

/**
 * The single source of truth for "should we suppress all capture?".
 *
 * Pure and total: given the same signals it always returns the same boolean,
 * with no side effects. Opted OUT iff:
 *   - no key is configured (nothing to send to), OR
 *   - the host explicitly disabled telemetry (`telemetryEnabled === false`).
 *
 * Note `undefined` telemetryEnabled does NOT opt out — absence of a host toggle
 * is not a withdrawal of consent. Consent for the browser case is expressed
 * elsewhere (a settings toggle flipping `hasKey`, or `posthog.opt_out_capturing()`).
 */
export function isOptedOut(signals: OptOutSignals): boolean {
	const { telemetryEnabled, hasKey } = signals;
	return !hasKey || telemetryEnabled === false;
}
