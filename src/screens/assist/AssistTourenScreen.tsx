import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, PremiumButton, SectionPanel } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';

export function AssistTourenScreen() {
  const router = useRouter();

  return (
    <ScreenShell
      title="Touren"
      subtitle="Tourenplanung · Assist"
      showBack={false}
    >
      <SectionPanel title="Tourenplanung" subtitle="assist_routes / assist_route_items">
        <EmptyState
          title="Noch keine Touren"
          message="Tourenplanung ist von Fahrten getrennt. Routen und Tour-Items werden perspektivisch in assist_routes gespeichert — derzeit Planung ohne Persistenz."
          actionLabel="Zum Fahrtenbuch"
          onAction={() => router.push('/assist/fahrten' as never)}
        />
      </SectionPanel>
      <View style={styles.actions}>
        <PremiumButton
          title="Kalender"
          variant="secondary"
          onPress={() => router.push('/assist/calendar' as never)}
        />
        <PremiumButton
          title="Touren-Vertretung"
          variant="ghost"
          onPress={() => router.push('/assist/touren-vertretung' as never)}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: careSpacing.sm, marginTop: careSpacing.md },
});
