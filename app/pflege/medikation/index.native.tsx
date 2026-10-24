import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { MedicationListScreen } from "../../../src/screens/pflege/MedicationListScreen.native.tsx";
function MedicationRoute() {
    return <MedicationListScreen />;
}
export default withNativeWorkflowPage(MedicationRoute);
