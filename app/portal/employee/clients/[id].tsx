import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmployeePortalClientRecordDetailScreen } from '@/components/portal/EmployeePortalClientRecordDetailScreen';

export default function EmployeeClientRecordDetailRoute() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const clientId = Array.isArray(rawId) ? rawId[0] : rawId;

  return (
    <ScreenShell title="Klientenakte" showBack>
      <EmployeePortalClientRecordDetailScreen clientId={clientId} />
    </ScreenShell>
  );
}
