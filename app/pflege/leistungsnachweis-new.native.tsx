import {withNativeWorkflowPage} from '@/components/navigation/NativeWorkflowPage.native';
import { useLocalSearchParams } from 'expo-router';
import { CareCompletedStopPickerScreen } from '@/product-workflows/screens/pflege/CareCompletedStopPickerScreen';
import { CareTourStopProofScreen } from "../../src/screens/pflege/CareTourStopProofScreen.native.tsx";
function PflegeServiceProofCreateRoute() {
    const { tourStopId } = useLocalSearchParams<{
        tourStopId?: string;
    }>();
    return tourStopId ? <CareTourStopProofScreen stopId={tourStopId}/> : <CareCompletedStopPickerScreen />;
}
export default withNativeWorkflowPage(PflegeServiceProofCreateRoute);
