import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MarketplaceCategory } from '@/types/marketplace';
import { colors, spacing, typography } from '@/theme';

type MarketplaceCategoryCardProps = {
  category: MarketplaceCategory;
  partnerCount: number;
  onPress: () => void;
};

export function MarketplaceCategoryCard({ category, partnerCount, onPress }: MarketplaceCategoryCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <Text style={styles.icon}>{category.icon}</Text>
      <View style={styles.body}>
        <Text style={styles.title}>{category.label}</Text>
        <Text style={styles.description}>{category.description}</Text>
        <Text style={styles.meta}>
          {partnerCount > 0 ? `${partnerCount} aktive Partner` : 'Keine aktiven Partner'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  icon: { fontSize: 28 },
  body: { flex: 1, gap: spacing.xs },
  title: { ...typography.bodyStrong },
  description: { ...typography.body },
  meta: { ...typography.caption, color: colors.textMuted },
});
