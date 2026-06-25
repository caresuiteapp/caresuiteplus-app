import { PortalAppointmentsTab } from '@/components/portal';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function ClientAppointmentsRoute() {
  return (
    <PortalTabScreen title="Termine" hideHeaderOnPhone>
      <PortalAppointmentsTab
        appointmentsLabel="Termine"
        detailBasePath="/portal/client/appointments"
      />
    </PortalTabScreen>
  );
}
