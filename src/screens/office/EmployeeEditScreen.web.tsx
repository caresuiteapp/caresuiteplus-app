import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmployeeEditForm } from '@/components/office/employeeeditform.web';
import { useWebBackNavigation } from '@/hooks/useWebBackNavigation.web';
export function EmployeeEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const back = useWebBackNavigation(id ? `/business/office/employees/${id}/personnel` : '/business/office/employees');
  return <ScreenShell title="Personalakte bearbeiten" subtitle="Personal · Angaben ändern" scroll={false}>{id ? <EmployeeEditForm employeeId={id} onCancel={back} onUpdated={back} /> : <div role="alert">Die Personalakte wurde nicht gefunden.</div>}</ScreenShell>;
}
