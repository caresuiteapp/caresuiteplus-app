import { useLocalSearchParams } from 'expo-router';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';
import { EmployeePortalClientRecordDetailScreen } from '@/product-workflows/components/portal/EmployeePortalClientRecordDetailScreen';

export default function EmployeeClientRecordDetailRoute() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const clientId = Array.isArray(rawId) ? rawId[0] : rawId;

  return (
    <PortalTabScreen title="Klientenakte" contentOwnsHero>
      <EmployeePortalClientRecordDetailScreen clientId={clientId} />
    </PortalTabScreen>
  );
}
