import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { UserProfileScreen } from "../../src/screens/settings/userprofilescreen.native.tsx";
function UserProfileRoute() {
    return <UserProfileScreen />;
}
export default withNativeWorkflowPage(UserProfileRoute);
