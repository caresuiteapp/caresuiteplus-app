import { EmployeePortalCalendarScreen } from '@/product-workflows/components/portal/EmployeePortalCalendarScreen';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeeCalendarRoute() {
  return (
    <PortalTabScreen title="Kalender" subtitle="Einsätze, Termine und Abwesenheiten" hideHeaderOnPhone scroll={false}>
      <EmployeePortalCalendarScreen />
    </PortalTabScreen>
  );
}
