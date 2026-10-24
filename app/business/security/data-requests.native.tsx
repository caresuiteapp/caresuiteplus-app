import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { DataSubjectRequestsAdminScreen } from "../../../src/screens/security/DataSubjectRequestsAdminScreen.native.tsx";
function DataSubjectRequestsAdminRoute() {
    return <DataSubjectRequestsAdminScreen />;
}
export default withNativeWorkflowPage(DataSubjectRequestsAdminRoute);
