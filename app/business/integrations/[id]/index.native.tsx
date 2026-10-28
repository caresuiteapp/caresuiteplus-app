import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { IntegrationDetailScreen } from "../../../../src/screens/integrations/IntegrationDetailScreen.native.tsx";
function IntegrationDetailRoute() {
    return <IntegrationDetailScreen />;
}
export default withNativeWorkflowPage(IntegrationDetailRoute);
