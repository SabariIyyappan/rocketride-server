// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

// Make sure react is setup prior to loading shared-ui components
import './setup.react';

import React from 'react';
import { Project } from './Project';
import { WebviewViewMenuHost } from '../WebviewViewMenuHost';
import { mountComponent } from '../../../shared/util/mount';

/** Project webview wrapped so its ViewMenu renders as the vscode bottom tray. */
const HostedProject: React.FC = () => (
	<WebviewViewMenuHost>
		<Project />
	</WebviewViewMenuHost>
);

mountComponent(HostedProject, 'PageProject');
export default Project;
