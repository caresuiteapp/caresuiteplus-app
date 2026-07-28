import { PortalDocumentsTab } from '@/product-workflows/components/portal';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function ClientDocumentsRoute() {
  return (
    <PortalTabScreen title="Dokumente" hideHeaderOnPhone>
      <PortalDocumentsTab detailBasePath="/portal/client/documents" />
    </PortalTabScreen>
  );
}
