import React from 'react';
import {PlatformTenantDetailScreen} from '../../src/screens/platformConsole/PlatformTenantDetailScreen.native';
import {PlatformConsoleWorkspace} from '../../src/screens/platformConsole/PlatformConsoleWorkspace.native';
import {GlobalWorkflowFeedbackProvider} from '../../src/components/ui/GlobalWorkflowFeedback';
/** Real native owner screens; the layout runner supplies only inert fixture services. */
export function PlatformConsolePreview({screen}){
 return <GlobalWorkflowFeedbackProvider>{screen.startsWith('owner-tenant')?<PlatformTenantDetailScreen/>:<PlatformConsoleWorkspace section="dashboard"/>}</GlobalWorkflowFeedbackProvider>;
}
