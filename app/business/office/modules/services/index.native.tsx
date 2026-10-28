import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { OfficeModuleAssignmentListScreen } from "../../../../../src/screens/business/office/OfficeModuleAssignmentListScreen.native.tsx";
function ModuleServicesRoute() {
    return <OfficeModuleAssignmentListScreen section="services"/>;
}
export default withNativeWorkflowPage(ModuleServicesRoute);
