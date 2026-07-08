// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

/**
 * Card — the platform's stock bordered content group.
 *
 * A paper surface with a 1px border and rounded corners, an optional header row
 * (title + right-aligned actions) separated from the body by a divider, and a
 * padded body. Set `noBodyPadding` for content that fills the card edge-to-edge
 * (e.g. a DataTable).
 *
 * Built on `commonStyles.card` / `cardBody`; the header treatment is composed on
 * top of `commonStyles.cardHeader` and overridden to the mockup spec (transparent
 * bar, bottom divider, 13.5/700 title) — see the note in the styles block.
 */

import React, { CSSProperties, ReactNode } from 'react';
import { commonStyles } from '../../themes/styles';

// =============================================================================
// TYPES
// =============================================================================

/** Props for the {@link Card} component. */
export interface ICardProps {
	/** Header content — a plain string title or a custom node. */
	header?: ReactNode;
	/** Right side of the header row (actions / controls). */
	headerActions?: ReactNode;
	/** Card body content. */
	children: ReactNode;
	/** Drop the body padding (for tables and media that fill the card). */
	noBodyPadding?: boolean;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
	// Header — composes commonStyles.cardHeader, then overrides the divergent
	// properties so the rendered result matches the mockup: no title-bar fill,
	// a bottom divider, and a 13.5px/700 title (commonStyles ships a filled bar
	// and 13/600, which the mockup does not use).
	header: {
		...commonStyles.cardHeader,
		justifyContent: 'flex-start',
		background: 'transparent',
		borderBottom: '1px solid var(--rr-border)',
		fontSize: 13.5,
		fontWeight: 700,
	} as CSSProperties,

	// Push header actions to the right edge of the header row.
	headerActions: {
		marginLeft: 'auto',
	} as CSSProperties,

	// Body with padding removed (fills the card).
	bodyNoPad: {
		padding: 0,
	} as CSSProperties,
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Renders a bordered card with an optional header and a padded body.
 *
 * @param props - {@link ICardProps}.
 * @returns The card element.
 */
export function Card({ header, headerActions, children, noBodyPadding }: ICardProps): React.ReactElement {
	// Only render the header row when there is a title or actions to show.
	const showHeader = header != null || headerActions != null;
	return (
		<div style={commonStyles.card}>
			{showHeader && (
				<div style={styles.header}>
					{header}
					{headerActions && <div style={styles.headerActions}>{headerActions}</div>}
				</div>
			)}
			<div style={noBodyPadding ? styles.bodyNoPad : commonStyles.cardBody}>{children}</div>
		</div>
	);
}
