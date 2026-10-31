import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { AcademyWorkspaceScreen } from "../../../src/features/akademie/AcademyWorkspaceScreen.native.tsx";
function AcademyRoute() {
    return <AcademyWorkspaceScreen initialSection="assignments"/>;
}
export default withNativeWorkflowPage(AcademyRoute);
