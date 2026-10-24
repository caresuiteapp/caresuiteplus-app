import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { useLocalSearchParams } from 'expo-router';
import { AssistMobilityWorkspace } from "../../../../src/screens/assist/AssistMobilityWorkspace.native.tsx";
function TripDetailRoute() {
    const { id } = useLocalSearchParams<{
        id?: string | string[];
    }>();
    return <AssistMobilityWorkspace initialSelectedId={(Array.isArray(id) ? id[0] : id) || null}/>;
}
export default withNativeWorkflowPage(TripDetailRoute);
