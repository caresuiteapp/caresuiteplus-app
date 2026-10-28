import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { Redirect } from 'expo-router';
/** The former prototype did not persist workflows; use the live catalogue. */
function CatalogWorkflowRoute() {
    return <Redirect href="/office/catalogs"/>;
}
export default withNativeWorkflowPage(CatalogWorkflowRoute);
