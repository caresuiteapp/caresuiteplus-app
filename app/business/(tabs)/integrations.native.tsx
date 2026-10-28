import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { IntegrationsListScreen } from "../../../src/screens/integrations/IntegrationsListScreen.native.tsx";
function IntegrationsRoute() {
    return <IntegrationsListScreen />;
}
export default withNativeWorkflowPage(IntegrationsRoute);
