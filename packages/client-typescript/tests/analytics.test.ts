/**
 * MIT License
 *
 * Copyright (c) 2026 Aparavi Software AG
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Unit tests for the pure analytics primitives (no server / network needed):
 * anon-id generation incl. the CSPRNG UUID-v4 fallback, the opt-out truth table,
 * and standardProps' raw-vs-posthog-js differences.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { newAnonId, getOrCreateAnonId, type AnonIdStore, type CryptoLike } from '../src/client/analytics/anonId';
import { isOptedOut } from '../src/client/analytics/optOut';
import { standardProps, type AnalyticsEnv } from '../src/client/analytics/standardProps';

describe('anonId', () => {
	it('prefers crypto.randomUUID when available', () => {
		const crypto: CryptoLike = {
			randomUUID: () => '11111111-2222-4333-8444-555555555555',
			getRandomValues: (a) => a,
		};
		expect(newAnonId(crypto)).toBe('11111111-2222-4333-8444-555555555555');
	});

	it('falls back to a valid RFC 4122 v4 UUID built from getRandomValues', () => {
		// No randomUUID → fallback path. Deterministic bytes 0x00..0x0f so we can
		// assert the exact formatted output as well as the version/variant bits.
		const crypto: CryptoLike = {
			getRandomValues: (a) => {
				for (let i = 0; i < a.length; i++) a[i] = i;
				return a;
			},
		};
		const id = newAnonId(crypto);
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(id[14]).toBe('4'); // version nibble
		expect('89ab').toContain(id[19]); // variant nibble (10xx)
		expect(id).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
	});

	it('throws rather than emit a weak id when no crypto source exists', () => {
		const crypto = {} as CryptoLike;
		expect(() => newAnonId(crypto)).toThrow(/no crypto UUID source/);
	});

	it('getOrCreateAnonId returns the stored id and does not generate/persist', () => {
		const set = jest.fn();
		const store: AnonIdStore = { get: () => 'existing-id', set };
		const crypto: CryptoLike = { randomUUID: () => 'new-id', getRandomValues: (a) => a };
		expect(getOrCreateAnonId(store, crypto)).toBe('existing-id');
		expect(set).not.toHaveBeenCalled();
	});

	it('getOrCreateAnonId generates and persists on first use', () => {
		const set = jest.fn();
		const store: AnonIdStore = { get: () => null, set };
		const crypto: CryptoLike = { randomUUID: () => 'new-id', getRandomValues: (a) => a };
		expect(getOrCreateAnonId(store, crypto)).toBe('new-id');
		expect(set).toHaveBeenCalledWith('new-id');
	});
});

describe('isOptedOut', () => {
	it('opts out when no key is configured (OSS/local), regardless of consent', () => {
		expect(isOptedOut({ hasKey: false })).toBe(true);
		expect(isOptedOut({ hasKey: false, telemetryEnabled: true })).toBe(true);
	});

	it('opts out when the host explicitly disabled telemetry', () => {
		expect(isOptedOut({ hasKey: true, telemetryEnabled: false })).toBe(true);
	});

	it('does NOT opt out when a key exists and telemetry is enabled or unset', () => {
		expect(isOptedOut({ hasKey: true })).toBe(false);
		expect(isOptedOut({ hasKey: true, telemetryEnabled: true })).toBe(false);
	});
});

describe('standardProps', () => {
	const env: AnalyticsEnv = {
		platform: 'web',
		surface: 'marketing',
		appVersion: '9.9.9',
		anonymous: true,
		sessionId: 'sess-1',
	};

	it('always reports the rocketride-js $lib identity', () => {
		expect(standardProps(env, 'posthog-js').$lib).toBe('rocketride-js');
	});

	it('omits $lib_version unless a consumer supplies libVersion', () => {
		expect(standardProps(env, 'posthog-js').$lib_version).toBeUndefined();
		expect(standardProps({ ...env, libVersion: '2.0.0' }, 'posthog-js').$lib_version).toBe('2.0.0');
	});

	it('posthog-js mode omits raw-only context ($session_id, $process_person_profile)', () => {
		const p = standardProps(env, 'posthog-js');
		expect(p.session_id).toBe('sess-1');
		expect(p.$session_id).toBeUndefined();
		expect(p.$process_person_profile).toBeUndefined();
	});

	it('raw mode adds $session_id and suppresses the person profile for anonymous events', () => {
		const p = standardProps(env, 'raw');
		expect(p.$session_id).toBe('sess-1');
		expect(p.$process_person_profile).toBe(false);
	});

	it('emits $groups with PostHog group keys when env.groups is populated', () => {
		const p = standardProps({ ...env, groups: { app: 'a1', organization: 'o1' } }, 'posthog-js');
		// Pin the wire contract with hardcoded literal keys — do NOT derive from impl.
		expect(p.$groups).toEqual({ app: 'a1', organization: 'o1' });
	});

	it('omits the $groups key entirely when env.groups is absent', () => {
		const p = standardProps(env, 'posthog-js');
		expect(p).not.toHaveProperty('$groups');
	});
});
