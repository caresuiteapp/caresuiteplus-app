import { EmployeePortalUploadScreen } from '@/product-workflows/components/portal/EmployeePortalUploadScreen';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeeUploadsRoute() {
  return (
    <PortalTabScreen title="Uploads / Dokumente" subtitle="Dokumente an die Verwaltung senden" hideHeaderOnPhone>
      <EmployeePortalUploadScreen />
    </PortalTabScreen>
  );
}
