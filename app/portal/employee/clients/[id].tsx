import { ScreenShell } from '@/components/layout';
import { EmployeePortalClientRecordDetailScreen } from '@/components/portal/EmployeePortalClientRecordDetailScreen';

export default function EmployeeClientRecordDetailRoute() {
  return (
    <ScreenShell title="Klientenakte" showBack>
      <EmployeePortalClientRecordDetailScreen />
    </ScreenShell>
  );
}
