import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { CompanyInventoryRedirect } from "../../../src/lib/navigation/CompanyInventoryRedirect.native.tsx";
function LegacyInventoryRoute() {
    return <CompanyInventoryRedirect view="locations"/>;
}
export default withNativeWorkflowPage(LegacyInventoryRoute);
