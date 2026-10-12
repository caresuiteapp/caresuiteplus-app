import { useLocalSearchParams } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { OfficeMessageDetailSummaryPanel } from '@/components/office/OfficeMessageDetailSummaryPanel';

export default function OfficeMessageDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <C14vSubpageShell title="Nachricht" showBack>
      <OfficeMessageDetailSummaryPanel messageId={id ?? ''} />
    </C14vSubpageShell>
  );
}
