import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { AssistTourPlanningWorkspace } from "../../src/screens/assist/AssistTourPlanningWorkspace.native.tsx";
function AssistReplacementRoute() {
    return <AssistTourPlanningWorkspace view="replacement"/>;
}
export default withNativeWorkflowPage(AssistReplacementRoute);
