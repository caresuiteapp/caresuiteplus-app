import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { AmbulatoryOperationsScreen } from "../../src/screens/pflege/AmbulatoryOperationsScreen.native.tsx";
function KatalogRoute() { return <AmbulatoryOperationsScreen area="tariffs"/>; }
export default withNativeWorkflowPage(KatalogRoute);
