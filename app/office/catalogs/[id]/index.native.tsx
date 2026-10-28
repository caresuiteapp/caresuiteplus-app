import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { CatalogDetailScreen } from "../../../../src/screens/catalog/CatalogDetailScreen.native.tsx";
function CatalogDetailRoute() {
    return <CatalogDetailScreen />;
}
export default withNativeWorkflowPage(CatalogDetailRoute);
