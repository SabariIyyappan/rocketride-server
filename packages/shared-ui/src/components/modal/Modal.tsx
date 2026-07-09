// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

/**
 * Modal — the platform's stock dialog: a centered box over a dimmed backdrop.
 *
 * One component for every modal dialog so they never drift apart again. It owns
 * the backdrop, the box, the header (title + optional close), an optional body
 * padding, and an optional footer action row — all from `commonStyles.modal*`.
 *
 * Dismissal policy (design-owner decision 2026-07-08, refined):
 *  - The backdrop is INERT: clicking outside the box never closes it.
 *  - Escape closes it (unless `closeOnEscape={false}`).
 *  - The top-right ✕ appears ONLY when the dialog has no other explicit dismiss
 *    control. The default is therefore "show ✕ only when there is no footer"
 *    (a footer almost always carries a Cancel/Close/Done button). A dialog that
 *    auto-dismisses on a timer, or whose footer already closes it, passes
 *    `showClose={false}`; a footerless dialog gets the ✕ automatically so it is
 *    never left un-closable.
 *
 * The single canonical close glyph ({@link CLOSE_GLYPH}) is used everywhere, so
 * the old `×` / `✕` / `&times;` drift disappears.
 */

import React, { CSSProperties, ReactNode, useEffect } from 'react';
import { commonStyles } from '../../themes/styles';

// =============================================================================
// CONSTANTS
// =============================================================================

/** The one canonical close glyph (U+2715 MULTIPLICATION X) used by every dialog. */
export const CLOSE_GLYPH = '✕';

// =============================================================================
// TYPES
// =============================================================================

/** Props for the {@link Modal} component. */
export interface IModalProps {
	/** Header title — a plain string or a custom node. */
	title: ReactNode;
	/** Fired when the dialog is dismissed (✕ or Escape). */
	onClose: () => void;
	/** Body content. */
	children: ReactNode;
	/** Optional footer action row (Cancel / primary button, etc.). */
	footer?: ReactNode;
	/**
	 * Whether to render the top-right ✕. Defaults to "only when there is no
	 * footer" — a footer's Cancel/Close is the dismiss control, so a corner ✕
	 * would be redundant. Pass `false` for auto-dismissing dialogs; pass `true`
	 * to force the ✕ on a footered dialog that has no cancel affordance.
	 */
	showClose?: boolean;
	/** Whether Escape closes the dialog. Default true. */
	closeOnEscape?: boolean;
	/** Box width in px. Default 440 (commonStyles.modalDialog). */
	width?: number;
	/** Drop the body padding (for content that fills the box, e.g. a DataTable). */
	noBodyPadding?: boolean;
	/** Accessible label when `title` is not a plain string. */
	ariaLabel?: string;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
	// Borderless glyph close button, right-aligned in the header row. Matches the
	// account Modal idiom; the header's flex pushes it to the trailing edge.
	close: {
		marginLeft: 'auto',
		background: 'none',
		border: 'none',
		cursor: 'pointer',
		padding: 0,
		fontSize: 17,
		lineHeight: 1,
		fontFamily: 'var(--rr-font-family)',
		color: 'var(--rr-text-secondary)',
	} as CSSProperties,
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Renders a dialog box over a dimmed, inert backdrop.
 *
 * @param props - {@link IModalProps}.
 * @returns The modal element.
 */
export function Modal({
	title,
	onClose,
	children,
	footer,
	showClose,
	closeOnEscape = true,
	width,
	noBodyPadding,
	ariaLabel,
}: IModalProps): React.ReactElement {
	// Resolve the ✕: explicit prop wins; otherwise show it only when there is no
	// footer (a footer carries the dismiss control, making a corner ✕ redundant).
	const resolvedShowClose = showClose ?? footer == null;

	// Escape-to-close: register a window key handler while mounted.
	useEffect(() => {
		if (!closeOnEscape) return;
		/** Closes the dialog when Escape is pressed. */
		const handler = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [closeOnEscape, onClose]);

	return (
		// Backdrop is inert: no onClick — clicking outside must NOT close (policy).
		<div style={commonStyles.modalOverlay}>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={typeof title === 'string' ? title : ariaLabel}
				style={width != null ? { ...commonStyles.modalDialog, width } : commonStyles.modalDialog}
			>
				{/* Header: title on the left, optional ✕ pushed to the trailing edge. */}
				<div style={commonStyles.modalHeader}>
					{title}
					{resolvedShowClose && (
						<button type="button" style={styles.close} onClick={onClose} aria-label="Close">
							{CLOSE_GLYPH}
						</button>
					)}
				</div>
				{/* Body. */}
				<div style={noBodyPadding ? undefined : commonStyles.modalBody}>{children}</div>
				{/* Optional footer action row. */}
				{footer != null && <div style={commonStyles.modalFooter}>{footer}</div>}
			</div>
		</div>
	);
}
