import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { OfficeModuleAssignmentListScreen } from "../../../../../src/screens/business/office/OfficeModuleAssignmentListScreen.native.tsx";
function ModulePermissionsRoute() {
    return <OfficeModuleAssignmentListScreen section="permissions"/>;
}
export default withNativeWorkflowPage(ModulePermissionsRoute);
