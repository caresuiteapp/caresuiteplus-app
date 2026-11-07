import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { EmployeePortalUploadScreen } from "../../../../src/components/portal/EmployeePortalUploadScreen.native.tsx";
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';
function EmployeeUploadsRoute() {
    return (<PortalTabScreen title="Dateien einreichen" subtitle="Unterlagen auswählen, zuordnen und an die Verwaltung senden">
      <EmployeePortalUploadScreen />
    </PortalTabScreen>);
}
export default withNativeWorkflowPage(EmployeeUploadsRoute);
