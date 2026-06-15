import { StyleSheet, Text } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { PremiumCard, SectionPanel } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

export function AssistCalendarPlaceholderScreen() {
  return (
    <ScreenShell title="Kalender" subtitle="Einsatzplanung · Demo-funktional">
      <PremiumCard accentColor={colors.violet}>
        <Text style={styles.title}>Demo-funktional</Text>
        <Text style={styles.body}>
          Die Wochen- und Monatsübersicht für Einsätze wird in einem späteren Arbeitspaket
          ergänzt. Nutzen Sie bis dahin die Einsatzliste mit Suche und Filter.
        </Text>
      </PremiumCard>
      <SectionPanel title="Geplant" subtitle="Roadmap Assist">
        <Text style={styles.item}>• Wochenkalender mit Drag & Drop</Text>
        <Text style={styles.item}>• Konfliktprüfung bei Doppelbelegung</Text>
        <Text style={styles.item}>• Export für Disposition</Text>
      </SectionPanel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong, marginBottom: spacing.sm },
  body: { ...typography.body },
  item: { ...typography.caption, marginBottom: spacing.xs },
});
