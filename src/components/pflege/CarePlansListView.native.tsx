// Generated native presentation from src/components/pflege/CarePlansListView.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { CarePlanListCard } from './CarePlanListCard';
import { CarePlansListHero } from './CarePlansListHero';
import { CarePlansListTable } from './CarePlansListTable';
import { LockedActionBanner } from '@/components/permissions';
import { EmptyState, ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput, SuccessState, } from '@/components/ui';
import { buildCarePlanListKpis } from '@/lib/pflege/carePlanListStats';
import { useCarePlanList } from "../../hooks/useCarePlanList.native.ts";
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useTableColumnSort } from '@/lib/table/tableColumnSort';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing, typography } from '@/theme';
type CarePlansListViewProps = {
    onPlanPress?: (id: string) => void;
    selectedId?: string | null;
    embedded?: boolean;
};
export function CarePlansListView(props: CarePlansListViewProps & {
    list?: ReturnType<typeof useCarePlanList>;
}) {
    return props.list ? <CarePlansListContent {...props} list={props.list}/> : <OwnedCarePlansListView {...props}/>;
}
function OwnedCarePlansListView(props: CarePlansListViewProps) {
    const list = useCarePlanList();
    return <CarePlansListContent {...props} list={list}/>;
}
function CarePlansListContent({ onPlanPress, selectedId = null, embedded = false, list }: CarePlansListViewProps & {
    list: ReturnType<typeof useCarePlanList>;
}) {
    const router = useRouter();
    const { profile } = useAuth();
    const { can, roleLabel, check } = usePermissions();
    const isReadOnly = !can('pflege.plans.manage');
    const { shellVariant } = usePlatformLayout();
    const deviceClass = useDeviceClass();
    const isDesktop = isDesktopClass(deviceClass);
    const { viewMode, setViewMode } = useDesktopListViewPreference('pflege.plans');
    const useTableLayout = isDesktop && viewMode === 'table';
    const canView = can('pflege.plans.view');
    const canCreate = can('pflege.plans.manage');
    const roleKey = profile?.roleKey ?? 'nurse';
    const { items, totalCount, filteredCount, loading, error, refreshing, showSuccess, search, setSearch, statusFilter, setStatusFilter, sortKey, setSortKey, sortOptions, statusFilters, hasMore, loadMore, refresh, resetFilters, hasActiveFilters, isEmpty, isFilterEmpty, allItems, isCurrent, isCurrentItem, } = list;
    const kpis = useMemo(() => buildCarePlanListKpis(allItems), [allItems]);
    const compactHero = embedded || shellVariant === 'desktop';
    const tableSort = useTableColumnSort(sortKey, setSortKey, sortOptions, {
        client: 'clientName',
    });
    const handlePlanPress = (id: string) => {
        if (!isCurrentItem(id))
            return;
        if (onPlanPress) {
            onPlanPress(id);
            return;
        }
        router.push(`/pflege/plans/${id}` as never);
    };
    const handleCreate = () => { if (isCurrent() && can('pflege.plans.manage'))
        router.push('/pflege/plans/create' as never); };
    if (!canView) {
        return (<LockedActionBanner message={check('pflege.plans.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel}/>);
    }
    const toolbar = (<View style={styles.toolbar}>
      {embedded ? (<View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Pflegepläne</Text>
          <Text style={styles.embeddedMeta}>
            {filteredCount} von {totalCount}
          </Text>
        </View>) : (<CarePlansListHero kpis={kpis} roleKey={roleKey} filteredCount={filteredCount} totalCount={totalCount} canCreate={canCreate} isReadOnly={isReadOnly} onCreatePress={handleCreate} compact={compactHero} viewMode={viewMode} onViewModeChange={setViewMode} showViewToggle={isDesktop && !embedded}/>)}

      {showSuccess ? <SuccessState message="Liste erfolgreich aktualisiert."/> : null}

      <PremiumInput label="Suche" placeholder="Titel oder Klient:in…" value={search} onChangeText={setSearch} autoCapitalize="words" autoCorrect={false} hint={`${filteredCount} von ${totalCount} Pflegeplänen`}/>

      <Text style={styles.filterLabel}>Status</Text>
      <FilterChipGroup options={statusFilters} value={statusFilter} onChange={setStatusFilter}/>

      <Text style={styles.filterLabel}>Sortierung</Text>
      <FilterChipGroup options={sortOptions} value={sortKey} onChange={setSortKey}/>
    </View>);
    if (loading && items.length === 0) {
        return (<View style={styles.container}>
        <LoadingState message="Pflegepläne werden geladen…"/>
      </View>);
    }
    if (error && items.length === 0 && totalCount === 0) {
        return (<View style={styles.container}>
        <ErrorState message={error} onRetry={refresh}/>
      </View>);
    }
    const emptyContent = isEmpty ? (<EmptyState title="Noch keine Pflegepläne" message={canCreate
            ? 'Legen Sie den ersten Pflegeplan an, um mit der Planung zu beginnen.'
            : `Noch keine Pflegepläne vorhanden. Anlegen ist für ${roleLabel ?? 'Ihre Rolle'} nicht freigegeben.`} actionLabel={canCreate ? 'Pflegeplan anlegen' : undefined} onAction={canCreate ? handleCreate : undefined}/>) : isFilterEmpty ? (<EmptyState title="Keine Treffer" message="Für Ihre Suche oder Filter wurden keine Pflegepläne gefunden." actionLabel="Filter zurücksetzen" onAction={resetFilters}/>) : null;
    const footerContent = hasMore ? (<PremiumButton title="Weitere laden" variant="secondary" fullWidth onPress={loadMore} style={styles.loadMore}/>) : filteredCount > 0 ? (<Text style={styles.footer}>
        {items.length} von {filteredCount} Pflegeplänen angezeigt
        {hasActiveFilters ? ' (gefiltert)' : ''}
      </Text>) : null;
    if (useTableLayout) {
        return (<View style={styles.container}>
        <ScrollView style={styles.flatList} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary}/>}>
          {toolbar}
          {emptyContent ?? (<>
              <CarePlansListTable plans={items} selectedId={selectedId} onPlanPress={handlePlanPress} onOpenDetail={(id) => { if (isCurrentItem(id))
                router.push(`/pflege/plans/${id}` as never); }} sortColumnKey={tableSort.sortColumnKey} sortDirection={tableSort.sortDirection} onSortColumn={tableSort.onSortColumn}/>
              {footerContent}
            </>)}
        </ScrollView>
        {embedded && canCreate ? (<View style={styles.embeddedCta}>
            <PremiumButton title="+ Neu" size="sm" onPress={handleCreate}/>
          </View>) : null}
      </View>);
    }
    return (<View style={styles.container}>
      <FlatList style={styles.flatList} data={items} keyExtractor={(item) => item.id} ListHeaderComponent={toolbar} ListEmptyComponent={emptyContent} ListFooterComponent={footerContent} renderItem={({ item }) => (<CarePlanListCard plan={item} selected={selectedId === item.id} onPress={() => handlePlanPress(item.id)}/>)} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary}/>}/>
      {embedded && canCreate ? (<View style={styles.embeddedCta}>
          <PremiumButton title="+ Neu" size="sm" onPress={handleCreate}/>
        </View>) : null}
    </View>);
}
const styles = StyleSheet.create({
    container: { flex: 1 },
    flatList: { flex: 1 },
    toolbar: { gap: spacing.sm, marginBottom: spacing.md },
    filterLabel: { ...typography.label, marginTop: spacing.xs },
    list: { paddingBottom: spacing.xxl },
    loadMore: { marginTop: spacing.sm, marginBottom: spacing.md },
    footer: { ...typography.caption, textAlign: 'center', marginVertical: spacing.md },
    embeddedCta: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.md,
        zIndex: 2,
    },
    embeddedHeader: {
        marginBottom: spacing.xs,
        paddingRight: spacing.xxl,
    },
    embeddedTitle: { ...typography.h3 },
    embeddedMeta: { ...typography.caption, color: colors.textMuted },
});
