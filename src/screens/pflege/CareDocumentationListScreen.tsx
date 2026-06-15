import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { CareDocumentationListCard } from '@/components/pflege/CareDocumentationListCard';
import {
  CareDocumentationListHero,
  CARE_DOCUMENTATION_PREPARED_MESSAGE,
} from '@/components/pflege/CareDocumentationListHero';
import { CareDocumentationListTable } from '@/components/pflege/CareDocumentationListTable';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { fetchCareDocumentationList } from '@/lib/pflege/careDocumentationListService';
import { colors, spacing } from '@/theme';

export function CareDocumentationListScreen() {
  const router = useRouter();
  const pageTitle = 'Pflegedokumentation';
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, isReadOnly } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('pflege.documentation');
  const useTableLayout = isDesktop && viewMode === 'table';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCareDocumentationList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];
  const openDetail = (id: string) => router.push(`/pflege/dokumentation/${id}` as never);

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title={pageTitle} subtitle="Wird geladen…">
        <LoadingState message="Nachweise werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title={pageTitle} subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const header = (
    <View style={styles.header}>
      <CareDocumentationListHero
        items={items}
        roleKey={roleKey}
        isReadOnly={isReadOnly}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      <PreparedModeBanner hint={CARE_DOCUMENTATION_PREPARED_MESSAGE} />
    </View>
  );

  if (useTableLayout) {
    return (
      <ScreenShell title={pageTitle} subtitle={`Pflegenachweise · ${roleLabel ?? 'Demo'}`} scroll={false}>
        <ScrollView
          contentContainerStyle={styles.tableScroll}
          refreshControl={
            <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
          }
        >
          {header}
          {items.length === 0 ? (
            <EmptyState
              title="Keine Nachweise"
              message="Für diesen Mandanten sind noch keine Pflegedokumentationen hinterlegt."
            />
          ) : (
            <CareDocumentationListTable items={items} onOpenDetail={openDetail} />
          )}
        </ScrollView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={pageTitle} subtitle={`Pflegenachweise · ${roleLabel ?? 'Demo'}`} scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            title="Keine Nachweise"
            message="Für diesen Mandanten sind noch keine Pflegedokumentationen hinterlegt."
          />
        }
        renderItem={({ item }) => (
          <CareDocumentationListCard item={item} onPress={() => openDetail(item.id)} />
        )}
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
