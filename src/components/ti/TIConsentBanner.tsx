import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  message: string;
  onManagePress?: () => void;
};

export function TIConsentBanner({ message, onManagePress }: Props) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.title}>Einwilligung erforderlich</Text>
      <Text style={styles.message}>{message}</Text>
      {onManagePress ? (
        <PremiumButton title="Einwilligungen verwalten" size="sm" variant="secondary" onPress={onManagePress} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(255, 180, 0, 0.12)',
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { ...typography.bodyStrong, color: colors.warning },
  message: { ...typography.body, color: colors.textSecondary },
});
