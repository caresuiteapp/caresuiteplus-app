import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { AssistBudgetOverviewScreen } from "../../src/screens/assist/AssistBudgetOverviewScreen.native.tsx";
function Route() {
    return <AssistBudgetOverviewScreen />;
}
export default withNativeWorkflowPage(Route);
