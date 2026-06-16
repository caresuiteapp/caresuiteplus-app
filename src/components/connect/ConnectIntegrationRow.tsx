import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { CONNECT_NOT_CONNECTED_LABEL } from '@/lib/connect';
import type { ConnectIntegration } from '@/types/modules/connect';
import { CONNECT_READINESS_LABELS } from '@/types/modules/connect';
import { colors, spacing, typography } from '@/theme';

type ConnectIntegrationRowProps = {
  integration: ConnectIntegration;
  onPress: () => void;
};

export function ConnectIntegrationRow({ integration, onPress }: ConnectIntegrationRowProps) {
  return (
    <PremiumCard accentColor={colors.cyanSoft} onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.content}>
          <Text style={styles.title}>{integration.label}</Text>
          <Text style={styles.description}>{integration.description}</Text>
          <Text style={styles.status}>{CONNECT_NOT_CONNECTED_LABEL}</Text>
        </View>
        <PremiumBadge
          label={CONNECT_READINESS_LABELS[integration.readiness]}
          variant={integration.readiness === 'prepared' ? 'cyan' : 'orange'}
        />
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  content: { flex: 1, gap: spacing.xs },
  title: { ...typography.bodyStrong },
  description: { ...typography.caption, color: colors.textSecondary },
  status: { ...typography.caption, color: colors.textMuted },
});
