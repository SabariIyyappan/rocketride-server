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
// rocketride/analytics — standard properties builder
// =============================================================================
//
// Zero-runtime, browser- and Node-safe builder for the standard context
// properties attached to EVERY RocketRide PostHog event.
//
// This module MUST NOT import anything else from the SDK, and MUST NOT read
// globals (`window`, `process`, `navigator`, `document`) at module scope or
// inside standardProps(). Environment is passed in by the caller. A small,
// clearly-marked `detectPlatform()` helper is provided for callers that want
// the SDK's `typeof window` heuristic — its impurity is opt-in and isolated.
// =============================================================================

/** Where the code is running. */
export type Platform = 'web' | 'vscode' | 'node';

/** Which product surface produced the event. */
export type Surface = 'marketing' | 'app' | 'canvas' | 'extension';

/**
 * How the resulting props will be sent.
 * - 'posthog-js': posthog-js auto-captures $browser, $current_url, utm params and
 *   $session_id, and governs person profiles via its own `person_profiles` init
 *   option, so we
 *   emit ONLY RocketRide-specific props and let the library add browser context.
 * - 'raw': the client.report() path (raw fetch to /capture). No auto-context
 *   exists, so we emit the full set, including $session_id and, when anonymous,
 *   $process_person_profile: false.
 */
export type CaptureMode = 'posthog-js' | 'raw';

/** SDK identity reported on every event. */
export const RR_LIB = 'rocketride-js' as const;

// NOTE: keep in sync with package.json `version`. A follow-up build step should
// stamp this from package.json (or a generated version.ts); it is hardcoded here
// only to keep this module import-free / zero-runtime.
export const RR_LIB_VERSION = '1.3.0' as const;

/** Environment the caller supplies. Pure in => pure out. */
export interface AnalyticsEnv {
	/** Runtime platform. */
	platform: Platform;
	/** Product surface. */
	surface: Surface;
	/** Host app version (marketing site build id, extension version, ...). */
	appVersion: string;
	/**
	 * Stable-per-session id.
	 * - 'raw' mode: REQUIRED — nothing else supplies $session_id.
	 * - 'posthog-js' mode: optional; posthog-js manages $session_id itself, so
	 *   leave undefined unless you deliberately want to override it.
	 */
	sessionId?: string;
	/** Whether the current user is anonymous (drives $process_person_profile). */
	anonymous?: boolean;
	/** Optional PostHog group attribution. */
	groups?: {
		app?: string;
		organization?: string;
	};
	/** Override the reported SDK version (defaults to RR_LIB_VERSION). */
	libVersion?: string;
}

/**
 * Return shape: an index-signatured bag so it spreads/merges cleanly under
 * per-event properties. `$groups` uses PostHog's native group-analytics key.
 */
export interface StandardProps {
	platform: Platform;
	surface: Surface;
	app_version: string;
	$lib: typeof RR_LIB;
	$lib_version: string;
	session_id?: string;
	$session_id?: string;
	$process_person_profile?: false;
	$groups?: Record<string, string>;
	[key: string]: unknown;
}

/**
 * Build the standard context props for a single event.
 *
 * @param env  Runtime environment (passed in — never detected here).
 * @param mode How the props will be transmitted. Defaults to 'raw' (the
 *             client.report() path), which is the maximal / self-contained set.
 *
 * @example
 *   posthog.capture('nav:click', {
 *     ...standardProps(env, 'posthog-js'),
 *     target: 'pricing',
 *   });
 */
export function standardProps(env: AnalyticsEnv, mode: CaptureMode = 'raw'): StandardProps {
	const props: StandardProps = {
		platform: env.platform,
		surface: env.surface,
		app_version: env.appVersion,
		$lib: RR_LIB,
		$lib_version: env.libVersion ?? RR_LIB_VERSION,
	};

	// RocketRide's own session id, always emitted when known.
	if (env.sessionId !== undefined) {
		props.session_id = env.sessionId;
	}

	if (env.groups) {
		const g: Record<string, string> = {};
		if (env.groups.app !== undefined) g.app = env.groups.app;
		if (env.groups.organization !== undefined) g.organization = env.groups.organization;
		if (Object.keys(g).length > 0) props.$groups = g;
	}

	// posthog-js auto-adds $browser/$current_url/utm_*/$session_id and manages
	// person profiles via init config, so we stop here for that path.
	if (mode === 'posthog-js') {
		return props;
	}

	// --- raw (client.report()) path: no auto-context exists, add it here. ---
	if (env.sessionId !== undefined) {
		props.$session_id = env.sessionId;
	}
	if (env.anonymous) {
		// Suppress PostHog person-profile creation for anonymous events.
		props.$process_person_profile = false;
	}
	return props;
}

/**
 * OPTIONAL, IMPURE convenience. Mirrors the SDK's existing
 * `typeof window !== 'undefined'` heuristic. Callers that already know their
 * platform should pass it explicitly instead of calling this.
 */
export function detectPlatform(): Platform {
	// eslint-disable-next-line no-restricted-globals
	if (typeof window !== 'undefined') return 'web';
	return 'node';
}
