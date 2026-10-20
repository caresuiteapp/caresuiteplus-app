import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LivingAreasListHero } from './LivingAreasListHero';
import { LivingAreasListTable } from './LivingAreasListTable';
import { ModuleExtensionNavStrip } from '@/components/navigation/ModuleExtensionNavStrip';
import { EmptyState, ErrorState, InfoBanner, LoadingState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { fetchLivingAreas } from '@/lib/stationaer/moduleExtensionService';
import { isStationaerExtensionLiveReady, STATIONAER_EXTENSION_PREPARED_MESSAGE } from '@/lib/stationaer/stationaerModuleConfig';
import type { LivingAreaListItem } from '@/types/modules/stationaer';
import { colors, spacing, typography } from '@/theme';

function AreaCard({ item, onPress }: { item: LivingAreaListItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <PremiumCard style={styles.card} accentColor={colors.violet}>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.meta}>Wohnbereich: {item.wing ?? '—'}</Text>
        <Text style={styles.meta}>
          Belegung: {item.occupiedBeds}/{item.capacity} · frei: {item.freeBeds}
        </Text>
        <PremiumBadge label={item.status} variant="muted" />
      </PremiumCard>
    </Pressable>
  );
}

export function LivingAreasListView() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('stationaer.livingAreas');
  const useTableLayout = isDesktop && viewMode === 'table';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchLivingAreas(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];

  const handlePress = (id: string) => {
    router.push(`/stationaer/wohnbereiche/${id}` as never);
  };

  const header = (
    <View style={styles.header}>
      <LivingAreasListHero
        items={items}
        roleKey={roleKey}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      <ModuleExtensionNavStrip productKey="stationaer" currentPath="/stationaer/wohnbereiche" />
      {!isStationaerExtensionLiveReady() ? (
        <InfoBanner title="Demo-funktional" message={STATIONAER_EXTENSION_PREPARED_MESSAGE} />
      ) : null}
    </View>
  );

  if (query.loading && items.length === 0) {
    return <LoadingState message="Zimmer und Bereiche werden geladen…" />;
  }

  if (query.error && items.length === 0) {
    return <ErrorState message={query.error} onRetry={query.refresh} />;
  }

  if (useTableLayout) {
    return (
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
        }
      >
        {header}
        {items.length === 0 ? (
          <EmptyState title="Keine Wohnbereiche" message="Es sind keine Zimmer oder Wohnbereiche hinterlegt." />
        ) : (
          <LivingAreasListTable items={items} onItemPress={handlePress} />
        )}
        <Text style={styles.footer}>{items.length} Bereiche · {roleLabel ?? 'Demo'}</Text>
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState title="Keine Wohnbereiche" message="Es sind keine Zimmer oder Wohnbereiche hinterlegt." />
      }
      renderItem={({ item }) => <AreaCard item={item} onPress={() => handlePress(item.id)} />}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm, gap: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  title: { ...typography.h3, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
  footer: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
