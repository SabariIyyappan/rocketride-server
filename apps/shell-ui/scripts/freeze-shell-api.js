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

'use strict';

// =============================================================================
// shell:freeze — generate the next frozen shell-api contract version
// =============================================================================
//
// Backs the `./builder shell:freeze` builder target. Bundles shell-ui's curated
// api.ts surface into a single self-contained .d.ts, versions it under
// packages/shell-api/versions/, and regenerates the conformance file so any
// future breaking drift fails shell-ui's own `tsc --noEmit`.
//
// Usage:  node freeze-shell-api.js [--check]
//   (no flag)  full freeze — writes the next version + updates the contract.
//   --check    CI mode — steps 1-4 only; nonzero exit if the live surface
//              differs from the newest frozen version (no freeze committed).
// =============================================================================

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

// =============================================================================
// PATHS
// =============================================================================

const SCRIPTS_DIR = __dirname; // apps/shell-ui/scripts
const APP_ROOT = path.resolve(SCRIPTS_DIR, '..'); // apps/shell-ui
const SRC_DIR = path.join(APP_ROOT, 'src');
const REPO_ROOT = path.resolve(APP_ROOT, '..', '..'); // rocketride-server
const CONTRACT_TSCONFIG = path.join(APP_ROOT, 'tsconfig.contract.json');
const SHARED_UI_TSCONFIG = path.join(REPO_ROOT, 'packages', 'shared-ui', 'tsconfig.json');
const SHELL_API_DIR = path.join(REPO_ROOT, 'packages', 'shell-api');
const VERSIONS_DIR = path.join(SHELL_API_DIR, 'versions');
const INDEX_TS = path.join(SHELL_API_DIR, 'index.ts');
const LATEST_TS = path.join(SHELL_API_DIR, 'latest.ts');
const CONTRACT_CHECK = path.join(SRC_DIR, 'contract-check.generated.ts');
const TMP_DIR = path.join(SHELL_API_DIR, '.freeze-tmp');

// Markers wrapping the generated declaration body inside each version file, so
// the no-op comparison can isolate the bundle from the provenance header and
// the version-specific type alias.
const BEGIN = '// ===== BEGIN FROZEN BUNDLE — do not edit =====';
const END = '// ===== END FROZEN BUNDLE =====';

// Reusable MIT license header for the hand-shaped generated files.
const MIT_HEADER = [
	'// MIT License',
	'//',
	'// Copyright (c) 2026 Aparavi Software AG',
	'//',
	'// Permission is hereby granted, free of charge, to any person obtaining a copy',
	'// of this software and associated documentation files (the "Software"), to deal',
	'// in the Software without restriction, including without limitation the rights',
	'// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
	'// copies of the Software, and to permit persons to whom the Software is',
	'// furnished to do so, subject to the following conditions:',
	'//',
	'// The above copyright notice and this permission notice shall be included in all',
	'// copies or substantial portions of the Software.',
	'//',
	'// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
	'// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
	'// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
	'// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
	'// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
	'// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
	'// SOFTWARE.',
].join('\n');

// =============================================================================
// BINARY RESOLUTION
// =============================================================================

/**
 * Resolve a workspace binary and its version by walking node_modules from the
 * shell-ui app root, so the freeze works regardless of where the monorepo
 * hoisted the dependency.
 *
 * @param {string} pkg - npm package name (e.g. 'typescript').
 * @param {string} binName - the bin entry to select when `bin` is a map.
 * @returns {{ binPath: string, version: string }}
 */
function resolveBin(pkg, binName) {
	// Locate the package's manifest starting from the app root.
	const pkgJsonPath = require.resolve(`${pkg}/package.json`, { paths: [APP_ROOT] });
	const pkgDir = path.dirname(pkgJsonPath);
	const manifest = require(pkgJsonPath);
	// The `bin` field is either a string or a name→path map.
	const binRel = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[binName];
	return { binPath: path.join(pkgDir, binRel), version: manifest.version };
}

const TSC = resolveBin('typescript', 'tsc');
const DBG = resolveBin('dts-bundle-generator', 'dts-bundle-generator');

// The TypeScript compiler API, used to strip non-public members from the
// bundle (see stripNonPublicMembers).
const ts = require(require.resolve('typescript', { paths: [APP_ROOT] }));

// =============================================================================
// BUNDLE POST-PROCESSING
// =============================================================================

/**
 * Remove `private`/`protected` members from every class declaration in the
 * generated bundle.
 *
 * dts-bundle-generator inlines classes (RocketRideClient, ConnectionManager,
 * Documents, ...) as fresh declarations. A class with private/protected members
 * is compared NOMINALLY, so the inlined copy would never match the live class
 * and the conformance assertion would always fail. Stripping the non-public
 * members makes the frozen classes purely structural: the live classes stay
 * assignable to them, while removing a PUBLIC member still breaks conformance.
 *
 * @param {string} dtsText - The generated declaration bundle.
 * @returns {string} The bundle with all non-public class members removed.
 */
function stripNonPublicMembers(dtsText) {
	const sourceFile = ts.createSourceFile('bundle.d.ts', dtsText, ts.ScriptTarget.Latest, true);
	const printer = ts.createPrinter({ removeComments: false, newLine: ts.NewLineKind.LineFeed });

	// True when a class member carries a private or protected modifier.
	const isNonPublic = (member) => {
		const mods = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined;
		return (
			!!mods &&
			mods.some(
				(m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword,
			)
		);
	};

	const transformer = (context) => (root) => {
		const visit = (node) => {
			if (ts.isClassDeclaration(node)) {
				// Drop non-public members so the class is compared structurally.
				const members = node.members.filter((m) => !isNonPublic(m));
				return ts.factory.updateClassDeclaration(
					node,
					node.modifiers,
					node.name,
					node.typeParameters,
					node.heritageClauses,
					members,
				);
			}
			return ts.visitEachChild(node, visit, context);
		};
		return ts.visitNode(root, visit);
	};

	const result = ts.transform(sourceFile, [transformer]);
	const printed = printer.printFile(result.transformed[0]);
	result.dispose();
	return printed;
}

// =============================================================================
// PROCESS HELPERS
// =============================================================================

/**
 * Run a Node CLI (resolved binary JS) and capture combined output.
 *
 * @param {string} binPath - Absolute path to the CLI's entry .js.
 * @param {string[]} args - CLI arguments.
 * @param {string} cwd - Working directory for the child process.
 * @returns {{ code: number, output: string }}
 */
function runNodeBin(binPath, args, cwd) {
	try {
		// execFileSync throws on a nonzero exit; capture stdout on success.
		const out = execFileSync(process.execPath, [binPath, ...args], {
			cwd,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		return { code: 0, output: out };
	} catch (err) {
		return { code: err.status || 1, output: `${err.stdout || ''}${err.stderr || ''}` };
	}
}

/** Prefixed console logger for freeze progress. */
function log(msg) {
	console.log(`[shell:freeze] ${msg}`);
}

/** Read the current rocketride-server git commit (or 'unknown'). */
function gitCommit() {
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
	} catch {
		return 'unknown';
	}
}

/** Remove the scratch directory used during generation. */
function cleanup() {
	try {
		fs.rmSync(TMP_DIR, { recursive: true, force: true });
	} catch {
		// Best-effort — a leftover temp dir is harmless.
	}
}

// =============================================================================
// FREEZE STEPS
// =============================================================================

/**
 * Step 1 — type-check shared-ui and the shell-ui contract program. A frozen
 * contract must never be generated from a broken tree.
 */
function preCheck() {
	log('Pre-check: tsc --noEmit (shared-ui + shell-ui contract)...');
	for (const [label, tsconfig] of [
		['shared-ui', SHARED_UI_TSCONFIG],
		['shell-ui (contract)', CONTRACT_TSCONFIG],
	]) {
		const r = runNodeBin(TSC.binPath, ['--noEmit', '-p', tsconfig], REPO_ROOT);
		if (r.code !== 0) {
			console.error(`[shell:freeze] Pre-check FAILED for ${label}:`);
			console.error(r.output);
			cleanup();
			process.exit(1);
		}
	}
	log('Pre-check passed.');
}

/**
 * Step 2 — bundle api.ts into a single self-contained .d.ts and return its body
 * (banner stripped). dts-bundle-generator resolves triple-slash references from
 * its CWD, so it is run from src/ where the `../../../` reference in api.ts also
 * resolves the way tsc (file-relative) resolves it.
 *
 * @returns {string} The generated declaration body.
 */
function generateCandidate() {
	fs.mkdirSync(TMP_DIR, { recursive: true });
	const candidatePath = path.join(TMP_DIR, 'candidate.d.ts');
	const r = runNodeBin(
		DBG.binPath,
		[
			'--project', path.relative(SRC_DIR, CONTRACT_TSCONFIG),
			'--no-check',
			'--no-banner',
			'--export-referenced-types=false',
			'-o', candidatePath,
			'api.ts',
		],
		SRC_DIR,
	);
	if (r.code !== 0 || !fs.existsSync(candidatePath)) {
		console.error('[shell:freeze] dts-bundle-generator FAILED:');
		console.error(r.output);
		cleanup();
		process.exit(1);
	}
	// Strip non-public class members so inlined classes compare structurally,
	// then normalize trailing whitespace so the no-op comparison is stable.
	const stripped = stripNonPublicMembers(fs.readFileSync(candidatePath, 'utf8'));
	return `${stripped.replace(/\s+$/, '')}\n`;
}

/**
 * Step 3 — determine the next version number from existing snapshots.
 *
 * @returns {{ next: number, prev: number }} `prev` is -1 when none exist.
 */
function determineVersions() {
	if (!fs.existsSync(VERSIONS_DIR)) return { next: 0, prev: -1 };
	const nums = fs
		.readdirSync(VERSIONS_DIR)
		.map((f) => /^v(\d+)\.d\.ts$/.exec(f))
		.filter(Boolean)
		.map((m) => parseInt(m[1], 10));
	if (nums.length === 0) return { next: 0, prev: -1 };
	const max = Math.max(...nums);
	return { next: max + 1, prev: max };
}

/** Extract the declaration body between the BEGIN/END markers of a version file. */
function extractBundleBody(fileContent) {
	const start = fileContent.indexOf(BEGIN);
	const end = fileContent.indexOf(END);
	if (start === -1 || end === -1) return null;
	return fileContent.slice(start + BEGIN.length, end).trim();
}

/**
 * Step 4 — is the candidate textually identical to the newest frozen version
 * (ignoring the provenance header and version-specific alias)?
 *
 * @param {number} prev - Newest existing version, or -1.
 * @param {string} candidateBody - The freshly generated bundle body.
 * @returns {boolean}
 */
function isNoOp(prev, candidateBody) {
	if (prev < 0) return false;
	const prevContent = fs.readFileSync(path.join(VERSIONS_DIR, `v${prev}.d.ts`), 'utf8');
	const prevBody = extractBundleBody(prevContent);
	return prevBody !== null && prevBody === candidateBody.trim();
}

/**
 * Step 5 — compatibility gate. Verify the new version is a superset of the
 * previous one (additions allowed, removals rejected). Only runs when a
 * previous version exists. There is no override flag.
 *
 * @param {number} prev - Previous version number.
 * @param {number} next - Candidate version number.
 * @param {string} candidateBody - The generated bundle body.
 */
function compatibilityGate(prev, next, candidateBody) {
	// Write the candidate as an importable module that exports ShellApiV{next}.
	const candidatePath = path.join(TMP_DIR, 'candidate.d.ts');
	fs.writeFileSync(candidatePath, `${candidateBody}\nexport type ShellApiV${next} = ShellApiShape;\n`);
	// Assert the old shape is still satisfiable by the new shape.
	const compatPath = path.join(TMP_DIR, 'compat.ts');
	fs.writeFileSync(
		compatPath,
		[
			`import type { ShellApiV${prev} } from '../versions/v${prev}';`,
			`import type { ShellApiV${next} } from './candidate';`,
			`const _compat: ShellApiV${prev} = {} as ShellApiV${next};`,
			'void _compat;',
			'',
		].join('\n'),
	);
	// Self-contained bundles still import 'react'; provide DOM/JSX libs and let
	// module resolution walk up to the hoisted react types.
	const tmpTsconfig = path.join(TMP_DIR, 'tsconfig.json');
	fs.writeFileSync(
		tmpTsconfig,
		JSON.stringify(
			{
				compilerOptions: {
					noEmit: true,
					strict: true,
					skipLibCheck: true,
					moduleResolution: 'bundler',
					module: 'esnext',
					target: 'es2020',
					lib: ['es2020', 'dom', 'dom.iterable'],
					jsx: 'react-jsx',
				},
				files: ['compat.ts'],
			},
			null,
			2,
		),
	);
	const r = runNodeBin(TSC.binPath, ['--noEmit', '-p', tmpTsconfig], TMP_DIR);
	if (r.code !== 0) {
		console.error(
			`[shell:freeze] BREAKING CHANGE vs v${prev} — restore the old member(s) alongside the new API, then re-run`,
		);
		console.error(r.output);
		cleanup();
		process.exit(1);
	}
	log(`Compatibility gate passed: v${next} is backward-compatible with v${prev}.`);
}

/** Build the provenance header stamped onto each frozen version file. */
function versionHeader(next) {
	return [
		MIT_HEADER,
		'',
		'// =============================================================================',
		`// FROZEN shell-api contract — ShellApiV${next} — never edit by hand`,
		'// =============================================================================',
		`// Generated:     ${new Date().toISOString()}`,
		`// Source commit: ${gitCommit()}`,
		`// Generator:     dts-bundle-generator@${DBG.version}`,
		'// Produced by:   ./builder shell:freeze',
		'// =============================================================================',
	].join('\n');
}

/**
 * Step 6a — write the frozen version snapshot.
 *
 * @param {number} next - Version number.
 * @param {string} candidateBody - The generated bundle body.
 */
function writeVersion(next, candidateBody) {
	fs.mkdirSync(VERSIONS_DIR, { recursive: true });
	const content = [
		versionHeader(next),
		'',
		BEGIN,
		candidateBody.trim(),
		END,
		`export type ShellApiV${next} = ShellApiShape;`,
		'',
	].join('\n');
	fs.writeFileSync(path.join(VERSIONS_DIR, `v${next}.d.ts`), content);
}

/**
 * Step 6b — regenerate latest.ts and index.ts from the full set of versions.
 *
 * @param {number} maxN - The newest (just-frozen) version number.
 */
function regenerateBarrels(maxN) {
	const generatedNote = [
		'',
		'// =============================================================================',
		'// GENERATED by `./builder shell:freeze` — do not edit by hand.',
		'// =============================================================================',
		'',
	].join('\n');

	// latest.ts re-exports the newest version's full surface.
	fs.writeFileSync(LATEST_TS, `${MIT_HEADER}\n${generatedNote}export * from './versions/v${maxN}';\n`);

	// index.ts maps every version number to its snapshot type and tracks latest.
	const versions = [];
	for (let i = 0; i <= maxN; i++) versions.push(i);
	const imports = versions.map((i) => `import type { ShellApiV${i} } from './versions/v${i}';`).join('\n');
	const mapEntries = versions.map((i) => `\t${i}: ShellApiV${i};`).join('\n');
	const index = [
		MIT_HEADER,
		generatedNote.trimEnd(),
		'',
		imports,
		'',
		'/** Registry mapping each frozen shell API version number to its type snapshot. */',
		`export interface ShellApiVersions {\n${mapEntries}\n}`,
		'',
		'/** The newest frozen shell API version. */',
		`export type ShellApiLatest = ShellApiVersions[${maxN}];`,
		'',
		"export * from './latest';",
		'',
	].join('\n');
	fs.writeFileSync(INDEX_TS, index);
}

/** Collect the individually-exported named types from the bundle body. */
function parseExportedTypes(candidateBody) {
	const names = new Set();
	// Inline `export interface X` / `export type X` declarations.
	let m;
	const inlineRe = /^export (?:interface|type) (\w+)/gm;
	while ((m = inlineRe.exec(candidateBody))) names.add(m[1]);
	// Re-export blocks: `export { A as B, C }`.
	const blockRe = /export \{([^}]*)\}/g;
	while ((m = blockRe.exec(candidateBody))) {
		for (const part of m[1].split(',')) {
			const token = part.trim();
			if (!token) continue;
			const asMatch = /\w+\s+as\s+(\w+)/.exec(token);
			names.add(asMatch ? asMatch[1] : token);
		}
	}
	// Exclude the contract machinery — it is checked via the ShellApiShape gate.
	names.delete('ShellApiShape');
	return [...names];
}

/**
 * Step 7 — regenerate the conformance file compiled by shell-ui's own tsc. It
 * asserts the live api.ts surface still satisfies the frozen version; any
 * removed/narrowed member becomes a `tsc --noEmit` error.
 *
 * @param {number} next - The just-frozen version number.
 * @param {string[]} namedTypes - Individually-exported named types.
 */
function generateConformance(next, namedTypes) {
	const lines = [];
	lines.push('// =============================================================================');
	lines.push('// contract-check.generated.ts');
	lines.push('// =============================================================================');
	lines.push('// GENERATED by `./builder shell:freeze` — do not edit by hand.');
	lines.push('//');
	lines.push(`// Proves shell-ui's live api.ts surface still conforms to frozen ShellApiV${next}.`);
	lines.push('// A removed or narrowed member breaks this file under `tsc --noEmit`.');
	lines.push('// =============================================================================');
	lines.push('');
	// Imports first (module-level).
	lines.push(`import type { ShellApiV${next} } from 'shell-api/versions/v${next}';`);
	lines.push("import type { ShellApiShape } from './api';");
	for (const name of namedTypes) {
		lines.push(`import type { ${name} as Frozen_${name} } from 'shell-api/versions/v${next}';`);
		lines.push(`import type { ${name} as Current_${name} } from './api';`);
	}
	lines.push('');
	lines.push('// The live shell API shape must remain assignable to the frozen contract.');
	lines.push(`const _conformance: ShellApiV${next} = {} as ShellApiShape;`);
	lines.push('void _conformance;');
	lines.push('');
	lines.push('// Each individually-exported contract type must still be satisfied.');
	for (const name of namedTypes) {
		lines.push(`const _check_${name}: Frozen_${name} = {} as Current_${name};`);
		lines.push(`void _check_${name};`);
	}
	lines.push('');
	fs.writeFileSync(CONTRACT_CHECK, lines.join('\n'));
}

// =============================================================================
// MAIN
// =============================================================================

/** Orchestrates the freeze (or --check) run. */
function main() {
	const checkMode = process.argv.includes('--check');

	// Steps 1-4 are shared by both modes.
	preCheck();
	const candidateBody = generateCandidate();
	const { next, prev } = determineVersions();

	if (checkMode) {
		// CI mode: never write; fail if the live surface drifted from newest.
		if (prev < 0) {
			log('No frozen version exists yet — nothing to check.');
		} else if (isNoOp(prev, candidateBody)) {
			log(`Up to date with v${prev}.`);
		} else {
			console.error(
				`[shell:freeze --check] Shell API changed without a freeze (differs from v${prev}). Run \`./builder shell:freeze\`.`,
			);
			cleanup();
			process.exit(1);
		}
		cleanup();
		return;
	}

	// Full freeze.
	if (isNoOp(prev, candidateBody)) {
		log('nothing to freeze');
		cleanup();
		return;
	}
	if (prev >= 0) compatibilityGate(prev, next, candidateBody);

	writeVersion(next, candidateBody);
	regenerateBarrels(next);
	const namedTypes = parseExportedTypes(candidateBody);
	generateConformance(next, namedTypes);
	cleanup();

	// Summary.
	log(`Froze ShellApiV${next} -> packages/shell-api/versions/v${next}.d.ts`);
	log(`Exported named types (${namedTypes.length}): ${namedTypes.join(', ')}`);
	log('Updated packages/shell-api/{latest.ts,index.ts} and apps/shell-ui/src/contract-check.generated.ts.');
	log('Changes left uncommitted.');
}

main();
