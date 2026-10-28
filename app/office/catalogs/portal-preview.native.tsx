import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { Redirect } from 'expo-router';
/** No catalogue portal preview is published; keep old links usable. */
function CatalogPortalPreviewRoute() {
    return <Redirect href="/office/catalogs"/>;
}
export default withNativeWorkflowPage(CatalogPortalPreviewRoute);
