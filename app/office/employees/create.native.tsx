import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { RequirePermission } from '@/product-workflows/components/permissions';
import { EmployeeCreateScreen } from "../../../src/screens/office/EmployeeCreateScreen.native.tsx";
function EmployeeCreateRoute() {
    return (<RequirePermission permission="office.employees.create">
      <EmployeeCreateScreen />
    </RequirePermission>);
}
export default withNativeWorkflowPage(EmployeeCreateRoute);
