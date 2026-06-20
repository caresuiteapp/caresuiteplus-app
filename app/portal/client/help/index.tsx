import { PortalEmptyState } from '@/components/portal/PortalEmptyState';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function ClientPortalHelpRoute() {
  return (
    <PortalTabScreen title="Hilfe & Kontakt">
      <PortalEmptyState
        icon="❓"
        title="Hilfe & Kontakt"
        message="Bei Fragen wenden Sie sich an Ihr Pflegebüro. Notfälle bitte über die vereinbarten Notfallnummern."
      />
    </PortalTabScreen>
  );
}
