import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { AmbulatoryOperationsScreen } from "../../src/screens/pflege/AmbulatoryOperationsScreen.native.tsx";
function AufnahmeRoute() { return <AmbulatoryOperationsScreen area="admissions"/>; }
export default withNativeWorkflowPage(AufnahmeRoute);
