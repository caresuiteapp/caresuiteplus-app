import { useLocalSearchParams } from 'expo-router';
import { CareCompletedStopPickerScreen } from '@/product-workflows/screens/pflege/CareCompletedStopPickerScreen';
import { CareTourStopProofScreen } from '@/product-workflows/screens/pflege/CareTourStopProofScreen';
export default function PflegeServiceProofCreateRoute() {
  const { tourStopId } = useLocalSearchParams<{ tourStopId?: string }>();
  return tourStopId ? <CareTourStopProofScreen stopId={tourStopId} /> : <CareCompletedStopPickerScreen />;
}
