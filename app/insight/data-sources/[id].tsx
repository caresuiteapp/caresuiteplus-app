import { useLocalSearchParams } from 'expo-router';
import { InsightDataSourceDetailScreen } from '@/screens/insight';

export default function InsightDataSourceDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InsightDataSourceDetailScreen sourceId={id} />;
}
