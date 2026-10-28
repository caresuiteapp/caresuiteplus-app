import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { OfficeModuleAssignmentListScreen } from "../../../../../src/screens/business/office/OfficeModuleAssignmentListScreen.native.tsx";
function DocumentModuleAssignmentsPage() {
    return <OfficeModuleAssignmentListScreen section="documents"/>;
}
export default withNativeWorkflowPage(DocumentModuleAssignmentsPage);
