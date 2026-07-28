import { PortalAppointmentsTab } from '@/product-workflows/components/portal';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function ClientAppointmentsRoute() {
  return (
    <PortalTabScreen title="Einsätze" hideHeaderOnPhone scroll={false}>
      <PortalAppointmentsTab
        appointmentsLabel="Einsätze"
        detailBasePath="/portal/client/appointments"
      />
    </PortalTabScreen>
  );
}
