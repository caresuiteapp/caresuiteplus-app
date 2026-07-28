import { PortalDocumentsTab } from '@/product-workflows/components/portal';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeeDocumentsRoute() {
  return (
    <PortalTabScreen title="Dokumente">
      <PortalDocumentsTab detailBasePath="/portal/employee/documents" />
    </PortalTabScreen>
  );
}
