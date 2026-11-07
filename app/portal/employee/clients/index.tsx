import { EmployeePortalClientRecordsScreen } from '@/product-workflows/components/portal/EmployeePortalClientRecordsScreen';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeeClientRecordsRoute() {
  return (
    <PortalTabScreen title="Klientenakten" subtitle="Aktive Akten, Kontaktdaten und Einsatzhinweise" scroll={false}>
      <EmployeePortalClientRecordsScreen />
    </PortalTabScreen>
  );
}
