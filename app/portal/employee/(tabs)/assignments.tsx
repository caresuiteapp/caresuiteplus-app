import { PortalAppointmentsTab } from '@/product-workflows/components/portal';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeeAssignmentsRoute() {
  return (
    <PortalTabScreen title="Meine Einsätze" subtitle="Planung, Durchführung und Verlauf" scroll={false}>
      <PortalAppointmentsTab
        audience="employee"
        appointmentsLabel="Einsätze"
        detailBasePath="/portal/employee/assignments"
      />
    </PortalTabScreen>
  );
}
