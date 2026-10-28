import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { WfmTravelRulesScreen } from "../../../../src/components/wfm/WfmTravelRulesScreen.native.tsx";
function OfficeTimeTrackingFahrzeitregelnRoute() {
    return <WfmTravelRulesScreen />;
}
export default withNativeWorkflowPage(OfficeTimeTrackingFahrzeitregelnRoute);
