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
// CONNECTION MANAGER VIEW — Archetype C landing page
// =============================================================================
//
// Displays saved test-server connections as a grid of ConnectionCards with a
// left-aligned ContentHeader and a "+ New Connection" secondary action. Each
// card shows name, address, and a StatusBadge; hovering reveals edit/delete.
// Clicking a card opens the connection as a test-session tab. A dashed
// ConnectionCardAdd tile terminates the grid. Add/edit uses a short-form modal.
// Aligned to the models-ui ConnectionManagerView pattern.
// =============================================================================

import React, { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { commonStyles } from 'shared/themes/styles';
import {
	Button,
	ConnectionCard,
	ConnectionCardAdd,
	ContentHeader,
	EmptyState,
	InputField,
} from 'shared';
import { BxDesktop } from 'shell-ui';
import {
	useSavedConnections, addConnection, updateConnection, deleteConnection,
	type SavedConnection,
} from '../connections';
import { getDocs } from '../docs';
import { openConnection } from '../TestApp';
import { DEFAULT_CONFIG } from '../session';

// =============================================================================
// TYPES
// =============================================================================

/** Inline form state — mode discriminates add vs edit (edit carries the id). */
interface FormState {
	mode: { type: 'add' } | { type: 'edit'; id: string };
	name: string;
	url: string;
	apiKey: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** All load-test phases seeded onto a newly-created connection. */
const ALL_PHASES = ['sweep', 'stress', 'flood', 'pipe', 'chaos', 'hammer'];

// =============================================================================
// STYLES
// =============================================================================

const styles = {
	// Column-filling root: header pinned, content scrolls.
	root: {
		...commonStyles.columnFill,
	} as CSSProperties,

	// Content region beneath the ContentHeader (style-guide page grammar:
	// 20px below the header, 24px on the remaining sides).
	content: {
		flex: 1,
		minHeight: 0,
		overflowY: 'auto',
		padding: '20px 24px 24px',
	} as CSSProperties,

	// Connection card grid — auto-fill, 230px minimum, 16px gaps.
	grid: {
		display: 'grid',
		gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
		gap: 16,
	} as CSSProperties,

	// =========================================================================
	// FORM MODAL (short form — stays a modal per the style guide)
	// =========================================================================

	formField: {
		display: 'flex',
		flexDirection: 'column',
		gap: 4,
	} as CSSProperties,

	formLabel: {
		fontSize: 12,
		color: 'var(--rr-text-secondary)',
		fontWeight: 500,
	} as CSSProperties,

	// API-key row: input + reveal toggle.
	apiKeyRow: {
		display: 'flex',
		gap: 6,
		alignItems: 'stretch',
	} as CSSProperties,

	// API-key input flexes to fill the row beside the reveal toggle.
	apiKeyInput: {
		flex: 1,
	} as CSSProperties,
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Connection manager landing page (Archetype C).
 *
 * Lists saved test-server connections as ConnectionCards in a responsive grid
 * and provides add/edit/delete through a short-form modal. Clicking a card
 * opens the connection as a test-session tab. This view only renders while no
 * session tabs are open, so cards always show the neutral "Disconnected"
 * state.
 */
const ConnectionManagerView: React.FC = () => {
	const connections = useSavedConnections();
	const [form, setForm] = useState<FormState | null>(null);
	const [showApiKey, setShowApiKey] = useState(false);

	// =========================================================================
	// HANDLERS
	// =========================================================================

	/** Open a saved connection as a test-session tab. */
	const handleConnect = useCallback((conn: SavedConnection) => {
		const docs = getDocs();
		if (docs) openConnection(docs, conn);
	}, []);

	/** Open the add form (seeded with the OSS server default). */
	const handleAdd = useCallback(() => {
		setForm({ mode: { type: 'add' }, name: '', url: 'localhost:5565', apiKey: '' });
		setShowApiKey(false);
	}, []);

	/** Open the edit form for an existing connection. */
	const handleEdit = useCallback((conn: SavedConnection) => {
		setForm({ mode: { type: 'edit', id: conn.id }, name: conn.name, url: conn.url, apiKey: conn.apiKey || '' });
		setShowApiKey(false);
	}, []);

	/** Delete a connection with confirmation. */
	const handleDelete = useCallback((conn: SavedConnection) => {
		if (confirm(`Delete connection "${conn.name}"?`)) {
			deleteConnection(conn.id);
		}
	}, []);

	/** Save the form (add or update). */
	const handleSave = useCallback(() => {
		if (!form || !form.name.trim()) return;
		const docs = getDocs();

		if (form.mode.type === 'add') {
			// Build the connection once — addConnection() assigns the id, then the
			// same object (plus id) is what gets opened as a session tab.
			const newConn: Omit<SavedConnection, 'id'> = {
				name: form.name.trim(),
				url: form.url.trim(),
				apiKey: form.apiKey.trim(),
				config: { ...DEFAULT_CONFIG },
				selectedPhases: [...ALL_PHASES],
			};
			const id = addConnection(newConn);
			if (docs) openConnection(docs, { ...newConn, id });
		} else {
			updateConnection(form.mode.id, {
				name: form.name.trim(),
				url: form.url.trim(),
				apiKey: form.apiKey.trim(),
			});
		}
		setForm(null);
	}, [form]);

	/** Close the form without saving. */
	const handleCancel = useCallback(() => setForm(null), []);

	/** Submit on Enter, cancel on Escape while a field is focused. */
	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key === 'Enter') handleSave();
		if (e.key === 'Escape') handleCancel();
	}, [handleSave, handleCancel]);

	// =========================================================================
	// RENDER
	// =========================================================================

	return (
		<div style={styles.root}>
			<ContentHeader
				title="Test Server Connections"
				subtitle="Attach to a test server to run load and stress scenarios."
				actions={
					<Button variant="secondary" onClick={handleAdd}>+ New Connection</Button>
				}
			/>

			<div style={styles.content}>
				{connections.length === 0 ? (
					// Empty state — no saved connections yet.
					<EmptyState
						icon={<BxDesktop size={40} />}
						title="No connections yet"
						description="Attach to a test server to run load and stress scenarios against it."
						action={<Button variant="secondary" onClick={handleAdd}>+ New Connection</Button>}
					/>
				) : (
					<div style={styles.grid}>
						{connections.map((conn) => (
							<ConnectionCard
								key={conn.id}
								icon={<BxDesktop size={30} />}
								name={conn.name}
								address={conn.url}
								status="muted"
								statusLabel="Disconnected"
								onEdit={() => handleEdit(conn)}
								onDelete={() => handleDelete(conn)}
								onClick={() => handleConnect(conn)}
							/>
						))}
						{/* Dashed "add a connection" tile terminates the grid. */}
						<ConnectionCardAdd label="New Connection" onClick={handleAdd} />
					</div>
				)}
			</div>

			{/* ── Add / Edit form modal (short form) ────────────────────────── */}
			{form && (
				<div style={commonStyles.modalOverlay} onClick={handleCancel}>
					<div style={commonStyles.modalDialog} onClick={(e) => e.stopPropagation()}>
						<div style={commonStyles.modalHeader}>
							{form.mode.type === 'add' ? 'New Connection' : 'Edit Connection'}
						</div>

						<div style={commonStyles.modalBody}>
							{/* Name */}
							<div style={styles.formField}>
								<label style={styles.formLabel}>Name</label>
								<InputField
									value={form.name}
									onChange={(e) => setForm({ ...form, name: e.target.value })}
									onKeyDown={handleKeyDown}
									placeholder="e.g. Local OSS Server"
									autoFocus
								/>
							</div>

							{/* URL */}
							<div style={{ ...styles.formField, marginTop: 12 }}>
								<label style={styles.formLabel}>URL</label>
								<InputField
									value={form.url}
									onChange={(e) => setForm({ ...form, url: e.target.value })}
									onKeyDown={handleKeyDown}
									placeholder="localhost:5565"
								/>
							</div>

							{/* API Key */}
							<div style={{ ...styles.formField, marginTop: 12 }}>
								<label style={styles.formLabel}>API Key</label>
								<div style={styles.apiKeyRow}>
									<InputField
										style={styles.apiKeyInput}
										type={showApiKey ? 'text' : 'password'}
										value={form.apiKey}
										onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
										onKeyDown={handleKeyDown}
										placeholder="Optional"
									/>
									<Button variant="ghost" onClick={() => setShowApiKey(!showApiKey)}>
										{showApiKey ? 'Hide' : 'Show'}
									</Button>
								</div>
							</div>
						</div>

						<div style={commonStyles.modalFooter}>
							<Button variant="ghost" onClick={handleCancel}>Cancel</Button>
							<Button variant="primary" onClick={handleSave}>
								{form.mode.type === 'add' ? 'Connect' : 'Save'}
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default ConnectionManagerView;
