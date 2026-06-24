import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

type PaymentSettingsHeroProps = {
  providerLabel: string;
  environmentLabel: string;
  webhookStatus: string;
};

export function PaymentSettingsHero({
  providerLabel,
  environmentLabel,
  webhookStatus,
}: PaymentSettingsHeroProps) {
  return (
    <View style={styles.hero}>
      <Text style={styles.title}>Zahlungsanbieter</Text>
      <Text style={styles.meta}>
        {providerLabel} · {environmentLabel} · Webhook: {webhookStatus}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  eyebrow: { ...typography.caption, color: colors.orange, marginBottom: spacing.xs },
  title: { ...typography.h3, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textSecondary },
});
