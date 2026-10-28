import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { OfficeModuleAssignmentListScreen } from "../../src/screens/business/office/OfficeModuleAssignmentListScreen.native.tsx";
function Route() {
    return <OfficeModuleAssignmentListScreen section="billing"/>;
}
export default withNativeWorkflowPage(Route);
