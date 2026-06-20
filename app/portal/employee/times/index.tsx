import { PortalEmptyState } from '@/components/portal/PortalEmptyState';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

/** Fahrten/Zeiten — einsatzbezogen, kein Budget. */
export default function EmployeePortalTimesRoute() {
  return (
    <PortalTabScreen title="Fahrten & Zeiten">
      <PortalEmptyState
        icon="⏱️"
        title="Einsatzzeiten & Fahrten"
        message="Zeiten und Fahrten werden pro Einsatz in der Durchführung erfasst. GPS nur mit Ihrer Zustimmung."
      />
    </PortalTabScreen>
  );
}
