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
// rocketride/analytics — anonymous distinct_id primitive
// =============================================================================
//
// WHO NEEDS THIS: only the raw client.report() / raw-fetch capture path
// (VS Code host, product servers) needs to supply its own `distinct_id`.
// posthog-js manages identity itself, and in home-ui's COOKIELESS config
// (`cookieless_mode: 'always'`, `persistence: 'memory'`) PostHog derives a
// server-side id per request and BLOCKS `identify()` — so home-ui must NOT
// pass an anon id from here.
//
// SPLIT OF RESPONSIBILITY (keeps this module side-effect-free / env-agnostic):
//   - This module OWNS id generation (`newAnonId`) and the get-or-create
//     orchestration (`getOrCreateAnonId`).
//   - Each consumer OWNS persistence by implementing the tiny `AnonIdStore`
//     interface for its environment. The module defines the contract but
//     never reaches for a storage API.
// =============================================================================

/** Stable key/filename consumers should use for the persisted anon id. */
export const ANON_ID_KEY = 'rr_anon_id';

/**
 * Minimal structural shape of the Web Crypto API this module needs. Declared
 * locally instead of using the DOM lib's `Crypto` type so the published `.d.ts`
 * stays lib-agnostic — consumers compiling without the DOM lib (and with older
 * `@types/node`) still resolve it. `globalThis.crypto` satisfies it structurally.
 */
export interface CryptoLike {
	randomUUID?(): string;
	getRandomValues(array: Uint8Array): Uint8Array;
}

/**
 * Generate a fresh anonymous id.
 *
 * Prefers `crypto.randomUUID()` (modern browsers and Node 19+). When that is
 * unavailable — e.g. an insecure origin (`randomUUID` is gated to secure
 * contexts) or an older runtime — we fall back to building a RFC 4122 v4 UUID
 * from `crypto.getRandomValues()`, which is still cryptographically strong. We
 * deliberately do NOT fall back to `Math.random()`: it is not cryptographically
 * random, collides across many installs, and would undermine the
 * anonymity/uniqueness guarantee. Only if NEITHER crypto source exists do we
 * throw, so the consumer can decide to disable telemetry rather than emit a
 * weak, collision-prone id.
 *
 * `cryptoRef` is injected (default `globalThis.crypto`) to keep the module
 * testable and to avoid a hard reference to a possibly-absent global.
 */
export function newAnonId(cryptoRef: CryptoLike | undefined = globalThis.crypto): string {
	if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
		return cryptoRef.randomUUID();
	}
	if (cryptoRef && typeof cryptoRef.getRandomValues === 'function') {
		return uuidV4FromBytes(cryptoRef);
	}
	throw new Error('newAnonId: no crypto UUID source (randomUUID/getRandomValues); refusing to emit a non-crypto id');
}

/**
 * Build an RFC 4122 version-4 UUID from `crypto.getRandomValues()`. Used as a
 * fallback where `crypto.randomUUID()` is unavailable (insecure origin / older
 * runtime) but a CSPRNG still is. Sets the version (4) and variant (10xx) bits
 * per spec, then formats the 16 bytes as the canonical 8-4-4-4-12 hex string.
 */
function uuidV4FromBytes(cryptoRef: CryptoLike): string {
	const bytes = new Uint8Array(16);
	cryptoRef.getRandomValues(bytes);
	bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
	const hex: string[] = [];
	for (let i = 0; i < 16; i++) {
		hex.push(bytes[i].toString(16).padStart(2, '0'));
	}
	return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

/**
 * Persistence contract each consumer implements for its environment.
 * Intentionally synchronous and minimal.
 *
 *   - Browser  : localStorage-backed (get/set on `rr_anon_id`).
 *   - VS Code  : `context.globalState.get/update` (durable), or a JSON file
 *                under `context.globalStorageUri`.
 *   - Fallback : an in-memory object (id lives for the process lifetime).
 */
export interface AnonIdStore {
	/** Return the persisted id, or null if none has been stored yet. */
	get(): string | null;
	/** Durably persist the id. */
	set(id: string): void;
}

/**
 * Return the caller's stable anonymous id, generating & persisting one on first
 * use. This is the function VS Code / product code calls to obtain the
 * `distinct_id` for `client.report()`.
 */
export function getOrCreateAnonId(store: AnonIdStore, cryptoRef?: CryptoLike): string {
	const existing = store.get();
	if (existing) {
		return existing;
	}
	const id = newAnonId(cryptoRef);
	store.set(id);
	return id;
}
