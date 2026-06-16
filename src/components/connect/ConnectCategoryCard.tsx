import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import type { ConnectCategory } from '@/types/modules/connect';
import { CONNECT_CATEGORY_STATUS_LABELS } from '@/types/modules/connect';
import { colors, spacing, typography } from '@/theme';

type ConnectCategoryCardProps = {
  category: ConnectCategory;
  visibleCount: number;
  onPress: () => void;
};

export function ConnectCategoryCard({ category, visibleCount, onPress }: ConnectCategoryCardProps) {
  return (
    <PremiumCard accentColor={colors.cyan} onPress={onPress}>
      <View style={styles.row}>
        <Text style={styles.icon}>{category.icon}</Text>
        <View style={styles.content}>
          <Text style={styles.title}>{category.label}</Text>
          <Text style={styles.description}>{category.description}</Text>
          <Text style={styles.meta}>{visibleCount} Schnittstellen</Text>
        </View>
        <PremiumBadge
          label={CONNECT_CATEGORY_STATUS_LABELS[category.readiness]}
          variant={category.readiness === 'prepared' ? 'cyan' : 'orange'}
        />
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  icon: { fontSize: 24, marginTop: 2 },
  content: { flex: 1, gap: spacing.xs },
  title: { ...typography.bodyStrong },
  description: { ...typography.caption, color: colors.textSecondary },
  meta: { ...typography.caption, color: colors.textMuted },
});
