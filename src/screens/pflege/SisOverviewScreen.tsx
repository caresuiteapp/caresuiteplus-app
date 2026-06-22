import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { SisOverviewHero, SIS_PREPARED_MESSAGE } from '@/components/pflege/SisOverviewHero';
import { SisOverviewListTable } from '@/components/pflege/SisOverviewListTable';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isSisWriteReady } from '@/lib/pflege/pflegeModuleConfig';
import { fetchSisAssessments } from '@/lib/pflege/sisListService';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import type { SisAssessment } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

function SisCard({ item, onPress }: { item: SisAssessment; onPress?: () => void }) {
  const reviewLabel = item.nextReviewAt
    ? new Date(item.nextReviewAt).toLocaleDateString('de-DE')
    : '—';

  return (
    <PremiumCard style={styles.card} accentColor={colors.violet} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{item.clientName}</Text>
        <Text style={styles.scoreBadge}>{`${item.overallScore} Pkt.`}</Text>
      </View>
      <Text style={styles.meta}>
        Bewertet: {new Date(item.assessedAt).toLocaleDateString('de-DE')} · {item.assessorName}
      </Text>
      <Text style={styles.meta}>Nächste Prüfung: {reviewLabel}</Text>
      <Text style={styles.statusLabel}>{WORKFLOW_STATUS_LABELS[item.status] ?? item.status}</Text>
    </PremiumCard>
  );
}

export function SisOverviewScreen() {
  const router = useRouter();
  const pageTitle = 'SIS-Übersicht';
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, isReadOnly } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('pflege.sis');
  const useTableLayout = isDesktop && viewMode === 'table';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchSisAssessments(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];

  const openDetail = (id: string) => {
    router.push(`/pflege/sis/${id}` as never);
  };

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title={pageTitle} subtitle="Wird geladen…">
        <LoadingState message="SIS-Assessments werden geladen…" />
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
      <SisOverviewHero
        items={items}
        roleKey={roleKey}
        isReadOnly={isReadOnly}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      <PreparedModeBanner hint={SIS_PREPARED_MESSAGE} />
    </View>
  );

  if (useTableLayout) {
    return (
      <ScreenShell
        title={pageTitle}
        subtitle={`Strukturierte Information · ${roleLabel ?? 'Demo'}`}
        rightSlot={
          !isReadOnly ? (
            <PremiumButton
              title="+ Neu"
              size="sm"
              onPress={() => router.push('/pflege/sis/create' as never)}
            />
          ) : undefined
        }
        scroll={false}
      >
        <ScrollView
          contentContainerStyle={styles.tableScroll}
          refreshControl={
            <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
          }
        >
          {header}
          {items.length === 0 ? (
            <EmptyState
              title="Keine SIS-Assessments"
              message="Für diesen Mandanten sind noch keine strukturierten Assessments hinterlegt."
            />
          ) : (
            <SisOverviewListTable items={items} onOpenDetail={openDetail} />
          )}
        </ScrollView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={pageTitle}
      subtitle={`Strukturierte Information · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        !isReadOnly ? (
          <PremiumButton
            title="+ Neu"
            size="sm"
            onPress={() => router.push('/pflege/sis/create' as never)}
          />
        ) : undefined
      }
      scroll={false}
    >
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            title="Keine SIS-Assessments"
            message="Für diesen Mandanten sind noch keine strukturierten Assessments hinterlegt."
          />
        }
        renderItem={({ item }) => <SisCard item={item} onPress={() => openDetail(item.id)} />}
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
  card: { marginBottom: spacing.sm },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h3, flex: 1, marginRight: spacing.sm },
  scoreBadge: { ...typography.caption, color: colors.cyan },
  statusLabel: { ...typography.caption, color: colors.textMuted },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
});
