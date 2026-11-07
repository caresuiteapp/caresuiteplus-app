import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { AcademyWorkspaceScreen } from "../../../../src/features/akademie/AcademyWorkspaceScreen.native.tsx";
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
function AcademyPortalRoute() {
    return <PortalTabScreen title="Meine Akademie" scroll={false} contentOwnsHero>
    <AcademyWorkspaceScreen view="learner"/>
  </PortalTabScreen>;
}
export default withNativeWorkflowPage(AcademyPortalRoute);
