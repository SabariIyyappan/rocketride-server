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
// Displays saved profiler-server connections as a grid of ConnectionCards with
// a left-aligned ContentHeader and a "+ New Connection" secondary action. Each
// card shows name, host:port, and a StatusBadge; hovering reveals edit/delete.
// Clicking a card opens a profiler tab for that server. A dashed
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
import { useSavedConnections, addConnection, updateConnection, deleteConnection } from '../connections';
import type { SavedConnection } from '../connections';
import { getDocs } from '../docs';

// =============================================================================
// TYPES
// =============================================================================

/** Form state for the add/edit dialog. */
interface FormState {
	/** 'add' for new connection, or the connection id for editing. */
	mode: 'add' | string;
	/** Connection display name. */
	name: string;
	/** Server hostname or IP. */
	host: string;
	/** Server port. */
	port: string;
}

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
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Connection manager landing page for the Profiler app (Archetype C).
 *
 * Lists saved connections as ConnectionCards in a responsive grid and provides
 * add/edit/delete through a short-form modal. Clicking a card opens a profiler
 * tab for that server. Cards show the neutral "Disconnected" state (the landing
 * does not track which servers currently have an open profiling tab).
 */
const ConnectionManagerView: React.FC = () => {
	const connections = useSavedConnections();
	const [form, setForm] = useState<FormState | null>(null);

	// =========================================================================
	// HANDLERS
	// =========================================================================

	/** Open a connection in a new document tab. */
	const handleConnect = useCallback((conn: SavedConnection) => {
		getDocs()?.openStaticDocument(`conn:${conn.id}`, conn.name, { host: conn.host, port: conn.port });
	}, []);

	/** Open the add form with default values. */
	const handleAdd = useCallback(() => {
		setForm({ mode: 'add', name: '', host: 'localhost', port: '5565' });
	}, []);

	/** Open the edit form for an existing connection. */
	const handleEdit = useCallback((conn: SavedConnection) => {
		setForm({ mode: conn.id, name: conn.name, host: conn.host, port: conn.port });
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

		if (form.mode === 'add') {
			// Add new connection and immediately open it in a tab.
			const id = addConnection({ name: form.name.trim(), host: form.host.trim(), port: form.port.trim() });
			getDocs()?.openStaticDocument(`conn:${id}`, form.name.trim(), { host: form.host.trim(), port: form.port.trim() });
		} else {
			// Update existing connection.
			updateConnection(form.mode, { name: form.name.trim(), host: form.host.trim(), port: form.port.trim() });
		}
		setForm(null);
	}, [form]);

	/** Close the form without saving. */
	const handleCancel = useCallback(() => {
		setForm(null);
	}, []);

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
				title="Profiler Connections"
				subtitle="Attach to a server to profile its process and pipeline engines."
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
						description="Attach to a server to profile its process and pipeline engines."
						action={<Button variant="secondary" onClick={handleAdd}>+ New Connection</Button>}
					/>
				) : (
					<div style={styles.grid}>
						{connections.map((conn) => (
							<ConnectionCard
								key={conn.id}
								icon={<BxDesktop size={30} />}
								name={conn.name}
								address={`${conn.host}:${conn.port}`}
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
							{form.mode === 'add' ? 'New Connection' : 'Edit Connection'}
						</div>

						<div style={commonStyles.modalBody}>
							{/* Name */}
							<div style={styles.formField}>
								<label style={styles.formLabel}>Name</label>
								<InputField
									value={form.name}
									onChange={(e) => setForm({ ...form, name: e.target.value })}
									onKeyDown={handleKeyDown}
									placeholder="e.g. Local Dev Server"
									autoFocus
								/>
							</div>

							{/* Host */}
							<div style={{ ...styles.formField, marginTop: 12 }}>
								<label style={styles.formLabel}>Host</label>
								<InputField
									value={form.host}
									onChange={(e) => setForm({ ...form, host: e.target.value })}
									onKeyDown={handleKeyDown}
									placeholder="localhost"
								/>
							</div>

							{/* Port */}
							<div style={{ ...styles.formField, marginTop: 12 }}>
								<label style={styles.formLabel}>Port</label>
								<InputField
									value={form.port}
									onChange={(e) => setForm({ ...form, port: e.target.value })}
									onKeyDown={handleKeyDown}
									placeholder="5565"
								/>
							</div>
						</div>

						<div style={commonStyles.modalFooter}>
							<Button variant="ghost" onClick={handleCancel}>Cancel</Button>
							<Button variant="primary" onClick={handleSave}>
								{form.mode === 'add' ? 'Connect' : 'Save'}
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default ConnectionManagerView;
