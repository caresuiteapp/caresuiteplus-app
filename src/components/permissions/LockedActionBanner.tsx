import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type LockedActionBannerProps = {
  title?: string;
  message: string;
  roleLabel?: string | null;
};

export function LockedActionBanner({
  title = 'Aktion gesperrt',
  message,
  roleLabel,
}: LockedActionBannerProps) {
  return (
    <PremiumCard accentColor={colors.cyan}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {roleLabel ? <PremiumBadge label={roleLabel} variant="muted" /> : null}
      </View>
      <Text style={styles.message}>{message}</Text>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.cyan,
  },
  message: {
    ...typography.body,
  },
});
