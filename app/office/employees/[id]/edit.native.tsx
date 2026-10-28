import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { EmployeeEditScreen } from "../../../../src/screens/office/EmployeeEditScreen.native.tsx";
function EmployeeEditRoute() {
    return <EmployeeEditScreen />;
}
export default withNativeWorkflowPage(EmployeeEditRoute);
