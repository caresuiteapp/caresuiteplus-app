import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useClientList } from '@/hooks/useClientList';
import { usePermissions } from '@/hooks/usePermissions';
import { CLIENT_INTAKE_NEW_ROUTE, clientIntakeResumeRoute, clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { buildClientListKpis, filterClientsByCareLevel } from '@/lib/office/clientListStats';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { MobileButton, MobileChips, MobileHeading, MobileIconButton, MobileRecordRow, MobileSearch, MobileSheet, MobileState, m } from '@/components/mobile/MobileWorkspace';

type Props = { onClientPress?: (id: string) => void; onOpenDetail?: (id: string) => void; onCreatePress?: () => void; selectedId?: string | null; embedded?: boolean; refreshToken?: number };
export function ClientsListView({ onClientPress, onOpenDetail, onCreatePress, selectedId, refreshToken = 0 }: Props) {
  const list = useClientList(); const router = useRouter(); const { can, isReadOnly } = usePermissions();
  const { width, fontScale } = useWindowDimensions(); const columns = width >= 840 * fontScale ? 2 : 1;
  const [filters, setFilters] = useState(false); const [localCount, setLocalCount] = useState(20);
  const { refresh } = list;
  useEffect(() => { if (refreshToken > 0) void refresh(); }, [refreshToken, refresh]);
  useEffect(() => { setLocalCount(20); }, [list.search, list.statusFilter, list.careLevelFilter, list.costBearerFilter, list.lifecycleFilter, list.sortKey]);
  const localItems = useMemo(() => {
    if (list.isLive) return [];
    const query = list.search.trim().toLocaleLowerCase('de-DE');
    return filterClientsByCareLevel(list.allItems, list.careLevelFilter).filter(item =>
      (list.lifecycleFilter !== 'archived' || item.status === 'archiviert') &&
      (list.lifecycleFilter !== 'active' || !['archiviert', 'entwurf', 'geplant'].includes(item.status)) &&
      (list.statusFilter === 'all' || item.status === list.statusFilter) &&
      (list.costBearerFilter === 'all' || item.costCarrier?.trim() === list.costBearerFilter) &&
      (!query || [item.firstName, item.lastName, item.city, item.zip].filter(Boolean).join(' ').toLocaleLowerCase('de-DE').includes(query))
    ).sort((a, b) => (list.sortKey === 'city_asc' ? a.city ?? '' : a.lastName).localeCompare(list.sortKey === 'city_asc' ? b.city ?? '' : b.lastName, 'de', { sensitivity: 'base', numeric: true }) * (list.sortKey === 'name_desc' ? -1 : 1));
  }, [list.isLive, list.allItems, list.search, list.lifecycleFilter, list.statusFilter, list.careLevelFilter, list.costBearerFilter, list.sortKey]);
  const items = list.isLive ? list.items : localItems.slice(0, localCount);
  const count = list.isLive ? list.filteredCount : localItems.length;
  const kpis = buildClientListKpis(list.kpiItems);
  const reset = () => { list.resetFilters(); list.setLifecycleFilter(list.isLive ? 'active' : 'all'); list.setCostBearerFilter('all'); };
  const open = onOpenDetail ?? onClientPress ?? ((id: string) => router.push(clientRecordRoute(id) as never));
  if (!can('office.clients.view')) return <MobileState title="Klientenverwaltung ist geschützt" message="Für diesen Bereich fehlt Ihnen die Berechtigung." />;
  const header = <View style={[m.stack, { paddingBottom: 14 }]}>
    <MobileHeading title="Klient:innen" subtitle={`${list.totalCount} Akten${isReadOnly ? ' · Lesemodus' : ''}`} icon="folder" action={<MobileIconButton label="Klientenliste aktualisieren" icon="refresh-cw" onPress={() => void refresh()} />} />
    <View style={m.wrap}>{kpis.map(kpi => <MobileButton compact key={kpi.id} label={`${kpi.value} ${kpi.label}`} onPress={() => { reset(); list.setLifecycleFilter(kpi.id === 'clients-kpi-active' ? 'active' : 'all'); list.setStatusFilter(kpi.id === 'clients-kpi-active' ? 'aktiv' : kpi.id === 'clients-kpi-intake' ? 'in_bearbeitung' : kpi.id === 'clients-kpi-drafts' ? 'entwurf' : 'all'); }} />)}</View>
    <MobileSearch value={list.search} onChangeText={list.setSearch} label="Klient:innen suchen" placeholder="Name, Ort oder Postleitzahl" />
    <View style={m.wrap}><MobileButton compact label="Filter" icon="sliders" selected={list.hasActiveFilters} onPress={() => setFilters(true)} />{can('office.clients.create') ? <MobileButton compact primary label="Aufnehmen" icon="plus" onPress={onCreatePress ?? (() => router.push(CLIENT_INTAKE_NEW_ROUTE as never))} /> : null}{can('tenant.settings.csv.view') ? <MobileButton compact label="Import" icon="upload" onPress={() => router.push('/business/office/settings/csv-import-export' as never)} /> : null}</View>
    <Text style={m.muted}>{count} Treffer{list.isLiveConnected ? ' · Aktuell synchronisiert' : ''}</Text>
    {list.error ? <Text accessibilityRole="alert" style={m.error}>{list.error}</Text> : null}
  </View>;
  return <View style={m.grow}><FlatList key={columns} data={items} numColumns={columns} keyExtractor={item => item.id} contentContainerStyle={{ paddingBottom: 24 }} columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined} keyboardShouldPersistTaps="handled" ListHeaderComponent={header} refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void refresh()} tintColor="#1569E8" />} ItemSeparatorComponent={() => <View style={{ height: 10 }} />} renderItem={({ item }) => <View style={{ flex: 1, maxWidth: columns > 1 ? '49.5%' : '100%' }}><MobileRecordRow title={`${item.firstName} ${item.lastName}`.trim() || 'Name noch offen'} subtitle={[item.zip, item.city].filter(Boolean).join(' ') || 'Ort nicht hinterlegt'} selected={selectedId === item.id} onPress={() => (onClientPress ?? open)(item.id)}>
      <View style={m.wrap}><Text style={[m.label, { color: item.status === 'aktiv' ? '#087865' : '#526B87' }]}>{WORKFLOW_STATUS_LABELS[item.status]}</Text>{can('office.clients.view_sensitive') && item.careLevel ? <Text style={m.muted}>{formatCareLevel(item.careLevel)}</Text> : null}</View>
      {can('office.clients.view_sensitive') ? <View><Text style={m.body}>{item.costCarrier || 'Kostenträger nicht hinterlegt'}</Text><Text style={m.muted}>Versichertennummer: {item.insuranceNumber || 'nicht hinterlegt'}</Text></View> : null}
      {item.primaryContactPhone ? <Text style={m.muted}>{item.primaryContactPhone}</Text> : null}
      {item.status === 'entwurf' && can('office.clients.create') ? <MobileButton compact label="Aufnahme fortsetzen" icon="edit-3" onPress={() => router.push(clientIntakeResumeRoute(item.id) as never)} /> : null}
    </MobileRecordRow></View>} ListEmptyComponent={<MobileState title={list.loading ? 'Akten werden geladen' : list.error ? 'Akten konnten nicht geladen werden' : count ? 'Keine Akten sichtbar' : list.hasActiveFilters ? 'Keine passenden Akten' : 'Noch keine Klient:innen'} loading={list.loading} message={list.loading ? undefined : list.error || 'Passen Sie Ihre Suche an oder legen Sie eine neue Akte an.'} onRetry={list.error ? () => void refresh() : undefined} />} ListFooterComponent={(list.isLive ? list.hasMore : localItems.length > localCount) ? <MobileButton label="Weitere Akten laden" onPress={() => list.isLive ? list.loadMore() : setLocalCount(value => value + 20)} /> : null} />
    <MobileSheet visible={filters} title="Klient:innen filtern" onClose={() => setFilters(false)} footer={<MobileButton primary label="Ergebnisse anzeigen" onPress={() => setFilters(false)} />}>
      <Text style={m.label}>Aktenbereich</Text><MobileChips label="Aktenbereich" items={list.lifecycleFilters} value={list.lifecycleFilter} onChange={value => { list.setLifecycleFilter(value as typeof list.lifecycleFilter); list.setStatusFilter('all'); }} />
      <Text style={m.label}>Status</Text><MobileChips label="Status" items={list.statusFilters} value={list.statusFilter} onChange={value => list.setStatusFilter(value as typeof list.statusFilter)} />
      <Text style={m.label}>Pflegegrad</Text><MobileChips label="Pflegegrad" items={list.careLevelFilters} value={list.careLevelFilter} onChange={value => list.setCareLevelFilter(value as typeof list.careLevelFilter)} />
      <Text style={m.label}>Kostenträger</Text><MobileChips label="Kostenträger" items={list.costBearerFilters} value={list.costBearerFilter} onChange={list.setCostBearerFilter} />
      <Text style={m.label}>Sortierung</Text><MobileChips label="Sortierung" items={list.sortOptions} value={list.sortKey} onChange={list.setSortKey} /><MobileButton label="Filter zurücksetzen" onPress={reset} />
    </MobileSheet></View>;
}
