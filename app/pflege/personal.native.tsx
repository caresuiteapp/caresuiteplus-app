import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { EmployeesListScreen } from "../../src/screens/office/EmployeesListScreen.native.tsx";
function PflegeStaffRoute() {
    return (<EmployeesListScreen moduleLabel="Pflege" contextLabel="Pflegepersonal mit vollständiger Personalakte"/>);
}
export default withNativeWorkflowPage(PflegeStaffRoute);
