import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ConnectIntegrationRow, ConnectPreparedBanner } from '@/components/connect';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, PremiumButton } from '@/components/ui';
import { useConnectCatalog } from '@/hooks/useConnectCatalog';
import { usePermissions } from '@/hooks/usePermissions';
import { spacing } from '@/theme';

export function ConnectCategoryScreen() {
  const { category: categoryKey } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const { getCategory, getVisibleIntegrations } = useConnectCatalog();
  const category = categoryKey ? getCategory(categoryKey) : undefined;
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

  if (!category) {
    return (
      <ScreenShell title="Connect" subtitle="Kategorie">
        <EmptyState title="Kategorie nicht gefunden" message="Der gewählte Connect-Bereich existiert nicht." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={category.label} subtitle={category.description}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ConnectPreparedBanner />

        {integrations.length === 0 ? (
          <EmptyState
            title="Keine Schnittstellen"
            message="In dieser Kategorie sind derzeit keine Schnittstellen sichtbar."
          />
        ) : (
          integrations.map((integration) => (
            <ConnectIntegrationRow
              key={integration.key}
              integration={integration}
              onPress={() =>
                router.push(`/business/connect/${category.key}/${integration.key}` as never)
              }
            />
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.sm, paddingBottom: spacing.xxl },
});
