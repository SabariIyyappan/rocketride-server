// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

import React from 'react';
import { Monitor } from './Monitor';
import { WebviewViewMenuHost } from '../WebviewViewMenuHost';
import { mountComponent } from '../../../shared/util/mount';

/** Monitor webview wrapped so its ViewMenu renders as the vscode bottom tray. */
const HostedMonitor: React.FC = () => (
	<WebviewViewMenuHost>
		<Monitor />
	</WebviewViewMenuHost>
);

mountComponent(HostedMonitor, 'Monitor');
export default Monitor;
