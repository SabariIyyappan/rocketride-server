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
// VIEWMENU TYPES — one declaration, two renderers
// =============================================================================
//
// A complex view with sub-views declares a single ViewMenu; the host renders it
// with one of two stock renderers — the SidebarViewMenu (vertical list in the
// sidebar slot) or the ContentViewMenu (bottom tray). Views NEVER draw their own
// tab bars; they declare a ViewMenu and let the host place it.
//
// In tabbed (document) apps the host swaps the active menu whenever the active
// DocTab changes; in non-tabbed apps the single main content window drives it.
// The vscode host has no shell sidebar, so it always renders the bottom tray.
// =============================================================================

// =============================================================================
// ENTRY
// =============================================================================

import type { ReactNode } from 'react';

/** One selectable entry in a view's sub-view menu. */
export interface ViewMenuEntry {
	/** Stable identifier for the entry; passed back through `onSelect`. */
	id: string;
	/** Human-readable label shown in both renderers. */
	label: string;
	/** Neutral count badge, e.g. Tokens 48. */
	count?: number;
	/** 'error' renders the count badge in --rr-color-error. */
	severity?: 'error';
	/**
	 * Optional icon shown when the sidebar renderer is collapsed to its icon
	 * rail (design-owner decision: collapsed sidebars show icon-only entries).
	 * Entries without an icon fall back to a first-letter glyph.
	 */
	icon?: ReactNode;
}

// =============================================================================
// MENU
// =============================================================================

/** Declared once per complex view; the host renders it. Views never draw their own tabs. */
export interface ViewMenu {
	/** Ordered list of selectable sub-view entries. */
	entries: ViewMenuEntry[];
	/** Where the menu renders in shell-ui. vscode always uses 'bottom'. Default: 'bottom'. */
	placement?: 'bottom' | 'sidebar';
}
