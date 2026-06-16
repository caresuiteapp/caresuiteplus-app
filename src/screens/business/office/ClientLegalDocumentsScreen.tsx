import { useLocalSearchParams, useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { ClientRecordDocumentsPanel } from '@/components/office/ClientRecordDocumentsPanel';
import { ErrorState, PremiumButton } from '@/components/ui';

type ClientLegalDocumentsScreenProps = {
  focus: 'contracts' | 'consents' | 'documents';
};

export function ClientLegalDocumentsScreen({ focus }: ClientLegalDocumentsScreenProps) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const clientId = id ?? '';

  const title =
    focus === 'contracts' ? 'Verträge' : focus === 'consents' ? 'Einwilligungen' : 'Dokumente';

  if (!clientId) {
    return (
      <CareLightPageShell title={title} subtitle="Fehler">
        <ErrorState message="Klient:in-ID fehlt." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title={title}
      subtitle="Klient:innenakte"
      onBack={() => router.back()}
    >
      <ClientRecordDocumentsPanel clientId={clientId} />
    </CareLightPageShell>
  );
}
