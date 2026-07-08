// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

/**
 * ContentViewMenu — the bottom-tray ViewMenu renderer.
 *
 * Renders a view's declared {@link ViewMenu} as a compact 38px tray of uppercase
 * tabs, the active tab marked by a 2px brand bottom border. It fits snugly at the
 * bottom of the view: the host places it directly above the StatusBar in shell-ui
 * and at the bottom of the webview in vscode. This is the default ViewMenu
 * renderer and the only one the vscode host uses (it has no shell sidebar).
 *
 * Placement rules (documentation, enforced by the host — not this component):
 * - A ViewMenu's placement default is `'bottom'`, which selects this renderer.
 * - In tabbed apps the host swaps the menu when the active DocTab changes.
 * - Views must NOT render their own tab bars; they declare a ViewMenu and let
 *   the host place it.
 */

import React, { CSSProperties, ReactNode } from 'react';
import { ViewMenu } from '../../types/viewMenu';
import { ViewMenuBadge } from './ViewMenuBadge';

// =============================================================================
// TYPES
// =============================================================================

/** Props for the {@link ContentViewMenu} component. */
export interface IContentViewMenuProps {
	/** The declared menu whose entries render as the tray tabs. */
	menu: ViewMenu;
	/** Id of the currently active entry (drawn with the brand underline). */
	activeId: string;
	/** Fired with an entry id when the user selects it. */
	onSelect: (id: string) => void;
	/** Right-aligned slot (e.g. expand icon). Optional. */
	trailing?: ReactNode;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
	// The tray strip — snug row of tabs above the StatusBar / webview edge.
	tray: {
		flex: 'none',
		display: 'flex',
		alignItems: 'stretch',
		gap: 2,
		height: 38,
		padding: '0 10px',
		borderTop: '1px solid var(--rr-border)',
		background: 'var(--rr-bg-default)',
	} as CSSProperties,

	// A single tray tab; the active treatment is layered on top.
	tab: (active: boolean): CSSProperties => ({
		display: 'flex',
		alignItems: 'center',
		gap: 7,
		padding: '0 13px',
		fontSize: 11.5,
		fontWeight: 600,
		textTransform: 'uppercase',
		letterSpacing: '0.08em',
		color: active ? 'var(--rr-text-primary)' : 'var(--rr-text-secondary)',
		borderBottom: `2px solid ${active ? 'var(--rr-brand)' : 'transparent'}`,
		cursor: 'pointer',
	}),

	// Right-aligned trailing slot (e.g. expand icon).
	trailing: {
		marginLeft: 'auto',
		display: 'flex',
		alignItems: 'center',
		color: 'var(--rr-text-secondary)',
	} as CSSProperties,
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Renders a ViewMenu as the bottom tray.
 *
 * @param props - {@link IContentViewMenuProps}.
 * @returns The tray element.
 */
export function ContentViewMenu({ menu, activeId, onSelect, trailing }: IContentViewMenuProps): React.ReactElement {
	return (
		<div style={styles.tray}>
			{menu.entries.map((entry) => {
				// The active tab carries the brand underline + primary text colour.
				const isActive = entry.id === activeId;
				return (
					<div key={entry.id} style={styles.tab(isActive)} onClick={() => onSelect(entry.id)}>
						{entry.label}
						{/* Count badge when the entry declares a count. */}
						{entry.count != null && <ViewMenuBadge count={entry.count} severity={entry.severity} />}
					</div>
				);
			})}
			{/* Optional right-aligned slot, e.g. an expand icon. */}
			{trailing != null && <div style={styles.trailing}>{trailing}</div>}
		</div>
	);
}
