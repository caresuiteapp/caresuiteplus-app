import { EmployeePortalClientRecordsScreen } from '@/components/portal/EmployeePortalClientRecordsScreen';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function EmployeeClientRecordsRoute() {
  return (
    <PortalTabScreen title="Klientenakten" subtitle="Lesender Zugriff auf zugeordnete Klient:innen" hideHeaderOnPhone scroll={false}>
      <EmployeePortalClientRecordsScreen />
    </PortalTabScreen>
  );
}
