import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { PREMIUM_PREPARED_CONNECTORS } from '@/lib/billing/freePlatformService';
import { colors, spacing, typography } from '@/theme';

type PremiumPreparedNoticeProps = {
  compact?: boolean;
};

const CONNECTOR_LABELS: Record<string, string> = {
  datev: 'DATEV-Export',
  kim: 'KIM / TI-Messenger',
  ti_connector: 'TI-Connector',
  e_rezept: 'E-Rezept',
};

export function PremiumPreparedNotice({ compact = false }: PremiumPreparedNoticeProps) {
  return (
    <PremiumCard accentColor={colors.violet}>
      <View style={styles.header}>
        <Text style={styles.title}>Premium vorbereitet — noch nicht aktiv</Text>
        <PremiumBadge label="preparedOnly" variant="muted" />
      </View>
      {!compact ? (
        <Text style={styles.body}>
          Premium-Connectors sind technisch vorbereitet, aber noch nicht monetarisiert oder
          freigeschaltet. CareSuite+ startet kostenlos — kein Checkout, keine Kreditkarte.
        </Text>
      ) : null}
      <View style={styles.connectorRow}>
        {PREMIUM_PREPARED_CONNECTORS.map((key) => (
          <PremiumBadge key={key} label={CONNECTOR_LABELS[key] ?? key} variant="orange" />
        ))}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: { ...typography.bodyStrong, color: colors.textPrimary, flex: 1 },
  body: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  connectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
