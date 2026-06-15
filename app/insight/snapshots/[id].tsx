import { useLocalSearchParams } from 'expo-router';
import { InsightSnapshotDetailScreen } from '@/screens/insight';

export default function InsightSnapshotDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InsightSnapshotDetailScreen snapshotId={id ?? ''} />;
}
