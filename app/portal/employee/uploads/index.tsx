import { EmployeePortalUploadScreen } from '@/components/portal/EmployeePortalUploadScreen';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function EmployeeUploadsRoute() {
  return (
    <PortalTabScreen title="Uploads / Dokumente" subtitle="Dokumente an die Verwaltung senden" hideHeaderOnPhone>
      <EmployeePortalUploadScreen />
    </PortalTabScreen>
  );
}
