import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { PREMIUM_PREPARED_CONNECTORS } from '@/lib/billing/freePlatformService';
import { IN_PREPARATION_LABEL } from '@/lib/ui/uiVisibility';
import { colors, spacing, typography } from '@/theme';

type PremiumPreparedNoticeProps = {
  compact?: boolean;
  variant?: 'default' | 'extensions';
};

const CONNECTOR_LABELS: Record<string, string> = {
  datev: 'DATEV-Export',
  kim: 'KIM / TI-Messenger',
  ti_connector: 'TI-Connector',
  e_rezept: 'E-Rezept',
};

export function PremiumPreparedNotice({
  compact = false,
  variant = 'default',
}: PremiumPreparedNoticeProps) {
  const isExtensions = variant === 'extensions';

  return (
    <PremiumCard accentColor={colors.violet}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isExtensions ? 'Erweiterungen in Vorbereitung' : 'Premium vorbereitet — noch nicht aktiv'}
        </Text>
        <PremiumBadge label={IN_PREPARATION_LABEL} variant="orange" />
      </View>
      {!compact ? (
        <Text style={styles.body}>
          {isExtensions
            ? 'Diese Funktionen sind geplant oder technisch vorbereitet, aber noch nicht für Mandanten aktiv.'
            : 'Premium-Connectors sind vorbereitet, aber noch nicht freigeschaltet. Die Hauptmodule starten ohne Checkout.'}
        </Text>
      ) : isExtensions ? (
        <Text style={styles.body}>
          Diese Funktionen sind geplant oder technisch vorbereitet, aber noch nicht für Mandanten aktiv.
        </Text>
      ) : null}
      <View style={styles.connectorRow}>
        {PREMIUM_PREPARED_CONNECTORS.map((key) => (
          <PremiumBadge
            key={key}
            label={CONNECTOR_LABELS[key] ?? key}
            variant="orange"
          />
        ))}
      </View>
      <View style={styles.statusRow}>
        <PremiumBadge label="Noch nicht buchbar" variant="muted" />
        <PremiumBadge label="Nicht aktiv" variant="muted" />
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
  connectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
