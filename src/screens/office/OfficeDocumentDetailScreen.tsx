import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { OfficeDocumentDetailSummaryPanel } from '@/components/office/OfficeDocumentDetailSummaryPanel';
import { ErrorState, PremiumButton } from '@/components/ui';
import { useRouter } from 'expo-router';

export function OfficeDocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const documentId = id ?? '';

  if (!documentId) {
    return (
      <ScreenShell title="Dokument" subtitle="Fehler">
        <ErrorState message="Dokument-ID fehlt." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Dokument" subtitle="Vorschau" onBack={() => router.back()}>
      <OfficeDocumentDetailSummaryPanel documentId={documentId} />
    </ScreenShell>
  );
}
