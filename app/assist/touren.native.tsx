import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { AssistTourPlanningWorkspace } from "../../src/screens/assist/AssistTourPlanningWorkspace.native.tsx";
function AssistToursRoute() {
    return <AssistTourPlanningWorkspace view="planning"/>;
}
export default withNativeWorkflowPage(AssistToursRoute);
