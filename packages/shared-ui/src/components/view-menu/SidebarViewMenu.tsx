// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

/**
 * SidebarViewMenu — the vertical ViewMenu renderer (shell-ui sidebar slot).
 *
 * Renders a view's declared {@link ViewMenu} as a vertical list inside the
 * sidebar's app-content slot when the active view opted into `'sidebar'`
 * placement. The active entry is drawn as a brand-tinted pill; count badges are
 * right-aligned via the shared {@link ViewMenuBadge}.
 *
 * Placement rules (documentation, enforced by the host — not this component):
 * - A ViewMenu's placement default is `'bottom'`; only views that opt into
 *   `'sidebar'` render through this component.
 * - In tabbed apps the host swaps the menu when the active DocTab changes.
 * - Views must NOT render their own tab bars; they declare a ViewMenu and let
 *   the host place it.
 */

import React, { CSSProperties, useState } from 'react';
import { ViewMenu } from '../../types/viewMenu';
import { ViewMenuBadge } from './ViewMenuBadge';

// =============================================================================
// TYPES
// =============================================================================

/** Props for the {@link SidebarViewMenu} component. */
export interface ISidebarViewMenuProps {
	/** The declared menu whose entries render as the vertical list. */
	menu: ViewMenu;
	/** Id of the currently active entry (drawn as the brand-tinted pill). */
	activeId: string;
	/** Fired with an entry id when the user selects it. */
	onSelect: (id: string) => void;
	/** Section label above the menu, e.g. the owning document name. Optional. */
	sectionLabel?: string;
	/**
	 * Collapsed (icon-rail) rendering: entries draw icon-only (the entry's
	 * `icon`, or a first-letter glyph fallback) with the label as a tooltip,
	 * the section label hidden, and count badges shown as a compact overlay.
	 */
	collapsed?: boolean;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
	// Outer container padding around the item list.
	container: {
		padding: '2px 8px',
	} as CSSProperties,

	// Optional uppercase section header naming the owning document.
	sectionLabel: {
		padding: '16px 16px 6px',
		fontSize: 10.5,
		fontWeight: 700,
		textTransform: 'uppercase',
		letterSpacing: '0.14em',
		color: 'var(--rr-text-secondary)',
	} as CSSProperties,

	// Base row — active and hover treatments are layered on top.
	item: (active: boolean, hovered: boolean): CSSProperties => ({
		display: 'flex',
		alignItems: 'center',
		gap: 10,
		margin: '1px 0',
		padding: '7px 10px',
		borderRadius: 7,
		fontSize: 13,
		color: 'var(--rr-text-primary)',
		cursor: 'pointer',
		// Constant 1px border (transparent when inactive) so toggling the
		// active pill never changes row height — no sibling reflow on select.
		border: '1px solid transparent',
		// Active: brand-tinted fill + brand-tinted border + bolder label.
		...(active
			? {
					background: 'color-mix(in srgb, var(--rr-brand) 10%, transparent)',
					borderColor: 'color-mix(in srgb, var(--rr-brand) 55%, transparent)',
					fontWeight: 600,
			  }
			: null),
		// Hover (non-active only): quiet list-hover fill.
		...(!active && hovered ? { background: 'var(--rr-bg-list-hover)' } : null),
	}),

	// Label fills the row so the badge right-aligns to the trailing edge.
	label: {
		flex: 1,
	} as CSSProperties,

	// Leading icon slot on expanded rows (17px box matching the shell nav icons).
	itemIcon: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: 17,
		height: 17,
		flexShrink: 0,
		color: 'var(--rr-text-secondary)',
	} as CSSProperties,

	// Collapsed (icon-rail) row: square, centered icon target with the same
	// active-pill treatment; the badge overlays the top-right corner.
	itemCollapsed: (active: boolean, hovered: boolean): CSSProperties => ({
		position: 'relative',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: 36,
		height: 36,
		margin: '2px auto',
		borderRadius: 7,
		color: 'var(--rr-text-primary)',
		cursor: 'pointer',
		border: '1px solid transparent',
		...(active
			? {
					background: 'color-mix(in srgb, var(--rr-brand) 10%, transparent)',
					borderColor: 'color-mix(in srgb, var(--rr-brand) 55%, transparent)',
			  }
			: null),
		...(!active && hovered ? { background: 'var(--rr-bg-list-hover)' } : null),
	}),

	// First-letter fallback glyph for entries that declare no icon.
	letterGlyph: {
		fontSize: 13,
		fontWeight: 700,
		lineHeight: 1,
	} as CSSProperties,

	// Compact badge overlay anchored to the icon's top-right corner.
	badgeOverlay: {
		position: 'absolute',
		top: -4,
		right: -4,
		transform: 'scale(0.85)',
		transformOrigin: 'top right',
	} as CSSProperties,
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Renders a ViewMenu as a vertical sidebar list.
 *
 * @param props - {@link ISidebarViewMenuProps}.
 * @returns The sidebar menu element.
 */
export function SidebarViewMenu({ menu, activeId, onSelect, sectionLabel, collapsed }: ISidebarViewMenuProps): React.ReactElement {
	// Track the hovered entry so a non-active row can show the hover fill.
	const [hoveredId, setHoveredId] = useState<string | null>(null);

	return (
		<div style={styles.container}>
			{/* Optional section header naming the owning document (expanded only). */}
			{!collapsed && sectionLabel && <div style={styles.sectionLabel}>{sectionLabel}</div>}
			{menu.entries.map((entry) => {
				// Resolve per-row state for the composed style.
				const isActive = entry.id === activeId;
				const isHovered = entry.id === hoveredId;

				// Collapsed icon rail: icon-only square with tooltip + badge overlay.
				if (collapsed) {
					return (
						<div
							key={entry.id}
							title={entry.label}
							style={styles.itemCollapsed(isActive, isHovered)}
							onClick={() => onSelect(entry.id)}
							onMouseEnter={() => setHoveredId(entry.id)}
							onMouseLeave={() => setHoveredId(null)}
						>
							{/* Declared icon, or a first-letter glyph fallback. */}
							{entry.icon ?? <span style={styles.letterGlyph}>{entry.label.charAt(0).toUpperCase()}</span>}
							{entry.count != null && (
								<span style={styles.badgeOverlay}>
									<ViewMenuBadge count={entry.count} severity={entry.severity} />
								</span>
							)}
						</div>
					);
				}

				return (
					<div
						key={entry.id}
						style={styles.item(isActive, isHovered)}
						onClick={() => onSelect(entry.id)}
						onMouseEnter={() => setHoveredId(entry.id)}
						onMouseLeave={() => setHoveredId(null)}
					>
						{/* Optional leading icon — same glyph the collapsed rail shows. */}
						{entry.icon && <span style={styles.itemIcon}>{entry.icon}</span>}
						<span style={styles.label}>{entry.label}</span>
						{/* Right-aligned count badge when the entry declares a count. */}
						{entry.count != null && <ViewMenuBadge count={entry.count} severity={entry.severity} />}
					</div>
				);
			})}
		</div>
	);
}
