import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { WfmTeamMeetingsScreen } from "../../../../src/components/wfm/WfmTeamMeetingsScreen.native.tsx";
function OfficeTimeTrackingTeamMeetingsRoute() {
    return <WfmTeamMeetingsScreen />;
}
export default withNativeWorkflowPage(OfficeTimeTrackingTeamMeetingsRoute);
