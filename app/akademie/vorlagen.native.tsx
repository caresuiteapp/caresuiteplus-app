import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { AcademyWorkspaceScreen } from "../../src/features/akademie/AcademyWorkspaceScreen.native.tsx";
function AcademyTemplatesRoute() {
    return <AcademyWorkspaceScreen initialSection="templates"/>;
}
export default withNativeWorkflowPage(AcademyTemplatesRoute);
