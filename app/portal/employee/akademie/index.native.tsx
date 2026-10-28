import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { AcademyWorkspaceScreen } from "../../../../src/features/akademie/AcademyWorkspaceScreen.native.tsx";
function AcademyPortalRoute() {
    return <AcademyWorkspaceScreen view="learner"/>;
}
export default withNativeWorkflowPage(AcademyPortalRoute);
