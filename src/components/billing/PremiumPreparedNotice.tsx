import { StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from '@/design/components';
import { GlassCard } from '@/design/components/GlassCard';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { PREMIUM_PREPARED_CONNECTORS } from '@/lib/billing/freePlatformService';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type PremiumPreparedNoticeProps = {
  compact?: boolean;
};

const CONNECTOR_LABELS: Record<string, string> = {
  datev: 'DATEV',
  kim: 'KIM',
  ti_connector: 'TI',
  e_rezept: 'E-Rezept',
};

export function PremiumPreparedNotice({ compact = false }: PremiumPreparedNoticeProps) {
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <GlassCard accentColor={galaxyPalette.glowViolet}>
      <View style={styles.header}>
        <Text style={[type.cardTitle, styles.title]} numberOfLines={2}>
          Premium-Connectors
        </Text>
        <StatusBadge kind="comingSoon" label="Demnächst verfügbar" />
      </View>
      {!compact ? (
        <Text style={[type.caption, styles.body]} numberOfLines={3}>
          DATEV, KIM, TI und E-Rezept sind vorbereitet und später aktivierbar.
        </Text>
      ) : null}
      <View style={styles.connectorRow}>
        {PREMIUM_PREPARED_CONNECTORS.map((key) => (
          <View key={key} style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {CONNECTOR_LABELS[key] ?? key}
            </Text>
            <Text style={styles.chipSub} numberOfLines={1}>
              Später aktivierbar
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: careSpacing.sm,
    gap: careSpacing.sm,
    flexWrap: 'wrap',
  },
  title: { flex: 1, minWidth: 0, flexShrink: 1 },
  body: { marginBottom: careSpacing.sm, flexShrink: 1 },
  connectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
  chip: {
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${galaxyPalette.careOrange}44`,
    backgroundColor: `${galaxyPalette.careOrange}18`,
    flexShrink: 0,
    gap: 2,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: galaxyPalette.careOrange,
  },
  chipSub: {
    fontSize: 10,
    color: galaxyPalette.textMuted,
  },
});
