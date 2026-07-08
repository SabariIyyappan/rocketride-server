// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

/**
 * OverlayViewMenuHost — ViewMenu host for the shell's overlay dialogs.
 *
 * The shell's Account/Settings/Environment overlays render OUTSIDE the client
 * area's ViewMenuHostProvider, so shared views inside them (AccountView, …)
 * previously fell back to the legacy absolutely-positioned TabPanel pill bar —
 * which, after the tabContent gutter standardization, overlapped the panel
 * content. This wrapper gives overlays the same host treatment as the client
 * area and the vscode webviews (design-owner decision: the tray applies
 * everywhere a view has sub-views): it mounts a {@link ViewMenuHostProvider}
 * around the overlay page, stacks the page above a {@link ContentViewMenu}
 * tray hugging the dialog's bottom edge, and renders whatever menu the page's
 * view publishes. A page that publishes nothing shows no tray — inert.
 */

import React from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { ViewMenuHostProvider, useViewMenuHostState, ContentViewMenu } from 'shared';

// =============================================================================
// STYLES
// =============================================================================

const styles = {
	// Fill the overlay dialog; stack the page above the tray.
	host: {
		display: 'flex',
		flexDirection: 'column',
		width: '100%',
		height: '100%',
		minHeight: 0,
	} as CSSProperties,

	// The page content — takes all space the tray does not.
	content: {
		display: 'flex',
		flexDirection: 'column',
		flex: 1,
		minWidth: 0,
		minHeight: 0,
		overflow: 'hidden',
	} as CSSProperties,
};

// =============================================================================
// TRAY SLOT
// =============================================================================

/**
 * Renders the currently published ViewMenu as the dialog's bottom tray, or
 * nothing when the hosted page publishes no menu. Lives inside the provider so
 * it reads the live publication.
 *
 * @returns The tray element, or null when nothing is published.
 */
const OverlayTraySlot: React.FC = () => {
	// The active publication from whichever view inside the overlay published.
	const publication = useViewMenuHostState();
	if (!publication) return null;
	return (
		<ContentViewMenu
			menu={publication.menu}
			activeId={publication.activeId}
			onSelect={publication.onSelect}
		/>
	);
};

// =============================================================================
// HOST
// =============================================================================

/** Props for {@link OverlayViewMenuHost}. */
export interface OverlayViewMenuHostProps {
	/** The overlay page to host (AccountPage, SettingsPage, EnvironmentPage). */
	children: ReactNode;
}

/**
 * Hosts an overlay page with ViewMenu support: provider + content + bottom tray.
 *
 * @param props - {@link OverlayViewMenuHostProps}.
 * @returns The wrapped overlay page.
 */
export const OverlayViewMenuHost: React.FC<OverlayViewMenuHostProps> = ({ children }) => (
	<ViewMenuHostProvider>
		<div style={styles.host}>
			<div style={styles.content}>{children}</div>
			<OverlayTraySlot />
		</div>
	</ViewMenuHostProvider>
);
