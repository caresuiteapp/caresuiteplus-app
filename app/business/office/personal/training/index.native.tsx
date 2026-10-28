import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { AcademyWorkspaceScreen } from "../../../../../src/features/akademie/AcademyWorkspaceScreen.native.tsx";
function PersonnelAcademyRoute() {
    return <AcademyWorkspaceScreen initialAudience="employee"/>;
}
export default withNativeWorkflowPage(PersonnelAcademyRoute);
