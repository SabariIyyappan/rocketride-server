// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

/**
 * TabPanelContent — the panel stack of a {@link TabPanel} WITHOUT its pill bar.
 *
 * When a host renders a view's menu elsewhere (the vscode bottom tray or the
 * shell-ui ContentViewMenu) the view no longer draws its own {@link TabPanel}
 * pill bar — but it still needs to render exactly the same panel stack. This
 * component renders that stack alone: every panel is mounted (so state such as
 * a canvas's viewport survives switches) and all but the active one are hidden
 * with `display: none`, identical to {@link TabPanel}'s panel region.
 */

import React, { CSSProperties } from 'react';
import type { ITabPanelPanel } from './TabPanel';

// =============================================================================
// STYLES
// =============================================================================
//
// These MUST match TabPanel's `wrapper` and `panel` styles so a host-rendered
// view's content is pixel-identical to the fallback path.
// =============================================================================

const styles = {
	// Full-size relative wrapper — the same box TabPanel uses behind its bar.
	wrapper: {
		position: 'relative',
		width: '100%',
		height: '100%',
	} as CSSProperties,
	// One panel: fills the wrapper and scrolls its own content.
	panel: {
		width: '100%',
		height: '100%',
		overflow: 'auto',
		scrollbarWidth: 'thin',
		scrollbarColor: 'var(--rr-scrollbar-thumb, rgba(128,128,128,0.3)) transparent',
	} as CSSProperties,
};

// =============================================================================
// TYPES
// =============================================================================

/** Props for the {@link TabPanelContent} component. */
export interface ITabPanelContentProps {
	/** Map of panel id → { content }. Every panel is mounted; inactive ones hide. */
	panels: Record<string, ITabPanelPanel>;
	/** Id of the panel to show (all others are hidden with `display: none`). */
	activeId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Renders the panel stack (no pill bar) with the active panel visible.
 *
 * @param props - {@link ITabPanelContentProps}.
 * @returns The panel-stack element.
 */
export function TabPanelContent({ panels, activeId }: ITabPanelContentProps): React.ReactElement {
	return (
		<div style={styles.wrapper}>
			{Object.entries(panels).map(([id, panel]) => (
				<div key={id} style={{ ...styles.panel, display: id === activeId ? undefined : 'none' }}>
					{panel.content}
				</div>
			))}
		</div>
	);
}
