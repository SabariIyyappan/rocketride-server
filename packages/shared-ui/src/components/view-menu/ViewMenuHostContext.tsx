// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

/**
 * ViewMenuHostContext — the "view declares, host renders" adapter.
 *
 * A complex view with sub-views declares a single {@link ViewMenu}; a host (the
 * vscode webview tray or the shell-ui bottom tray) renders it. The view calls
 * {@link usePublishViewMenu} to publish its menu while mounted; the host mounts a
 * {@link ViewMenuHostProvider} and reads the current publication via
 * {@link useViewMenuHostState} to render it wherever it belongs.
 *
 * Opt-in and backward-compatible: a view rendered WITHOUT a host provider gets
 * `false` from {@link usePublishViewMenu} and renders its legacy TabPanel
 * fallback unchanged. Only when a host provider is present does the view drop its
 * own tab bar and let the host draw the menu.
 *
 * Two-context split (mirrors shell-ui's HostChromeContext): the view consumes
 * only the STABLE api context, so a host re-rendering the menu never re-renders
 * the publishing view; the host consumes the STATE context. Ownership uses a
 * per-hook token so mount/unmount ordering during a view switch is irrelevant
 * (last-writer-wins).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ViewMenu } from '../../types/viewMenu';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A view's ViewMenu publication. The host renders `menu` with the entry `activeId`
 * marked active; selecting an entry calls `onSelect` with its id.
 */
export interface IViewMenuPublication {
	/** The declared menu whose entries the host renders. */
	menu: ViewMenu;
	/** Id of the currently active entry. */
	activeId: string;
	/** Fired with an entry id when the user selects it. */
	onSelect: (id: string) => void;
	/** Section label shown above the sidebar renderer (e.g. the owning document title). */
	sectionLabel?: string;
}

/**
 * The stable registration api the publishing view calls. A non-null value in the
 * api context signals "a host is present"; `null` means no host (fallback path).
 * Ownership is arbitrated by a per-hook `token` so a late unmount cannot clear a
 * newer publication (last-writer-wins).
 */
interface ViewMenuHostApi {
	/** Register/replace the publication owned by `token`. */
	publish: (token: object, pub: IViewMenuPublication) => void;
	/** Clear the publication if `token` still owns it. */
	unpublish: (token: object) => void;
}

// =============================================================================
// CONTEXTS
// =============================================================================
//
// Deliberately split: views consume only the stable api context (so a menu
// update never re-renders the publisher); hosts consume the state context.
// Both default to a "no host" value so a provider-less embedding is inert.
// =============================================================================

/** Api context — `null` when no host provider is mounted above the view. */
const ViewMenuHostApiContext = createContext<ViewMenuHostApi | null>(null);

/** State context — the current publication a host renders, or `null` when none. */
const ViewMenuHostStateContext = createContext<IViewMenuPublication | null>(null);

// =============================================================================
// EQUALITY HELPER
// =============================================================================

/**
 * Structural equality for two publications — lets the provider skip redundant
 * state updates when a view re-publishes a fresh-but-identical object every
 * render (its menu/entries are typically rebuilt inline each render).
 *
 * @param a - First publication.
 * @param b - Second publication.
 * @returns True when the active entry, section label, select handler, and every
 *          menu entry field match.
 */
function samePublication(a: IViewMenuPublication, b: IViewMenuPublication): boolean {
	// Compare the scalar fields first.
	if (a.activeId !== b.activeId || a.sectionLabel !== b.sectionLabel || a.onSelect !== b.onSelect) return false;
	// Placement drives which renderer/where, so it is part of identity.
	if ((a.menu.placement ?? 'bottom') !== (b.menu.placement ?? 'bottom')) return false;
	if (a.menu.entries.length !== b.menu.entries.length) return false;
	// Compare each entry's user-visible fields.
	for (let i = 0; i < a.menu.entries.length; i++) {
		const x = a.menu.entries[i];
		const y = b.menu.entries[i];
		if (x.id !== y.id || x.label !== y.label || x.count !== y.count || x.severity !== y.severity) return false;
	}
	return true;
}

// =============================================================================
// PROVIDER
// =============================================================================

/** Internal owner-tagged publication slot. */
interface PublicationSlot {
	token: object;
	pub: IViewMenuPublication;
}

/**
 * Hosts a view's ViewMenu publication. Mount this in a host (vscode webview root,
 * shell-ui client area) and read the current publication with
 * {@link useViewMenuHostState} to render it. The stable api it provides is what
 * {@link usePublishViewMenu} registers into; the companion state context carries
 * the resolved publication the host renders.
 *
 * @param props.children - The subtree that may contain a publishing view.
 */
export const ViewMenuHostProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	// --- Owner-tagged publication slot -------------------------------------
	const [slot, setSlot] = useState<PublicationSlot | null>(null);

	// --- Stable registration api (identity fixed for the provider's life) --
	const api = useMemo<ViewMenuHostApi>(() => ({
		publish: (token, pub) => {
			// Skip the update when the same owner re-publishes identical data,
			// so a view re-rendering with a fresh menu object does not churn hosts.
			setSlot((cur) => (cur && cur.token === token && samePublication(cur.pub, pub) ? cur : { token, pub }));
		},
		unpublish: (token) => {
			// Clear only if this token still owns the slot (last-writer-wins).
			setSlot((cur) => (cur && cur.token === token ? null : cur));
		},
	}), []);

	// --- Resolved publication the host reads -------------------------------
	const publication = slot ? slot.pub : null;

	return (
		<ViewMenuHostApiContext.Provider value={api}>
			<ViewMenuHostStateContext.Provider value={publication}>
				{children}
			</ViewMenuHostStateContext.Provider>
		</ViewMenuHostApiContext.Provider>
	);
};

// =============================================================================
// READER HOOK (host)
// =============================================================================

/**
 * Reads the current ViewMenu publication a host should render, or `null` when no
 * view has published one. For hosts (vscode tray, shell-ui bridge) — not views.
 *
 * @returns The current {@link IViewMenuPublication}, or null.
 */
export function useViewMenuHostState(): IViewMenuPublication | null {
	return useContext(ViewMenuHostStateContext);
}

// =============================================================================
// PUBLISH HOOK (view)
// =============================================================================

/**
 * Publish the calling view's ViewMenu to the enclosing host while mounted.
 *
 * Opt-in and backward-compatible: when no {@link ViewMenuHostProvider} is present
 * this returns `false` and does nothing, so the view renders its legacy TabPanel
 * fallback exactly as before. When a host IS present it returns `true`; the view
 * should then drop its own tab bar and let the host render the menu. Pass `null`
 * to publish nothing (e.g. a view whose sub-views collapse to one).
 *
 * @param pub - The publication to expose while mounted, or null for none.
 * @returns True when a host provider is present (the view should defer its tabs).
 */
export function usePublishViewMenu(pub: IViewMenuPublication | null): boolean {
	const api = useContext(ViewMenuHostApiContext);
	const hostPresent = api !== null;

	// Stable per-instance ownership token for last-writer-wins arbitration.
	const tokenRef = useRef<object>({});

	// Keep the latest onSelect in a ref and expose a stable wrapper, so the
	// caller's (often inline) handler identity never drives re-registration.
	const onSelectRef = useRef(pub?.onSelect);
	onSelectRef.current = pub?.onSelect;
	const stableSelect = useCallback((id: string) => onSelectRef.current?.(id), []);

	// Clear this instance's registration on unmount only (not on every change),
	// so switching menus never flashes an empty host slot.
	useEffect(() => {
		const token = tokenRef.current;
		return () => api?.unpublish(token);
	}, [api]);

	// Sync the current publication into the host; the provider dedupes
	// structurally, so a stable menu registers once. Depend on the primitive
	// fields (menu/entries are typically rebuilt inline each render).
	useEffect(() => {
		if (api && pub) {
			api.publish(tokenRef.current, { menu: pub.menu, activeId: pub.activeId, onSelect: stableSelect, sectionLabel: pub.sectionLabel });
		} else if (api) {
			api.unpublish(tokenRef.current);
		}
	}, [api, pub?.menu, pub?.activeId, pub?.sectionLabel, stableSelect]);

	return hostPresent;
}
