import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { ConsultationWorkspaceScreen } from "../../../../src/features/beratung/ConsultationWorkspaceScreen.native.tsx";
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
function EmployeeConsultationRoute() {
    return <PortalTabScreen title="Beratung & Schulungen" scroll={false} contentOwnsHero>
    <ConsultationWorkspaceScreen employeeView/>
  </PortalTabScreen>;
}
export default withNativeWorkflowPage(EmployeeConsultationRoute);
