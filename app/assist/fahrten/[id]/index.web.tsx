import { useLocalSearchParams } from 'expo-router';
import { AssistMobilityWorkspace } from '@/screens/assist/AssistMobilityWorkspace.web';

export default function TripDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  return <AssistMobilityWorkspace initialSelectedId={(Array.isArray(id) ? id[0] : id) || null} />;
}
