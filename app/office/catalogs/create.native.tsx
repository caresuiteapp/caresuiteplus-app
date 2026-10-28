import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { CatalogEditScreen } from "../../../src/screens/catalog/CatalogEditScreen.native.tsx";
function CatalogCreateRoute() { return <CatalogEditScreen />; }
export default withNativeWorkflowPage(CatalogCreateRoute);
