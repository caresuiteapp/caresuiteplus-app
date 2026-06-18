import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IntegrationDetailHero } from '@/components/integrations';
import { DetailInfoRow } from '@/components/detail';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  SuccessState,
} from '@/components/ui';
import { useIntegrationDetail } from '@/hooks/useIntegrationDetail';
import { useAuth } from '@/lib/auth/context';
import { INTEGRATIONS_PREPARED_MESSAGE } from '@/lib/integrations/integrationsModuleConfig';
import { INTEGRATION_CATEGORY_LABELS } from '@/types/modules/integrations';
import { colors, spacing, typography } from '@/theme';

export function IntegrationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data, loading, error, refresh, toggle, toggleLoading, successMessage, notFound } =
    useIntegrationDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Integration" subtitle="Wird geladen…">
        <LoadingState message="Details werden geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error || !data) {
    return (
      <ScreenShell title="Integration" subtitle="Fehler">
        <ErrorState title="Fehler" message={error ?? 'Nicht gefunden.'} onRetry={refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={data.name}
      subtitle={INTEGRATION_CATEGORY_LABELS[data.category]}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {successMessage ? <SuccessState message={successMessage} /> : null}

        <IntegrationDetailHero integration={data} roleKey={roleKey} />

        <InfoBanner variant="warning" title="Integration preparedOnly" message={INTEGRATIONS_PREPARED_MESSAGE} />

        <DetailInfoRow label="Provider" value={data.providerKey} />
        <DetailInfoRow
          label="Secret-Referenz"
          value={data.secretReference ?? 'Nicht konfiguriert'}
        />
        {data.webhookUrl ? <DetailInfoRow label="Webhook" value={data.webhookUrl} /> : null}

        <PremiumButton
          title={data.status === 'active' ? 'Deaktivieren' : 'Aktivieren (Demo)'}
          variant="secondary"
          onPress={toggle}
          loading={toggleLoading}
        />
        <Text style={styles.hint}>
          Secrets werden nur als vault-Referenz gespeichert — keine API-Keys im Frontend.
        </Text>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  hint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
});
