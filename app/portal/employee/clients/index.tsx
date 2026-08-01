import { EmployeePortalClientRecordsScreen } from '@/product-workflows/components/portal/EmployeePortalClientRecordsScreen';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeeClientRecordsRoute() {
  return (
    <PortalTabScreen title="Klientenakten" subtitle="Mandantenweiter Lesezugriff auf alle Klient:innen" hideHeaderOnPhone scroll={false}>
      <EmployeePortalClientRecordsScreen />
    </PortalTabScreen>
  );
}
