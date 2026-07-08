// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

/**
 * WebviewViewMenuHost — the vscode host that renders a view's ViewMenu as a
 * bottom tray.
 *
 * The vscode webview has no shell sidebar, so every view with sub-views renders
 * its ViewMenu as a {@link ContentViewMenu} tray snug along the bottom edge. This
 * wrapper mounts a {@link ViewMenuHostProvider} around the webview's view, lays
 * the view out above the tray (content takes the freed space; tray hugs the
 * bottom), and renders whatever menu the view publishes. A view that publishes
 * nothing shows no tray — the wrapper is inert.
 *
 * Wrap every webview root that hosts a view with sub-views (Project, Account,
 * Monitor, Environment, Settings) with this component.
 */

import React from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { ViewMenuHostProvider, useViewMenuHostState, ContentViewMenu } from 'shared';

// =============================================================================
// STYLES
// =============================================================================

const styles = {
	// Fill the webview root; stack the view above the tray.
	host: {
		display: 'flex',
		flexDirection: 'column',
		width: '100%',
		height: '100%',
	} as CSSProperties,
	// The view content — takes all space the tray does not.
	content: {
		display: 'flex',
		flexDirection: 'column',
		flex: 1,
		minWidth: 0,
		minHeight: 0,
	} as CSSProperties,
};

// =============================================================================
// TRAY SLOT
// =============================================================================

/**
 * Renders the currently published ViewMenu as the bottom tray, or nothing when
 * no view has published one. Lives inside the provider so it reads the live
 * publication.
 *
 * @returns The tray element, or null when there is no menu.
 */
const TraySlot: React.FC = () => {
	const pub = useViewMenuHostState();
	// vscode always renders the bottom tray; nothing to draw without a menu.
	if (!pub) return null;
	return <ContentViewMenu menu={pub.menu} activeId={pub.activeId} onSelect={pub.onSelect} />;
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Props for {@link WebviewViewMenuHost}.
 */
export interface IWebviewViewMenuHostProps {
	/** The webview's view (a bridge that renders a shared/owned view). */
	children: ReactNode;
}

/**
 * Hosts a webview view and renders its published ViewMenu as a bottom tray.
 *
 * @param props - {@link IWebviewViewMenuHostProps}.
 * @returns The hosted layout element.
 */
export const WebviewViewMenuHost: React.FC<IWebviewViewMenuHostProps> = ({ children }) => {
	return (
		<ViewMenuHostProvider>
			<div style={styles.host}>
				{/* View content fills the space above the tray. */}
				<div style={styles.content}>{children}</div>
				{/* ContentViewMenu tray hugs the bottom edge of the webview. */}
				<TraySlot />
			</div>
		</ViewMenuHostProvider>
	);
};
