import { EmployeeHrCasesScreen } from '@/screens/office/EmployeeHrCasesScreen';
import { RequirePermission } from '@/components/permissions';

export default function EmployeeHrCasesRoute() {
  return (
    <RequirePermission permission="office.employees.hr.view">
      <EmployeeHrCasesScreen />
    </RequirePermission>
  );
}
