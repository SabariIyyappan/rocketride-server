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

/// <reference path="../../../packages/shared-ui/src/types/global.d.ts" />
//
// The reference above pulls shared-ui's ambient module declarations (d3, the
// `import.meta.webpackContext` typing, asset imports) into the program when
// `./builder shell:freeze` bundles this entry with dts-bundle-generator, which
// builds its program from this file's import graph and does NOT read the
// tsconfig `files` array. Without it, transitively-reached shared-ui modules
// fail to compile during generation.

// =============================================================================
// shell-ui — curated app-facing API surface (contract entry)
// =============================================================================
//
// This module is the SINGLE curated surface that Module Federation remote apps
// consume from shell-ui. It gathers every value symbol apps actually import
// (established by grepping `from 'shell-ui'` across every app in the monorepo)
// into one `shellApi` object, plus the standalone types apps import.
//
// `./builder shell:freeze` bundles this file into a frozen, versioned `.d.ts`
// (packages/shell-api/versions/vN.d.ts). `ShellApiShape` is the compile-time
// contract; breaking it must break shell-ui's own `tsc`. Do NOT narrow this
// surface without a freeze — removing a member is a breaking change.
// =============================================================================

// =============================================================================
// VALUE IMPORTS — hooks, client access, classes, components, icons
// =============================================================================

// Hooks
import { useShellConnection } from './connection/ConnectionContext';
import { useAuthUser } from './hooks/useAuthUser';
import { useWorkspace } from './workspace/WorkspaceContext';
import { useClient } from './hooks/useClient';
import { useShellEvent } from './hooks/useShellEvent';
import { useSubscriptions } from './hooks/useSubscriptions';
import { usePolling } from './hooks/usePolling';

// Non-React client access + connection manager singleton
import { getClient } from './lib/getClient';
import { ConnectionManager } from './connection/connection';

// Document component library
import { Documents } from './lib/Documents';
import DocTabs from './lib/DocTabs';
import DocSplitLayout from './lib/DocSplitLayout';

// Layout components
import { NavButton } from './components/layout/Sidebar';
import ConfirmDialog from './components/layout/ConfirmDialog';

// Icons
import {
	BxPlus,
	BxEditAlt,
	BxTrash,
	BxDesktop,
	BxGridAlt,
	BxCog,
	BxListUl,
	BxStop,
	BxPlay,
	BxHome,
	BxNote,
	BxComponent,
	BxUser,
	BxRocket,
	BxLockOpen,
	BxPurchaseTag,
	BxChevronRight,
	BxFolderOpen,
} from './icons/BoxIcon';

// =============================================================================
// TYPE RE-EXPORTS — standalone types apps import from 'shell-ui'
// =============================================================================
//
// These have no corresponding runtime value in `shellApi`, so they are named
// in the frozen bundle via explicit type re-exports. The prop/return types of
// the value symbols above are captured structurally through `ShellApiShape`.
// =============================================================================

export type {
	ShellAppProps,
	ShellSidebarProps,
	AppDescriptor,
	AppManifestEntry,
	ShellConfig,
	ShellApiConfig,
} from './workspace/types';
// `Documents` itself is captured as a constructor via `shellApi.Documents`;
// these are its standalone helper types that apps import directly.
export type { Editor, WorkspaceBinding } from './lib/Documents';

// =============================================================================
// SHELL API SURFACE
// =============================================================================

/**
 * The curated set of value symbols shell-ui exposes to remote apps.
 *
 * Every member here is imported by at least one app (verified by survey), plus
 * `usePolling`, the shell's canonical connection-aware polling hook. The object
 * is frozen at build time so its type — `ShellApiShape` — becomes the versioned
 * contract enforced against shell-ui's own compilation.
 */
export const shellApi = {
	// Hooks
	useShellConnection,
	useAuthUser,
	useWorkspace,
	useClient,
	useShellEvent,
	useSubscriptions,
	usePolling,

	// Client access + connection manager
	getClient,
	ConnectionManager,

	// Document component library
	Documents,
	DocTabs,
	DocSplitLayout,

	// Layout components
	NavButton,
	ConfirmDialog,

	// Icons
	BxPlus,
	BxEditAlt,
	BxTrash,
	BxDesktop,
	BxGridAlt,
	BxCog,
	BxListUl,
	BxStop,
	BxPlay,
	BxHome,
	BxNote,
	BxComponent,
	BxUser,
	BxRocket,
	BxLockOpen,
	BxPurchaseTag,
	BxChevronRight,
	BxFolderOpen,
} as const;

/**
 * The compile-time shape of the shell API surface.
 *
 * This is the type frozen by `./builder shell:freeze` into `ShellApiVN`. Any
 * change that removes or narrows a member breaks conformance against a frozen
 * version and fails `tsc --noEmit`.
 */
export type ShellApiShape = typeof shellApi;

/**
 * The current in-source shell API version.
 *
 * Incremented implicitly by each successful `shell:freeze` (which writes the
 * next `vN`); this constant tracks the highest frozen version the source
 * currently targets.
 */
export const SHELL_API_VERSION = 0 as const;

/**
 * Returns the curated shell API surface.
 *
 * Apps call this (via shell-ui's public export) to obtain every shell-provided
 * hook, helper, class, component, and icon through one typed object rather than
 * importing each symbol individually.
 *
 * @returns The frozen `shellApi` object.
 */
export function getShellApi(): ShellApiShape {
	return shellApi;
}
