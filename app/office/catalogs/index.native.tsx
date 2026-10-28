import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { CatalogsListScreen } from "../../../src/screens/catalog/CatalogsListScreen.native.tsx";
function CatalogsRoute() {
    return <CatalogsListScreen />;
}
export default withNativeWorkflowPage(CatalogsRoute);
