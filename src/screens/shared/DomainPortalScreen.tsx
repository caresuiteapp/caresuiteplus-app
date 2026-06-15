import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { PremiumBadge, PremiumButton, PremiumCard, SectionPanel } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type DomainPortalScreenProps = {
  wpNumber: number;
  route: string;
  title?: string;
};

export function DomainPortalScreen({ wpNumber, route, title = 'Portal-Sicht' }: DomainPortalScreenProps) {
  const router = useRouter();

  return (
    <ScreenShell title={title} subtitle={`WP ${wpNumber}`}>
      <PremiumCard>
        <PremiumBadge label="Portal-Vorschau" variant="cyan" />
        <Text style={styles.body}>
          So sehen berechtigte Portal-Nutzer:innen diesen Bereich — ohne Office-Vollzugriff.
        </Text>
        <Text style={styles.meta}>Route: {route}</Text>
      </PremiumCard>
      <SectionPanel title="Freigeschaltete Aktionen">
        <Text style={styles.item}>· Daten einsehen (read-only)</Text>
        <Text style={styles.item}>· Eigene Nachrichten & Dokumente</Text>
        <Text style={styles.item}>· Keine Admin-Funktionen</Text>
      </SectionPanel>
      <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  meta: { ...typography.caption, marginTop: spacing.xs },
  item: { ...typography.body, marginBottom: spacing.xs },
});
