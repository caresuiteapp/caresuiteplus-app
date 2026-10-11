import { useLocalSearchParams } from 'expo-router';
import { CareCompletedStopPickerScreen } from '@/screens/pflege/CareCompletedStopPickerScreen';
import { CareTourStopProofScreen } from '@/screens/pflege/CareTourStopProofScreen';
export default function PflegeServiceProofCreateRoute() {
  const { tourStopId } = useLocalSearchParams<{ tourStopId?: string }>();
  return tourStopId ? <CareTourStopProofScreen stopId={tourStopId} /> : <CareCompletedStopPickerScreen />;
}
