import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { OfficeDocumentationScreen } from "../../../src/screens/office/OfficeDocumentationScreen.native.tsx";
function EmployeeDocumentationRoute() {
    return <OfficeDocumentationScreen employeeView/>;
}
export default withNativeWorkflowPage(EmployeeDocumentationRoute);
