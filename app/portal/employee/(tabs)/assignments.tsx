import { PortalAppointmentsTab } from '@/components/portal';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function EmployeeAssignmentsRoute() {
  return (
    <PortalTabScreen title="Einsätze" hideHeaderOnPhone scroll={false}>
      <PortalAppointmentsTab
        appointmentsLabel="Einsätze"
        detailBasePath="/portal/employee/assignments"
      />
    </PortalTabScreen>
  );
}
