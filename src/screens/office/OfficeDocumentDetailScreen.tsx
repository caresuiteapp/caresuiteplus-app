import { useLocalSearchParams } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { OfficeDocumentDetailSummaryPanel } from '@/components/office/OfficeDocumentDetailSummaryPanel';
import { ErrorState, PremiumButton } from '@/components/ui';
import { useRouter } from 'expo-router';

export function OfficeDocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const documentId = id ?? '';

  if (!documentId) {
    return (
      <CareLightPageShell title="Dokument" subtitle="Fehler">
        <ErrorState message="Dokument-ID fehlt." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title="Dokument" subtitle="Vorschau" onBack={() => router.back()}>
      <OfficeDocumentDetailSummaryPanel documentId={documentId} />
    </CareLightPageShell>
  );
}
