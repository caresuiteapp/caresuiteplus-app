import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ConnectPreparedBanner, ConnectProviderListRow } from '@/components/connect';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, InfoBanner, PremiumButton } from '@/components/ui';
import { useConnectDashboard } from '@/hooks/useConnectDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { CONNECT_DISPLAY_STATUS_LABELS } from '@/lib/connect/connectPresentation';
import { spacing } from '@/theme';

export function ConnectCategoryScreen() {
  const { category: categoryKey } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const { categories, getCategoryStats, getVisibleIntegrations, getIntegrationView } =
    useConnectDashboard();
  const category = categoryKey ? categories.find((item) => item.key === categoryKey) : undefined;
  const stats = categoryKey ? getCategoryStats(categoryKey) : null;
  const integrations = categoryKey ? getVisibleIntegrations(categoryKey) : [];

  if (!can('connect.view')) {
    return (
      <ScreenShell title="Connect" subtitle={roleLabel ?? 'Betrieb'}>
        <LockedActionBanner
          message={check('connect.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (!category || !stats) {
    return (
      <ScreenShell title="Connect" subtitle="Kategorie">
        <EmptyState title="Kategorie nicht gefunden" message="Der gewählte Connect-Bereich existiert nicht." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  const canConfigure = can('connect.configure');

  return (
    <ScreenShell title={category.label} subtitle={category.description}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ConnectPreparedBanner />
        <InfoBanner
          title="Kategorie-Status"
          message={CONNECT_DISPLAY_STATUS_LABELS[stats.displayStatus]}
        />

        {integrations.length === 0 ? (
          <EmptyState
            title="Keine Schnittstellen"
            message="In dieser Kategorie sind derzeit keine Schnittstellen sichtbar."
          />
        ) : (
          integrations.map((integration) => {
            const view = getIntegrationView(category.key, integration.key);
            if (!view) return null;
            return (
              <ConnectProviderListRow
                key={integration.key}
                categoryKey={category.key}
                integration={integration}
                categoryLabel={category.label}
                displayStatus={view.displayStatus}
                compliance={view.compliance}
                canConfigure={canConfigure}
                onPress={() =>
                  router.push(`/business/connect/${category.key}/${integration.key}` as never)
                }
                onConfigure={() =>
                  router.push(
                    `/business/connect/${category.key}/${integration.key}/configure` as never,
                  )
                }
              />
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.sm, paddingBottom: spacing.xxl },
});
