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
// HOST CHROME CONTEXT — opt-in sidebar-content + ViewMenu registration
// =============================================================================
//
// The shell frame owns two slots that apps may fill at runtime, WITHOUT the app
// having to render into the shell's DOM directly:
//
//   1. Sidebar content — a ReactNode declared via useSidebarContent(), mounted
//      inside the sidebar's scrolling slot (below the fixed header, above the
//      fixed footer).
//   2. A ViewMenu — declared via useViewMenu(), rendered by the shell with one
//      of the two stock renderers (ContentViewMenu tray above the StatusBar for
//      'bottom' placement, SidebarViewMenu at the top of the sidebar slot for
//      'sidebar' placement).
//
// Both mechanisms are OPT-IN. An app that never calls them behaves exactly as
// before: its legacy `components.Sidebar` (if any) still renders in the slot and
// no ViewMenu is shown. The mechanism the app's `<App />` uses to register lives
// in a DIFFERENT context than the resolved state the shell reads, so that
// updating the rendered content does NOT re-render the registering app (which
// would otherwise recreate an inline node/menu and loop). The app consumes only
// the STABLE registration API; the shell chrome (Sidebar, client area) consumes
// the resolved STATE.
//
// Registration model — "the currently mounted active view wins":
//   Each hook instance owns a stable token. It registers on mount, syncs on
//   change, and unregisters on unmount, clearing the shared slot only if it is
//   still the current owner (token match). For DocTabs apps only the active
//   tab's view is mounted, so the mounted active view naturally owns the slot;
//   switching tabs unmounts the old view (clears) and mounts the new one
//   (registers). Last registration wins, so mount/unmount ordering during a
//   switch is irrelevant.
// =============================================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ViewMenu } from 'shared';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options accepted by {@link useViewMenu}.
 *
 * A single options object (rather than positional args) so the optional
 * `sectionLabel` — used only by the sidebar renderer — reads clearly at the
 * call site and the shape can grow without breaking callers.
 */
export interface UseViewMenuOptions {
	/** The declared menu, or `null` to register nothing (e.g. no open document). */
	menu: ViewMenu | null;
	/** Id of the currently active entry. */
	activeId: string;
	/** Fired with an entry id when the user selects it. */
	onSelect: (id: string) => void;
	/** Section label shown above the sidebar renderer (e.g. the owning document title). */
	sectionLabel?: string;
}

/**
 * A resolved ViewMenu registration the shell renders. The `onSelect` stored here
 * is a stable wrapper that always calls the registrant's latest callback.
 */
export interface RegisteredViewMenu {
	/** The declared menu whose entries render. */
	menu: ViewMenu;
	/** Id of the currently active entry. */
	activeId: string;
	/** Stable select handler forwarding to the registrant's latest onSelect. */
	onSelect: (id: string) => void;
	/** Optional section label for the sidebar renderer. */
	sectionLabel?: string;
}

/** The resolved chrome state the shell reads to place content and menus. */
export interface HostChromeState {
	/** App-declared sidebar content, or null when none is registered. */
	sidebarContent: ReactNode | null;
	/** The active view's ViewMenu registration, or null when none is registered. */
	viewMenu: RegisteredViewMenu | null;
}

/** The stable registration API apps call. Identity never changes across renders. */
interface HostChromeApi {
	/** Register/replace the sidebar content owned by `token`. */
	registerSidebarContent: (token: object, content: ReactNode | null) => void;
	/** Clear the sidebar content if `token` still owns it. */
	unregisterSidebarContent: (token: object) => void;
	/** Register/replace the ViewMenu owned by `token`. */
	registerViewMenu: (token: object, reg: RegisteredViewMenu) => void;
	/** Clear the ViewMenu if `token` still owns it. */
	unregisterViewMenu: (token: object) => void;
}

// =============================================================================
// CONTEXTS
// =============================================================================
//
// Two contexts, deliberately split: apps consume only the stable API context so
// their re-render is never driven by content updates; the shell chrome consumes
// the state context.
// =============================================================================

/** No-op API used when a hook is called outside a provider (standalone/tests). */
const NOOP_API: HostChromeApi = {
	registerSidebarContent: () => {},
	unregisterSidebarContent: () => {},
	registerViewMenu: () => {},
	unregisterViewMenu: () => {},
};

/** Empty state used when the reader is mounted outside a provider. */
const EMPTY_STATE: HostChromeState = { sidebarContent: null, viewMenu: null };

const HostChromeApiContext = createContext<HostChromeApi>(NOOP_API);
const HostChromeStateContext = createContext<HostChromeState>(EMPTY_STATE);

// =============================================================================
// EQUALITY HELPERS
// =============================================================================

/**
 * Structural equality for two ViewMenus — used to skip redundant chrome
 * re-renders when an app passes a fresh-but-identical menu object each render.
 *
 * @param a - First menu.
 * @param b - Second menu.
 * @returns True when placement and every entry field match.
 */
function sameViewMenu(a: ViewMenu, b: ViewMenu): boolean {
	// Fast path: same reference.
	if (a === b) return true;
	// Placement drives which renderer/where, so it is part of identity.
	if ((a.placement ?? 'bottom') !== (b.placement ?? 'bottom')) return false;
	if (a.entries.length !== b.entries.length) return false;
	// Compare each entry's user-visible fields.
	for (let i = 0; i < a.entries.length; i++) {
		const x = a.entries[i];
		const y = b.entries[i];
		if (x.id !== y.id || x.label !== y.label || x.count !== y.count || x.severity !== y.severity) return false;
	}
	return true;
}

// =============================================================================
// PROVIDER
// =============================================================================

/** Internal owner-tagged sidebar registration. */
interface SidebarSlot {
	token: object;
	content: ReactNode | null;
}

/** Internal owner-tagged ViewMenu registration. */
interface ViewMenuSlot {
	token: object;
	reg: RegisteredViewMenu;
}

/**
 * Provides the host-chrome registration API and resolved state to the shell
 * subtree. Mounted once by {@link ShellLayout} so it wraps BOTH the sidebar and
 * the client area (where the active app registers from).
 *
 * @param props.children - The shell layout subtree.
 */
export const HostChromeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	// --- Owner-tagged slot state -------------------------------------------
	const [sidebarSlot, setSidebarSlot] = useState<SidebarSlot | null>(null);
	const [viewMenuSlot, setViewMenuSlot] = useState<ViewMenuSlot | null>(null);

	// --- Stable registration API (identity fixed for the provider's life) ---
	const api = useMemo<HostChromeApi>(() => ({
		registerSidebarContent: (token, content) => {
			// Replace only when the owner changed or the node identity changed,
			// so a stable node registered repeatedly does not churn the chrome.
			setSidebarSlot((cur) => (cur && cur.token === token && cur.content === content ? cur : { token, content }));
		},
		unregisterSidebarContent: (token) => {
			// Clear only if this token still owns the slot (last-writer-wins).
			setSidebarSlot((cur) => (cur && cur.token === token ? null : cur));
		},
		registerViewMenu: (token, reg) => {
			// Skip the update when the same owner re-registers identical data.
			setViewMenuSlot((cur) => {
				if (
					cur
					&& cur.token === token
					&& cur.reg.activeId === reg.activeId
					&& cur.reg.sectionLabel === reg.sectionLabel
					&& cur.reg.onSelect === reg.onSelect
					&& sameViewMenu(cur.reg.menu, reg.menu)
				) {
					return cur;
				}
				return { token, reg };
			});
		},
		unregisterViewMenu: (token) => {
			// Clear only if this token still owns the slot (last-writer-wins).
			setViewMenuSlot((cur) => (cur && cur.token === token ? null : cur));
		},
	}), []);

	// --- Resolved state the shell chrome consumes --------------------------
	const state = useMemo<HostChromeState>(() => ({
		sidebarContent: sidebarSlot ? sidebarSlot.content : null,
		viewMenu: viewMenuSlot ? viewMenuSlot.reg : null,
	}), [sidebarSlot, viewMenuSlot]);

	return (
		<HostChromeApiContext.Provider value={api}>
			<HostChromeStateContext.Provider value={state}>
				{children}
			</HostChromeStateContext.Provider>
		</HostChromeApiContext.Provider>
	);
};

// =============================================================================
// READER HOOK (shell chrome)
// =============================================================================

/**
 * Reads the resolved host-chrome state. Consumed by the shell's Sidebar and
 * client area to place app-declared content and ViewMenus. NOT for apps.
 *
 * @returns The current {@link HostChromeState}.
 */
export function useHostChromeState(): HostChromeState {
	return useContext(HostChromeStateContext);
}

// =============================================================================
// REGISTRATION HOOKS (apps)
// =============================================================================

/**
 * Declare the shell sidebar content for the calling view.
 *
 * Opt-in: an app that never calls this keeps its legacy `components.Sidebar`
 * behavior. Passing a node mounts it inside the sidebar's scrolling slot; passing
 * `null` (or unmounting) withdraws it. When no app supplies sidebar content and
 * the app has no legacy sidebar, the shell renders no sidebar and the client area
 * spans full width.
 *
 * @param content - The sidebar node to mount, or null to declare nothing.
 */
export function useSidebarContent(content: ReactNode | null): void {
	const api = useContext(HostChromeApiContext);
	// Stable per-instance ownership token for last-writer-wins arbitration.
	const tokenRef = useRef<object>({});

	// Clear this instance's registration on unmount only (not on every change),
	// so switching content never flashes an empty slot.
	useEffect(() => {
		const token = tokenRef.current;
		return () => api.unregisterSidebarContent(token);
	}, [api]);

	// Sync the current content into the slot whenever it changes. The provider
	// dedupes by node identity, so a stable node registers once.
	useEffect(() => {
		api.registerSidebarContent(tokenRef.current, content ?? null);
	}, [api, content]);
}

/**
 * Declare the ViewMenu for the calling view. The shell renders it with the stock
 * renderer selected by `menu.placement` ('bottom' tray by default, or 'sidebar').
 *
 * Opt-in: an app that never calls this shows no ViewMenu (today's layout). In a
 * DocTabs app each view calls this from its own component; because only the
 * active tab is mounted, the mounted active view owns the menu and switching
 * tabs swaps it. Pass `menu: null` to register nothing (e.g. no open document).
 *
 * @param options - The menu, active entry, select handler, and optional label.
 */
export function useViewMenu(options: UseViewMenuOptions): void {
	const { menu, activeId, onSelect, sectionLabel } = options;
	const api = useContext(HostChromeApiContext);
	// Stable per-instance ownership token for last-writer-wins arbitration.
	const tokenRef = useRef<object>({});

	// Keep the latest onSelect in a ref and expose a stable wrapper, so the
	// caller's (often inline) handler identity never drives re-registration.
	const onSelectRef = useRef(onSelect);
	onSelectRef.current = onSelect;
	const stableSelect = useCallback((id: string) => onSelectRef.current(id), []);

	// Clear this instance's registration on unmount only.
	useEffect(() => {
		const token = tokenRef.current;
		return () => api.unregisterViewMenu(token);
	}, [api]);

	// Sync the current menu into the slot; the provider dedupes structurally.
	useEffect(() => {
		if (menu) {
			api.registerViewMenu(tokenRef.current, { menu, activeId, onSelect: stableSelect, sectionLabel });
		} else {
			api.unregisterViewMenu(tokenRef.current);
		}
	}, [api, menu, activeId, sectionLabel, stableSelect]);
}
