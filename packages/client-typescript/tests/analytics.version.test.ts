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
 * Drift guard for the analytics SDK version.
 *
 * `RR_LIB_VERSION` is hardcoded in standardProps.ts (the module is deliberately
 * import-free / zero-runtime and is consumed both via a source alias and a
 * plain-tsc build, so it can't be build-time stamped uniformly). This test makes
 * drift a hard CI failure: bumping package.json `version` without updating
 * `RR_LIB_VERSION` fails here, preventing a stale `$lib_version` on every event.
 */
import { describe, it, expect } from '@jest/globals';
import pkg from '../package.json';
import { RR_LIB_VERSION } from '../src/client/analytics/standardProps';

describe('analytics standardProps', () => {
	it('RR_LIB_VERSION stays in sync with package.json version', () => {
		expect(RR_LIB_VERSION).toBe(pkg.version);
	});
});
