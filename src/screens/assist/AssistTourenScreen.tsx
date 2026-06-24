import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { EmptyState, PremiumButton, SectionPanel } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';

export function AssistTourenScreen() {
  const router = useRouter();
  const assistAccent = moduleColor('assist');

  return (
    <C14vSubpageShell
      title="Touren"
      eyebrow="ASSIST · TOURENPLANUNG"
      subtitle="Routenmanagement und Vertretungen"
      moduleLabel="Assist"
      showBack={false}
      accentColor={assistAccent}
      actions={[
        { key: 'calendar', label: 'Kalender', onPress: () => router.push('/assist/calendar' as never), variant: 'secondary' as const },
        { key: 'vertretung', label: 'Touren-Vertretung', onPress: () => router.push('/assist/touren-vertretung' as never), variant: 'ghost' as const },
      ]}
    >
      <SectionPanel title="Tourenplanung" subtitle="assist_routes / assist_route_items">
        <EmptyState
          title="Noch keine Touren"
          message="Tourenplanung ist von Fahrten getrennt. Routen und Tour-Items werden perspektivisch in assist_routes gespeichert — derzeit Planung ohne Persistenz."
          actionLabel="Zum Fahrtenbuch"
          onAction={() => router.push('/assist/fahrten' as never)}
        />
      </SectionPanel>
    </C14vSubpageShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: careSpacing.sm, marginTop: careSpacing.md },
});
