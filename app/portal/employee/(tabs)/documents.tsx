import { PortalDocumentsTab } from '@/product-workflows/components/portal';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeeDocumentsRoute() {
  return (
    <PortalTabScreen title="Dokumente" contentOwnsHero>
      <PortalDocumentsTab audience="employee" detailBasePath="/portal/employee/documents" />
    </PortalTabScreen>
  );
}
