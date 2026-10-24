import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { ClientRecordScreen } from "../../../../../src/screens/business/office/ClientRecordScreen.native.tsx";
function Route() {
    return <ClientRecordScreen initialTabOverride="portal"/>;
}
export default withNativeWorkflowPage(Route);
