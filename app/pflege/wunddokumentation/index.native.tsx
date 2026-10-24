import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { WoundDocumentationListScreen } from "../../../src/screens/pflege/WoundDocumentationListScreen.native.tsx";
function WoundDocumentationRoute() {
    return <WoundDocumentationListScreen />;
}
export default withNativeWorkflowPage(WoundDocumentationRoute);
