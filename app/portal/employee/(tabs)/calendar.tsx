import { EmployeePortalCalendarScreen } from '@/components/portal/EmployeePortalCalendarScreen';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function EmployeeCalendarRoute() {
  return (
    <PortalTabScreen title="Kalender" subtitle="Einsätze, Termine und Abwesenheiten" hideHeaderOnPhone scroll={false}>
      <EmployeePortalCalendarScreen />
    </PortalTabScreen>
  );
}
