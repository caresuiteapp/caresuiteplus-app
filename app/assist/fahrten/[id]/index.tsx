import { useLocalSearchParams } from 'expo-router';
import { TripsAdaptiveScreen } from '@/screens/assist/TripsAdaptiveScreen';

/** Deep link — opens Fahrten list with detail modal for the given trip id. */
export default function TripDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = typeof id === 'string' ? id : null;
  return <TripsAdaptiveScreen initialSelectedId={tripId} />;
}
