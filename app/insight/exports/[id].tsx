import { useLocalSearchParams } from 'expo-router';
import { InsightExportDetailScreen } from '@/screens/insight';

export default function InsightExportDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InsightExportDetailScreen exportId={id ?? ''} />;
}
