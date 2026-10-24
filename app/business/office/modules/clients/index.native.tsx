import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { OfficeModuleAssignmentListScreen } from "../../../../../src/screens/business/office/OfficeModuleAssignmentListScreen.native.tsx";
function ModuleClientsRoute() {
    return <OfficeModuleAssignmentListScreen section="clients"/>;
}
export default withNativeWorkflowPage(ModuleClientsRoute);
