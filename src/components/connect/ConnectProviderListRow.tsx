import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumCard } from '@/components/ui';
import {
  CONNECT_DISPLAY_STATUS_LABELS,
  canActivateConnectIntegration,
  getConnectUserDisplayHint,
  type ConnectDisplayStatus,
  type ConnectProviderCompliance,
} from '@/lib/connect/connectPresentation';
import type { ConnectIntegration } from '@/types/modules/connect';
import { colors, spacing, typography } from '@/theme';

type ConnectProviderListRowProps = {
  categoryKey: string;
  integration: ConnectIntegration;
  categoryLabel: string;
  displayStatus: ConnectDisplayStatus;
  compliance: ConnectProviderCompliance;
  canConfigure: boolean;
  onPress: () => void;
  onConfigure: () => void;
};

export function ConnectProviderListRow({
  categoryKey,
  integration,
  categoryLabel,
  displayStatus,
  compliance,
  canConfigure,
  onPress,
  onConfigure,
}: ConnectProviderListRowProps) {
  const activatable = canActivateConnectIntegration(integration, canConfigure);
  const userHint = getConnectUserDisplayHint(categoryKey, integration);

  return (
    <PremiumCard accentColor={colors.cyanSoft}>
      <View style={styles.row}>
        <View style={styles.content}>
          <Text style={styles.title}>{integration.label}</Text>
          <Text style={styles.meta}>{categoryLabel}</Text>
          <Text style={styles.description}>{integration.description}</Text>
          {canConfigure ? (
            <PremiumBadge
              label={CONNECT_DISPLAY_STATUS_LABELS[displayStatus]}
              variant={displayStatus === 'not_configured' ? 'orange' : 'cyan'}
            />
          ) : (
            <Text style={styles.userHint}>{userHint}</Text>
          )}
          <View style={styles.flags}>
            <Flag label="Sandbox" ok={compliance.supportsSandbox} />
            <Flag label="Produktiv" ok={compliance.supportsProduction} />
            <Flag label="AVV" ok={!compliance.requiresAvv} warn={compliance.requiresAvv} />
            <Flag
              label="Gesundheitsdaten"
              ok={!compliance.mayTransferHealthData}
              warn={compliance.mayTransferHealthData}
            />
            <Flag label="Vertrag" ok={!compliance.requiresContract} warn={compliance.requiresContract} />
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <PremiumButton title="Mehr erfahren" size="sm" variant="ghost" onPress={onPress} />
        {canConfigure ? (
          <PremiumButton title="Konfigurieren" size="sm" variant="secondary" onPress={onConfigure} />
        ) : null}
        {activatable ? (
          <PremiumButton title="Aktivieren" size="sm" variant="primary" disabled />
        ) : (
          <PremiumButton title="Aktivieren" size="sm" variant="primary" disabled />
        )}
      </View>
    </PremiumCard>
  );
}

function Flag({ label, ok, warn }: { label: string; ok: boolean; warn?: boolean }) {
  const text = warn ? `${label}: ja` : ok ? `${label}: möglich` : `${label}: nein`;
  return <Text style={[styles.flag, warn && styles.flagWarn]}>{text}</Text>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  content: { flex: 1, gap: spacing.xs },
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textMuted },
  description: { ...typography.caption, color: colors.textSecondary },
  userHint: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  flag: { ...typography.caption, color: colors.textMuted },
  flagWarn: { color: colors.warning },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
