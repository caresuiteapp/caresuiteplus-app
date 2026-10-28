import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { ConnectIntegrationDetailScreen } from "../../../../src/screens/connect/ConnectIntegrationDetailScreen.native.tsx";
function ConnectIntegrationDetailRoute() {
    return <ConnectIntegrationDetailScreen />;
}
export default withNativeWorkflowPage(ConnectIntegrationDetailRoute);
