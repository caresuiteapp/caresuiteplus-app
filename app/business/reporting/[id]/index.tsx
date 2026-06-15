import { useLocalSearchParams } from 'expo-router';
import { ReportDetailScreen } from '@/screens/reporting';

/** WP505 — Berichtsdetail */
export default function ReportDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReportDetailScreen reportId={id ?? ''} />;
}
