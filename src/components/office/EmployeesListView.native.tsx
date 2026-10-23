import { useNativePaneWidth } from '@/hooks/useNativePaneWidth';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEmployeeList } from '@/hooks/useEmployeeList';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { MobileButton, MobileChips, MobileHeading, MobileIconButton, MobileRecordRow, MobileSearch, MobileSheet, MobileState, m } from '@/components/mobile/MobileWorkspace';

type Props = { onEmployeePress?: (id: string) => void; onOpenDetail?: (id: string) => void; onCreatePress?: () => void; selectedId?: string | null; embedded?: boolean; routePrefix?: string; refreshToken?: number };
export function EmployeesListView({ onEmployeePress, onOpenDetail, onCreatePress, selectedId, routePrefix = '/business/office/employees', refreshToken = 0 }: Props) {
  const list = useEmployeeList(); const router = useRouter(); const { can } = usePermissions(); const [filters, setFilters] = useState(false);
  const { width, fontScale, onLayout } = useNativePaneWidth(); const columns = width >= 840 * fontScale ? 2 : 1;
  const { refresh } = list;
  useEffect(() => { if (refreshToken > 0) void refresh(); }, [refreshToken, refresh]);
  if (!can('office.employees.view')) return <MobileState title="Personal ist geschützt" message="Für diesen Bereich fehlt Ihnen die Berechtigung." />;
  const open = onEmployeePress ?? onOpenDetail ?? ((id: string) => router.push(`${routePrefix}/${id}` as never));
  return <View onLayout={onLayout} style={m.grow}><FlatList key={columns} data={list.items} numColumns={columns} keyExtractor={item => item.id} contentContainerStyle={{ paddingBottom: 24 }} columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void refresh()} tintColor="#1569E8" />} ItemSeparatorComponent={() => <View style={{ height: 10 }} />} ListHeaderComponent={<View style={[m.stack, { paddingBottom: 14 }]}>
    <MobileHeading title="Personal" subtitle={`${list.totalCount} Mitarbeitende`} icon="users" action={<MobileIconButton label="Personalliste aktualisieren" icon="refresh-cw" onPress={() => void refresh()} />} />
    <View style={m.wrap}>{([{ key: 'all', label: 'Alle' }, { key: 'aktiv', label: 'Aktiv' }, { key: 'in_bearbeitung', label: 'Aufnahme' }, { key: 'entwurf', label: 'Entwürfe' }] as const).map(item => <MobileButton key={item.key} compact selected={list.statusFilter === item.key} label={`${item.key === 'all' ? list.totalCount : list.allItems.filter(employee => employee.status === item.key).length} ${item.label}`} onPress={() => list.setStatusFilter(item.key)} />)}</View>
    <MobileSearch value={list.search} onChangeText={list.setSearch} label="Mitarbeitende suchen" placeholder="Name, Tätigkeit oder E-Mail" />
    <View style={m.wrap}><MobileButton compact label="Filter" icon="sliders" selected={list.hasActiveFilters} onPress={() => setFilters(true)} />{can('office.employees.create') ? <MobileButton compact primary label="Anlegen" icon="plus" onPress={onCreatePress ?? (() => router.push('/office/employees/create' as never))} /> : null}{can('tenant.settings.csv.view') ? <MobileButton compact label="Import" icon="upload" onPress={() => router.push('/business/office/settings/csv-import-export' as never)} /> : null}</View>
    <Text style={m.muted}>{list.filteredCount} Treffer{list.isLiveConnected ? ' · Aktuell synchronisiert' : ''}</Text>{list.error ? <Text style={m.error}>{list.error}</Text> : null}
  </View>} renderItem={({ item }) => <View style={{ flex: 1, maxWidth: columns > 1 ? '49.5%' : '100%' }}><MobileRecordRow icon="user" title={`${item.firstName} ${item.lastName}`.trim() || 'Name noch offen'} subtitle={item.jobTitle || 'Tätigkeit nicht hinterlegt'} selected={selectedId === item.id} onPress={() => open(item.id)}><Text style={[m.label, { color: item.status === 'aktiv' ? '#087865' : '#526B87' }]}>{WORKFLOW_STATUS_LABELS[item.status]}</Text>{item.email ? <Text style={m.body}>{item.email}</Text> : null}{item.phone ? <Text style={m.muted}>{item.phone}</Text> : null}</MobileRecordRow></View>} ListEmptyComponent={<MobileState title={list.loading ? 'Personal wird geladen' : list.error ? 'Personal konnte nicht geladen werden' : list.hasActiveFilters ? 'Keine passenden Mitarbeitenden' : 'Noch keine Mitarbeitenden'} loading={list.loading} message={list.error || undefined} onRetry={list.error ? () => void refresh() : undefined} />} ListFooterComponent={list.hasMore ? <MobileButton label="Weitere Mitarbeitende laden" onPress={list.loadMore} /> : null} />
    <MobileSheet visible={filters} title="Personal filtern" onClose={() => setFilters(false)} footer={<MobileButton primary label="Ergebnisse anzeigen" onPress={() => setFilters(false)} />}><Text style={m.label}>Status</Text><MobileChips label="Status" items={list.statusFilters} value={list.statusFilter} onChange={value => list.setStatusFilter(value as typeof list.statusFilter)} /><Text style={m.label}>Sortierung</Text><MobileChips label="Sortierung" items={list.sortOptions} value={list.sortKey} onChange={list.setSortKey} /><MobileButton label="Filter zurücksetzen" onPress={list.resetFilters} /></MobileSheet>
  </View>;
}
