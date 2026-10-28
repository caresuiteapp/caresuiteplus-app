import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { EmployeePortalUploadScreen } from "../../../../src/components/portal/EmployeePortalUploadScreen.native.tsx";
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';
function EmployeeUploadsRoute() {
    return (<PortalTabScreen title="Uploads / Dokumente" subtitle="Dokumente an die Verwaltung senden" hideHeaderOnPhone>
      <EmployeePortalUploadScreen />
    </PortalTabScreen>);
}
export default withNativeWorkflowPage(EmployeeUploadsRoute);
