import { PortalDocumentsTab } from '@/product-workflows/components/portal';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function ClientDocumentsRoute() {
  return (
    <PortalTabScreen title="Dokumente" hideHeaderOnPhone scroll={false}>
      <PortalDocumentsTab detailBasePath="/portal/client/documents" ownsScroll />
    </PortalTabScreen>
  );
}
