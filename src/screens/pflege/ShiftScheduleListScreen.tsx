import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { ShiftScheduleListCard } from '@/components/pflege/ShiftScheduleListCard';
import {
  ShiftScheduleListHero,
  SHIFT_SCHEDULE_PREPARED_MESSAGE,
} from '@/components/pflege/ShiftScheduleListHero';
import { ShiftScheduleListTable } from '@/components/pflege/ShiftScheduleListTable';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, InfoBanner, LoadingState, PremiumButton } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { fetchShiftScheduleList } from '@/lib/pflege/shiftScheduleService';
import {
  isShiftScheduleImportReady,
  SHIFT_SCHEDULE_IMPORT_PREPARED_MESSAGE,
} from '@/lib/pflege/pflegeModuleConfig';
import { colors, spacing } from '@/theme';

export function ShiftScheduleListScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, isReadOnly } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('pflege.shifts');
  const useTableLayout = isDesktop && viewMode === 'table';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchShiftScheduleList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];
  const importReady = isShiftScheduleImportReady();

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title="Dienstpläne" subtitle="Wird geladen…">
        <LoadingState message="Schichtplan wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title="Dienstpläne" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const header = (
    <View style={styles.header}>
      <ShiftScheduleListHero
        items={items}
        roleKey={roleKey}
        isReadOnly={isReadOnly}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      <PreparedModeBanner hint={SHIFT_SCHEDULE_PREPARED_MESSAGE} />
      {!importReady ? (
        <InfoBanner
          variant="warning"
          title="Import extern"
          message={SHIFT_SCHEDULE_IMPORT_PREPARED_MESSAGE}
        />
      ) : null}
      <PremiumButton
        title="Dienstplan importieren"
        variant="secondary"
        fullWidth
        disabled={!importReady || isReadOnly}
        onPress={() => undefined}
      />
    </View>
  );

  if (useTableLayout) {
    return (
      <ScreenShell title="Dienstpläne" subtitle={`Schichtplanung · ${roleLabel ?? 'Demo'}`} scroll={false}>
        <ScrollView
          contentContainerStyle={styles.tableScroll}
          refreshControl={
            <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
          }
        >
          {header}
          {items.length === 0 ? (
            <EmptyState
              title="Keine Schichten"
              message="Für diesen Zeitraum sind noch keine Dienstpläne hinterlegt."
            />
          ) : (
            <ShiftScheduleListTable items={items} />
          )}
        </ScrollView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Dienstpläne" subtitle={`Schichtplanung · ${roleLabel ?? 'Demo'}`} scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            title="Keine Schichten"
            message="Für diesen Zeitraum sind noch keine Dienstpläne hinterlegt."
          />
        }
        renderItem={({ item }) => <ShiftScheduleListCard item={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
        }
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm, gap: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  tableScroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
});
