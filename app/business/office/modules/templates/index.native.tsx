import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { OfficeModuleAssignmentListScreen } from "../../../../../src/screens/business/office/OfficeModuleAssignmentListScreen.native.tsx";
function TemplateModuleAssignmentsPage() {
    return <OfficeModuleAssignmentListScreen section="templates"/>;
}
export default withNativeWorkflowPage(TemplateModuleAssignmentsPage);
