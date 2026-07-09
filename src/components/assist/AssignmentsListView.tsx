import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { AssignmentCreateForm } from './AssignmentCreateForm';
import { AssignmentsListHero } from './AssignmentsListHero';
import { AssignmentsListTable } from './AssignmentsListTable';
import { AssignmentsCardGrid } from './AssignmentsCardGrid';
import { ASSIGNMENT_DATE_RANGE_FILTERS } from '@/lib/assist/assignmentListFilters';
import {
  AssignmentMobileActionSheet,
  type AssignmentMobileAction,
} from './AssignmentMobileActionSheet';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SuccessState,
  DesktopListViewToggle,
} from '@/components/ui';
import { buildVisitDispositionKpis } from '@/lib/assist/visitService';
import { auroraGlass, useAuroraGlassPanelStyle } from '@/design/tokens/auroraGlass';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useAssignmentList } from '@/hooks/useAssignmentList';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { useFinePointerHover } from '@/hooks/useFinePointerHover';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useTableColumnSort } from '@/lib/table/tableColumnSort';
import { useAuth } from '@/lib/auth/context';
import { getServiceMode } from '@/lib/services/mode';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import type { AssignmentListItem } from '@/types/modules/assist';
import { spacing } from '@/theme';

type AssignmentsListViewProps = {
  onAssignmentPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
  /** Increment to trigger list refresh (e.g. after delete from preview modal). */
  externalRefreshKey?: number;
  /** Controlled create-form visibility (e.g. shell action or ?create=1). */
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
};

export function AssignmentsListView({
  onAssignmentPress,
  selectedId = null,
  embedded = false,
  externalRefreshKey = 0,
  createOpen,
  onCreateOpenChange,
}: AssignmentsListViewProps) {
  const router = useRouter();
  const [internalCreateOpen, setInternalCreateOpen] = useState(false);
  const [mobileSheetAssignment, setMobileSheetAssignment] = useState<AssignmentListItem | null>(
    null,
  );
  const wizardVisible = createOpen ?? internalCreateOpen;
  const setWizardVisible = onCreateOpenChange ?? setInternalCreateOpen;
  const shellHostsAurora = useShellHostsAurora();
  const panelStyle = useAuroraGlassPanelStyle();
  const { profile } = useAuth();
  const { can, isReadOnly, roleLabel, check } = usePermissions();
  const { shellVariant } = usePlatformLayout();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const canFinePointerHover = useFinePointerHover();
  const isMobile = !isDesktop;
  const { viewMode, setViewMode } = useDesktopListViewPreference('assist.assignments.v2', 'cards');
  const useTableLayout = isDesktop && viewMode === 'table';
  const canView = can('assist.assignments.view');
  const canManage = can('assist.assignments.manage') && !isReadOnly;
  const roleKey = profile?.roleKey ?? 'dispatch';
  const openCreate = () => setWizardVisible(true);

  const navigateToAssignment = useCallback(
    (id: string) => {
      if (onAssignmentPress) {
        onAssignmentPress(id);
        return;
      }
      router.push(`/assist/assignments/${id}` as never);
    },
    [onAssignmentPress, router],
  );

  const {
    items,
    totalCount,
    filteredCount,
    loading,
    error,
    refreshing,
    showSuccess,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    dateRange,
    setDateRange,
    employeeFilter,
    setEmployeeFilter,
    employeeOptions,
    serviceFilter,
    setServiceFilter,
    serviceOptions,
    sortKey,
    setSortKey,
    sortOptions,
    statusFilters,
    hasMore,
    loadMore,
    refresh,
    resetFilters,
    hasActiveFilters,
    isEmpty,
    isFilterEmpty,
    allItems,
  } = useAssignmentList();

  useEffect(() => {
    if (externalRefreshKey > 0) {
      void refresh();
    }
  }, [externalRefreshKey, refresh]);

  const kpis = useMemo(
    () =>
      buildVisitDispositionKpis(
        allItems.map((item) => ({
          id: item.id,
          tenantId: item.tenantId,
          title: item.title,
          serviceName: item.serviceName ?? item.title,
          scheduledStart: item.scheduledStart,
          scheduledEnd: item.scheduledEnd,
          durationMinutes: item.durationMinutes ?? null,
          status: item.status,
          planningStatus: (item.planningStatus as 'draft') ?? 'scheduled',
          proofStatus: (item.proofStatus as 'none') ?? 'none',
          billingStatus: (item.billingStatus as 'none') ?? 'none',
          location: item.location,
          clientName: item.clientName,
          employeeName: item.employeeName,
          isAtRisk: item.isAtRisk ?? false,
          isIncomplete: item.isIncomplete ?? false,
          updatedAt: item.updatedAt,
        })),
      ),
    [allItems],
  );
  const compactHero = embedded || shellVariant === 'desktop';
  const tableSort = useTableColumnSort(sortKey, setSortKey, sortOptions, {
    weekday: 'scheduledStart',
    date: 'scheduledStart',
    timeRange: 'scheduledStart',
    client: 'clientName',
  });
  const { colors, typography } = useLegacyTheme();
  const isLive = getServiceMode() === 'supabase';
  const webGlassBlur =
    Platform.OS === 'web'
      ? ({
          backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
          WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        } as unknown as ViewStyle)
      : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: 'transparent' },
        flatList: { flex: 1, backgroundColor: 'transparent' },
        listPanel: {
          flex: 1,
          borderRadius: 12,
          minWidth: 0,
          ...webGlassBlur,
        },
        flatListWeb: Platform.OS === 'web' ? ({ minWidth: 0 } as ViewStyle) : null,
        toolbar: { gap: spacing.sm, marginBottom: spacing.md, backgroundColor: 'transparent' },
        filterLabel: {
          ...typography.label,
          marginTop: spacing.xs,
          color: colors.textSecondary,
        },
        list: { paddingBottom: spacing.xxl, backgroundColor: 'transparent' },
        loadMore: { marginTop: spacing.sm, marginBottom: spacing.md },
        footer: {
          ...typography.caption,
          textAlign: 'center',
          marginVertical: spacing.md,
          color: colors.textMuted,
        },
        embeddedHeader: {
          marginBottom: spacing.xs,
          paddingRight: spacing.xxl,
        },
        embeddedTitle: { ...typography.h3, color: colors.textPrimary },
        embeddedMeta: { ...typography.caption, color: colors.textMuted },
        filterRows: { gap: spacing.xs },
        filterPairRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.md,
        },
        filterHalf: {
          flex: 1,
          minWidth: 200,
          gap: spacing.xs,
        },
        viewToggleRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginBottom: spacing.xs,
        },
      }),
    [colors, typography, webGlassBlur],
  );

  const buildMobileActions = useCallback(
    (assignment: AssignmentListItem): AssignmentMobileAction[] => [
      {
        key: 'start',
        label: 'Einsatz starten',
        variant: 'primary',
        onPress: () => router.push(`/assist/assignments/${assignment.id}/execute` as never),
      },
      {
        key: 'edit',
        label: 'Bearbeiten',
        onPress: () => navigateToAssignment(assignment.id),
      },
      {
        key: 'open',
        label: 'Öffnen',
        onPress: () => navigateToAssignment(assignment.id),
      },
      {
        key: 'docs',
        label: 'Dokumentation',
        onPress: () => navigateToAssignment(assignment.id),
      },
      {
        key: 'attachments',
        label: 'Anhänge',
        onPress: () => navigateToAssignment(assignment.id),
      },
      {
        key: 'nav',
        label: 'Navigation',
        onPress: () => navigateToAssignment(assignment.id),
      },
      {
        key: 'call',
        label: 'Anrufen',
        onPress: () => navigateToAssignment(assignment.id),
      },
      {
        key: 'message',
        label: 'Nachricht',
        onPress: () => navigateToAssignment(assignment.id),
      },
      {
        key: 'route',
        label: 'Route',
        onPress: () => navigateToAssignment(assignment.id),
      },
      {
        key: 'proof',
        label: 'Nachweis',
        onPress: () => navigateToAssignment(assignment.id),
      },
    ],
    [navigateToAssignment, router],
  );

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('assist.assignments.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  const toolbar = (
    <View style={styles.toolbar}>
      {isDesktop && !embedded ? (
        <View style={styles.viewToggleRow}>
          <DesktopListViewToggle value={viewMode} onChange={setViewMode} />
        </View>
      ) : null}

      {embedded ? (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Einsatzplanung</Text>
          <Text style={styles.embeddedMeta}>
            {filteredCount} von {totalCount}
          </Text>
        </View>
      ) : (
        <AssignmentsListHero
          kpis={kpis}
          roleKey={roleKey}
          tenantLabel={isLive ? 'Live-Mandant' : undefined}
          filteredCount={filteredCount}
          totalCount={totalCount}
          isReadOnly={isReadOnly}
          compact={compactHero}
          onCalendarPress={() => router.push('/assist/kalender' as never)}
        />
      )}

      {canManage ? (
        <PremiumButton
          title="Neuer Einsatz"
          onPress={openCreate}
          style={{ marginBottom: spacing.xs }}
        />
      ) : null}

      <AssignmentCreateForm
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onCreated={(id) => {
          setWizardVisible(false);
          navigateToAssignment(id);
          void refresh();
        }}
      />

      {showSuccess ? <SuccessState message="Liste erfolgreich aktualisiert." /> : null}

      <PremiumInput
        label="Suche"
        placeholder="Klient, Mitarbeiter, Adresse, Einsatznummer…"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="words"
        autoCorrect={false}
        hint={`${filteredCount} von ${totalCount} Einsätzen`}
      />

      <View style={styles.filterRows}>
        <Text style={styles.filterLabel}>Zeitraum</Text>
        <FilterChipGroup
          options={ASSIGNMENT_DATE_RANGE_FILTERS}
          value={dateRange}
          onChange={setDateRange}
        />

        <Text style={styles.filterLabel}>Status</Text>
        <FilterChipGroup options={statusFilters} value={statusFilter} onChange={setStatusFilter} />

        <View style={styles.filterPairRow}>
          <View style={styles.filterHalf}>
            <Text style={styles.filterLabel}>Mitarbeiter:in</Text>
            <FilterChipGroup
              options={employeeOptions}
              value={employeeFilter}
              onChange={setEmployeeFilter}
            />
          </View>
          <View style={styles.filterHalf}>
            <Text style={styles.filterLabel}>Leistung</Text>
            <FilterChipGroup
              options={serviceOptions}
              value={serviceFilter}
              onChange={setServiceFilter}
            />
          </View>
        </View>

        <Text style={styles.filterLabel}>Sortierung</Text>
        <FilterChipGroup options={sortOptions} value={sortKey} onChange={setSortKey} />
      </View>
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        {!embedded ? toolbar : null}
        <LoadingState message="Einsätze werden geladen…" />
      </View>
    );
  }

  if (error && items.length === 0 && totalCount === 0) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={refresh} />
      </View>
    );
  }

  const emptyContent = isEmpty ? (
    <EmptyState
      title="Noch keine Einsätze"
      message={
        isLive
          ? 'Für diesen Mandanten sind noch keine Einsätze geplant.'
          : 'Es sind keine Einsätze im Demo-Mandanten hinterlegt.'
      }
      actionLabel={canManage ? 'Einsatz planen' : undefined}
      onAction={canManage ? openCreate : undefined}
    />
  ) : isFilterEmpty ? (
    <EmptyState
      title="Keine Treffer"
      message="Für Ihre Suche oder Filter wurden keine Einsätze gefunden."
      actionLabel="Filter zurücksetzen"
      onAction={resetFilters}
    />
  ) : null;

  const footerContent =
    hasMore ? (
      <PremiumButton
        title="Weitere laden"
        variant="secondary"
        fullWidth
        onPress={loadMore}
        style={styles.loadMore}
      />
    ) : filteredCount > 0 ? (
      <Text style={styles.footer}>
        {filteredCount} Einsätze angezeigt
        {hasActiveFilters ? ' (gefiltert)' : ''}
      </Text>
    ) : null;

  const cardGrid = (
    <AssignmentsCardGrid
      assignments={items}
      selectedId={selectedId}
      showHoverDetails={isDesktop && canFinePointerHover}
      showInlineActions={isDesktop}
      onOpen={navigateToAssignment}
      onStart={(id) => router.push(`/assist/assignments/${id}/execute` as never)}
      onEdit={navigateToAssignment}
      onMore={(id) => navigateToAssignment(id)}
      onCardTap={
        isMobile
          ? (assignment) => setMobileSheetAssignment(assignment)
          : undefined
      }
      ListHeaderComponent={toolbar}
      ListEmptyComponent={emptyContent}
      ListFooterComponent={footerContent}
    />
  );

  const tableView = (
    <ScrollView
      style={[styles.flatList, styles.flatListWeb]}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
    >
      {toolbar}
      {emptyContent ?? (
        <>
          <AssignmentsListTable
            assignments={items}
            selectedId={selectedId}
            onAssignmentPress={navigateToAssignment}
            onOpenDetail={navigateToAssignment}
            sortColumnKey={tableSort.sortColumnKey}
            sortDirection={tableSort.sortDirection}
            onSortColumn={tableSort.onSortColumn}
          />
          {footerContent}
        </>
      )}
    </ScrollView>
  );

  const cardScrollView = (
    <ScrollView
      style={[styles.flatList, styles.flatListWeb]}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
    >
      {cardGrid}
    </ScrollView>
  );

  const body = useTableLayout ? tableView : cardScrollView;

  return (
    <View style={styles.container}>
      {shellHostsAurora ? (
        <View style={[styles.listPanel, panelStyle]}>{body}</View>
      ) : (
        body
      )}
      <AssignmentMobileActionSheet
        visible={mobileSheetAssignment != null}
        assignment={mobileSheetAssignment}
        onClose={() => setMobileSheetAssignment(null)}
        actions={mobileSheetAssignment ? buildMobileActions(mobileSheetAssignment) : []}
      />
    </View>
  );
}
