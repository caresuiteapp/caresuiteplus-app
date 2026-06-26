import { PortalDocumentsTab } from '@/components/portal';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function ClientDocumentsRoute() {
  return (
    <PortalTabScreen title="Dokumente" hideHeaderOnPhone>
      <PortalDocumentsTab detailBasePath="/portal/client/documents" />
    </PortalTabScreen>
  );
}
