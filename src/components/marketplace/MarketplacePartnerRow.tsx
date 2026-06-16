import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MarketplacePartner } from '@/types/marketplace';
import { MARKETPLACE_PARTNER_STATUS_LABELS, isPartnerSelectable } from '@/lib/marketplace';
import { colors, spacing, typography } from '@/theme';

type MarketplacePartnerRowProps = {
  partner: MarketplacePartner;
  onPress?: () => void;
};

export function MarketplacePartnerRow({ partner, onPress }: MarketplacePartnerRowProps) {
  const selectable = isPartnerSelectable(partner);

  return (
    <Pressable
      style={[styles.row, !selectable && styles.rowDisabled]}
      onPress={selectable ? onPress : undefined}
      disabled={!selectable}
      accessibilityRole="button"
      accessibilityState={{ disabled: !selectable }}
    >
      <View style={styles.body}>
        <Text style={styles.title}>{partner.name}</Text>
        <Text style={styles.description}>{partner.shortDescription}</Text>
        <Text style={styles.status}>{MARKETPLACE_PARTNER_STATUS_LABELS[partner.status]}</Text>
      </View>
      {partner.isDemo ? <Text style={styles.badge}>Demo</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.sm,
  },
  rowDisabled: { opacity: 0.55 },
  body: { flex: 1, gap: spacing.xs },
  title: { ...typography.bodyStrong },
  description: { ...typography.body },
  status: { ...typography.caption, color: colors.textMuted },
  badge: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.bgPanel,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
});
