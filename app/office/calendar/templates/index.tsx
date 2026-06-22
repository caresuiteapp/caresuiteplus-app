import { ScreenShell } from '@/components/layout';
import { EmptyState, PremiumButton } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useRouter } from 'expo-router';

/** Stub — Mandanten-Vorlagenverwaltung folgt in einem späteren Sprint. */
export default function CalendarTemplatesScreen() {
  const router = useRouter();
  const accent = moduleColor('office');

  return (
    <ScreenShell
      title="Kalender-Vorlagen"
      subtitle="Mandantenvorlagen verwalten"
      rightSlot={
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      }
    >
      <EmptyState
        title="Vorlagenverwaltung"
        message="CRUD für Mandantenvorlagen ist vorbereitet. Systemvorlagen werden beim Anlegen automatisch geladen."
        actionLabel="Zum Kalender"
        onAction={() => router.push('/office/calendar' as never)}
        accentColor={accent}
      />
    </ScreenShell>
  );
}
