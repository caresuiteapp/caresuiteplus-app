import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { SubscriptionScreen } from "../../../src/screens/business/SubscriptionScreen.native.tsx";
function SubscriptionRoute() {
    return <SubscriptionScreen />;
}
export default withNativeWorkflowPage(SubscriptionRoute);
