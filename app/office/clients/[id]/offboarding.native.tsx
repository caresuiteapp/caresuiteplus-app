import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { ClientCareContinuityScreen } from "../../../../src/screens/office/ClientCareContinuityScreen.native.tsx";
function ClientCareContinuityRoute() {
    return <ClientCareContinuityScreen />;
}
export default withNativeWorkflowPage(ClientCareContinuityRoute);
