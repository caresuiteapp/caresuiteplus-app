import { PortalEmptyState } from '@/product-workflows/components/portal/PortalEmptyState';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeePortalHelpRoute() {
  return (
    <PortalTabScreen title="Hilfe">
      <PortalEmptyState
        icon="❓"
        title="Einsatzhilfe & Support"
        message="Bei technischen Problemen oder Einsatzfragen wenden Sie sich an Ihr Pflegebüro."
      />
    </PortalTabScreen>
  );
}
