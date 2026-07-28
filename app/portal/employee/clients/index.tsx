import { EmployeePortalClientRecordsScreen } from '@/product-workflows/components/portal/EmployeePortalClientRecordsScreen';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeeClientRecordsRoute() {
  return (
    <PortalTabScreen title="Klientenakten" subtitle="Lesender Zugriff auf zugeordnete Klient:innen" hideHeaderOnPhone scroll={false}>
      <EmployeePortalClientRecordsScreen />
    </PortalTabScreen>
  );
}
