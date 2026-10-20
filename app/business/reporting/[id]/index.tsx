import { useLocalSearchParams } from 'expo-router';
import { ReportDetailScreen } from '@/product-workflows/screens/reporting';

/** WP505 — Berichtsdetail */
export default function ReportDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReportDetailScreen reportId={id ?? ''} />;
}
