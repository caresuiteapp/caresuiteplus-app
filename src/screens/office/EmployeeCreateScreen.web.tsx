import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmployeeCreateForm } from '@/components/office/employeecreateform.web';
import { useWebBackNavigation } from '@/hooks/useWebBackNavigation.web';
export function EmployeeCreateScreen() {
  const router = useRouter();
  const back = useWebBackNavigation('/business/office/employees');
  return <ScreenShell title="Mitarbeitende anlegen" subtitle="Personal · Neue Akte" scroll={false}><EmployeeCreateForm onCancel={back} onCreated={id => router.replace(`/business/office/employees/${id}/personnel` as never)} /></ScreenShell>;
}
