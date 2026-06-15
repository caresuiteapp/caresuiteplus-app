import { PortalDocumentsTab } from '@/components/portal';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function EmployeeDocumentsRoute() {
  return (
    <PortalTabScreen title="Dokumente">
      <PortalDocumentsTab detailBasePath="/portal/employee/documents" />
    </PortalTabScreen>
  );
}
