import { EmployeePortalCalendarScreen } from '@/product-workflows/components/portal/EmployeePortalCalendarScreen';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeeCalendarRoute() {
  return (
    <PortalTabScreen title="Teamkalender" subtitle="Alle Mitarbeitenden, Einsätze, Termine und Abwesenheiten" hideHeaderOnPhone>
      <EmployeePortalCalendarScreen />
    </PortalTabScreen>
  );
}
