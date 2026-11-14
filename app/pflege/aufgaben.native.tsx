import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { AmbulatoryOperationsScreen } from "../../src/screens/pflege/AmbulatoryOperationsScreen.native.tsx";
function AufgabenRoute() { return <AmbulatoryOperationsScreen area="tasks"/>; }
export default withNativeWorkflowPage(AufgabenRoute);
