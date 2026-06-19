import { ClientPortalMessagesScreen } from '@/screens/communication';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function ClientPortalMessagesRoute() {
  return (
    <PortalTabScreen title="Nachrichten" scroll={false} hideHeaderOnPhone>
      <ClientPortalMessagesScreen />
    </PortalTabScreen>
  );
}
