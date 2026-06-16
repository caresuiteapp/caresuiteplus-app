import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumCard } from '@/components/ui';
import type { ConnectCategoryDashboardStats } from '@/lib/connect/connectPresentation';
import { CONNECT_DISPLAY_STATUS_LABELS } from '@/lib/connect/connectPresentation';
import type { ConnectCategory } from '@/types/modules/connect';
import { colors, spacing, typography } from '@/theme';

type ConnectCategoryDashboardCardProps = {
  category: ConnectCategory;
  stats: ConnectCategoryDashboardStats;
  onPress: () => void;
};

export function ConnectCategoryDashboardCard({
  category,
  stats,
  onPress,
}: ConnectCategoryDashboardCardProps) {
  return (
    <PremiumCard accentColor={colors.cyan}>
      <View style={styles.header}>
        <Text style={styles.icon}>{category.icon}</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>{category.label}</Text>
          <PremiumBadge
            label={CONNECT_DISPLAY_STATUS_LABELS[stats.displayStatus]}
            variant={stats.displayStatus === 'not_configured' ? 'orange' : 'cyan'}
          />
        </View>
      </View>

      <Text style={styles.description}>{category.description}</Text>

      <View style={styles.statsRow}>
        <Stat label="Anbieter" value={String(stats.visibleProviders)} />
        <Stat label="Aktiviert" value={String(stats.activatedProviders)} />
        <Stat label="Hinweise" value={String(stats.warningCount)} />
      </View>

      <Text style={styles.sync}>Letzte Synchronisation: {stats.lastSyncLabel}</Text>

      <PremiumButton title="Details" size="sm" variant="secondary" onPress={onPress} />
    </PremiumCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginBottom: spacing.sm },
  icon: { fontSize: 28 },
  headerText: { flex: 1, gap: spacing.xs },
  title: { ...typography.bodyStrong },
  description: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.bodyStrong },
  statLabel: { ...typography.caption, color: colors.textMuted },
  sync: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
});
