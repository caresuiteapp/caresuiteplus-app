import { EmployeePortalUploadScreen } from '@/product-workflows/components/portal/EmployeePortalUploadScreen';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeeUploadsRoute() {
  return (
    <PortalTabScreen title="Dateien einreichen" subtitle="Unterlagen auswählen, zuordnen und an die Verwaltung senden">
      <EmployeePortalUploadScreen />
    </PortalTabScreen>
  );
}
