import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { InfoBanner, PremiumButton } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import {
  CONNECT_PREPARED_BLOCK_TEXT,
  CONNECT_PREPARED_BLOCK_TITLE,
  type ConnectFeatureGateCode,
} from '@/types/connect/featureGate';
import { colors, spacing, typography } from '@/theme';

const INFO_URL = 'https://caresuiteplus.de/hilfe/connect';

type ConnectPreparedBlockScreenProps = {
  code?: ConnectFeatureGateCode;
  message?: string;
  featureLabel?: string;
};

export function ConnectPreparedBlockScreen({
  code,
  message,
  featureLabel,
}: ConnectPreparedBlockScreenProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const isAdmin = can('connect.configure');

  return (
    <ScreenShell
      title={CONNECT_PREPARED_BLOCK_TITLE}
      subtitle={featureLabel ?? 'CareSuite+ Connect'}
    >
      <View style={styles.content}>
        <InfoBanner
          variant="warning"
          title={CONNECT_PREPARED_BLOCK_TITLE}
          message={message ?? CONNECT_PREPARED_BLOCK_TEXT}
        />
        {code ? (
          <Text style={styles.codeHint}>Code: {code}</Text>
        ) : null}
        <View style={styles.actions}>
          <PremiumButton
            title="Zurück zu Connect"
            variant="primary"
            onPress={() => router.replace('/business/connect' as never)}
          />
          {isAdmin ? (
            <PremiumButton
              title="Admin-Einstellungen öffnen"
              variant="secondary"
              onPress={() => router.push('/business/connect/providers' as never)}
            />
          ) : null}
          <PremiumButton
            title="Mehr Informationen"
            variant="ghost"
            onPress={() => router.push(INFO_URL as never)}
          />
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl },
  codeHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
