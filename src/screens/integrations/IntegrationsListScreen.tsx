import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { IntegrationsHubHero } from '@/components/integrations';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
} from '@/components/ui';
import { useIntegrationList } from '@/hooks/useIntegrationList';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import {
  INTEGRATIONS_PREPARED_MESSAGE,
  isIntegrationsLiveReady,
} from '@/lib/integrations/integrationsModuleConfig';
import {
  INTEGRATION_CATEGORY_LABELS,
  INTEGRATION_STATUS_LABELS,
} from '@/types/modules/integrations';
import { colors, spacing, typography } from '@/theme';

export function IntegrationsListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { items, loading, error, refresh } = useIntegrationList();

  if (!can('integrations.view')) {
    return (
      <ScreenShell title="Integrationen" subtitle={roleLabel ?? 'Betrieb'} showBack={false}>
        <LockedActionBanner
          message={check('integrations.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Integrationen"
      subtitle="Anbieter & Schnittstellen"
      showBack={false}
      rightSlot={
        <PremiumButton
          title="Outbox"
          size="sm"
          variant="ghost"
          onPress={() => router.push('/business/integrations/outbox' as never)}
        />
      }
    >
      {loading && items.length === 0 ? (
        <LoadingState message="Integrationen werden geladen…" />
      ) : error && items.length === 0 ? (
        <ErrorState title="Fehler" message={error} onRetry={refresh} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.scroll}
        >
          {items.length > 0 ? <IntegrationsHubHero items={items} roleKey={roleKey} /> : null}

          {!isIntegrationsLiveReady() ? (
            <InfoBanner title="Live-Sync in Vorbereitung" message={INTEGRATIONS_PREPARED_MESSAGE} />
          ) : null}

          {items.length === 0 ? (
            <EmptyState title="Keine Integrationen" message="Keine Anbieter konfiguriert." />
          ) : (
            items.map((item) => (
              <PremiumCard
                key={item.id}
                accentColor={item.status === 'active' ? colors.success : colors.orange}
                onPress={() => router.push(`/business/integrations/${item.id}` as never)}
              >
                <View style={styles.row}>
                  <Text style={styles.title}>{item.name}</Text>
                  <PremiumBadge
                    label={INTEGRATION_STATUS_LABELS[item.status]}
                    variant={item.status === 'active' ? 'green' : 'orange'}
                  />
                </View>
                <Text style={styles.meta}>
                  {INTEGRATION_CATEGORY_LABELS[item.category]}
                </Text>
              </PremiumCard>
            ))
          )}
        </ScrollView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, color: colors.textSecondary },
});
