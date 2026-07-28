import { PortalEmptyState } from '@/product-workflows/components/portal/PortalEmptyState';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeePortalTasksRoute() {
  return (
    <PortalTabScreen title="Aufgaben">
      <PortalEmptyState
        icon="✅"
        title="Aufgaben je Einsatz"
        message="Offene Aufgaben erscheinen in der Einsatzdurchführung und in Meine Einsätze."
      />
    </PortalTabScreen>
  );
}
