import { EmployeeHrCasesScreen } from '@/product-workflows/screens/office/EmployeeHrCasesScreen';
import { RequirePermission } from '@/product-workflows/components/permissions';

export default function EmployeeHrCasesRoute() {
  return (
    <RequirePermission permission="office.employees.hr.view">
      <EmployeeHrCasesScreen />
    </RequirePermission>
  );
}
