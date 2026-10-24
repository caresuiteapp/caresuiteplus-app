import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { PortalClientDocumentDetailScreen } from "../../../../../src/screens/portal/PortalClientDocumentDetailScreen.native.tsx";
function ClientDocumentDetailRoute() {
    return <PortalClientDocumentDetailScreen />;
}
export default withNativeWorkflowPage(ClientDocumentDetailRoute);
