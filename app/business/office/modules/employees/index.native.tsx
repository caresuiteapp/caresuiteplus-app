import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { OfficeModuleAssignmentListScreen } from "../../../../../src/screens/business/office/OfficeModuleAssignmentListScreen.native.tsx";
function ModuleEmployeesRoute() {
    return <OfficeModuleAssignmentListScreen section="employees"/>;
}
export default withNativeWorkflowPage(ModuleEmployeesRoute);
