import { RequirePermission } from '@/components/permissions';
import { EmployeeCreateScreen } from '@/screens/office/EmployeeCreateScreen';

export default function EmployeeCreateRoute() {
  return (
    <RequirePermission permission="office.employees.create">
      <EmployeeCreateScreen />
    </RequirePermission>
  );
}
