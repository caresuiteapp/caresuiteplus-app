import { useLocalSearchParams } from 'expo-router';
import { InsightExportDetailScreen } from '@/product-workflows/screens/insight';

export default function InsightExportDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InsightExportDetailScreen exportId={id ?? ''} />;
}
