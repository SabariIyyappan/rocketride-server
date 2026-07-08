// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

import React from 'react';
import { Account } from './Account';
import { WebviewViewMenuHost } from '../WebviewViewMenuHost';
import { mountComponent } from '../../../shared/util/mount';

/** Account webview wrapped so its ViewMenu renders as the vscode bottom tray. */
const HostedAccount: React.FC = () => (
	<WebviewViewMenuHost>
		<Account />
	</WebviewViewMenuHost>
);

mountComponent(HostedAccount, 'Account');
export default Account;
