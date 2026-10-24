// Generated native presentation from src/screens/pflege/MedicationListScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MedicationListCard } from '@/components/pflege/MedicationListCard';
import { MedicationListHero } from '@/components/pflege/MedicationListHero';
import { MedicationListTable } from '@/components/pflege/MedicationListTable';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { CarePermissionStatus, type CarePermissionStatusState } from "./CarePermissionStatus.native.tsx";
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { fetchMedicationList } from "../../lib/pflege/medicationListService.native.ts";
import { colors, spacing } from '@/theme';
import { careAssessmentRuntimeAccess } from "../../lib/careAssessment/careAssessmentRuntimeAccess.native.ts";
import { captureMedicationListOriginal, sameMedicationListOriginal } from "../../lib/pflege/medicationListOriginal.native.ts";
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import type { RoleKey } from '@/types';
import type { MedicationListItem } from '@/types/modules/pflege';
type Owner = {
    tenantId: string;
    profileId: string;
    role: RoleKey;
};
type Props = {
    owner: Owner | null;
    serviceTenant: string | null;
    runtimeTenant: string | null;
    runtimeRole: RoleKey | null;
    canView: boolean;
    canManage: boolean;
    roleLabel: string | null;
    permissionStatus: CarePermissionStatusState;
};
type ReadResult = {
    ticket: symbol;
    readId: symbol;
    owner: Owner;
    items: MedicationListItem[];
};
const same = sameMedicationListOriginal;
export function MedicationListScreen() {
    const { profile } = useAuth();
    const serviceTenant = useServiceTenantId();
    const permissions = usePermissions();
    const owner: Owner | null = profile && woundUuid(profile.tenantId) && woundUuid(profile.id) && profile.roleKey
        ? { tenantId: profile.tenantId!, profileId: profile.id, role: profile.roleKey } : null;
    return <MedicationListWorkspace key={JSON.stringify(owner)} owner={owner} serviceTenant={serviceTenant} runtimeTenant={permissions.tenantId} runtimeRole={permissions.roleKey} canView={permissions.can('pflege.medications.view')} canManage={permissions.can('pflege.medications.manage')} roleLabel={permissions.roleLabel} permissionStatus={permissions}/>;
}
function MedicationListWorkspace(props: Props) {
    const router = useRouter();
    const owner = useRef(props.owner ? structuredClone(props.owner) : null).current;
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const access = careAssessmentRuntimeAccess({ tenantId: props.owner?.tenantId, profileId: props.owner?.profileId,
        profileRole: props.owner?.role, runtimeTenantId: props.runtimeTenant, runtimeRole: props.runtimeRole,
        canView: props.canView, canManage: props.canManage });
    const roleLabel = props.roleLabel, roleKey = owner?.role ?? 'nurse', isReadOnly = !access.canManage;
    const canRead = access.canRead && props.serviceTenant === owner?.tenantId && same(owner, props.owner);
    const queryKey = JSON.stringify([owner, props.serviceTenant, props.runtimeTenant, props.runtimeRole, props.canView, canRead]);
    const boundary = useRef({ key: queryKey, ticket: Symbol('medication-list-read') });
    if (boundary.current.key !== queryKey)
        boundary.current = { key: queryKey, ticket: Symbol('medication-list-read') };
    const runtime = useRef({ owner: props.owner, access, canRead, ticket: boundary.current.ticket });
    runtime.current = { owner: props.owner, access, canRead, ticket: boundary.current.ticket };
    function ownRead(ticket: symbol) {
        return alive.current && !!owner && runtime.current.canRead && runtime.current.ticket === ticket && same(owner, runtime.current.owner);
    }
    const deviceClass = useDeviceClass();
    const isDesktop = isDesktopClass(deviceClass);
    const { viewMode, setViewMode } = useDesktopListViewPreference('pflege.medication');
    const useTableLayout = isDesktop && viewMode === 'table';
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const readFlight = useRef<symbol | null>(null), completedRead = useRef<symbol | null>(null);
    const query = useAsyncQuery<ReadResult>(async () => {
        const ticket = runtime.current.ticket;
        if (!ownRead(ticket) || !owner)
            return { ok: false, error: 'Aktueller Benutzerbezug oder Medikationsleserecht fehlt.' };
        const readId = Symbol('medication-list-response');
        readFlight.current = readId;
        completedRead.current = null;
        try {
            const result = await fetchMedicationList(owner.tenantId, owner.role);
            if (!ownRead(ticket))
                return { ok: false, error: 'Benutzerbezug oder Medikationsleserecht wurde geändert.' };
            if (!result.ok)
                return result;
            const items = captureMedicationListOriginal(result.data, owner.tenantId);
            completedRead.current = readId;
            return { ...result, data: { ticket, readId, owner: structuredClone(owner), items } };
        }
        catch (cause) {
            return { ok: false, error: cause instanceof Error ? cause.message : 'Die Medikationsliste ist ungültig.' };
        }
        finally {
            if (readFlight.current === readId)
                readFlight.current = null;
        }
    }, [queryKey], { queryKey, enabled: canRead, retryCount: 0 });
    const envelope = query.data;
    let items: MedicationListItem[] = [], poolError: string | null = null;
    let ready = canRead && !!envelope && ownRead(envelope.ticket) && same(envelope.owner, owner)
        && readFlight.current === null && completedRead.current === envelope.readId
        && !query.loading && !query.refreshing && !query.error && !query.refreshError && !query.previewData && !query.tableMissing
        && !query.cacheMeta.fromCache && !query.cacheMeta.partialDetail;
    if (ready && envelope && owner) {
        try {
            items = captureMedicationListOriginal(envelope.items, owner.tenantId);
        }
        catch (cause) {
            ready = false;
            poolError = cause instanceof Error ? cause.message : 'Die Medikationsliste ist ungültig.';
        }
    }
    const filteredItems = useMemo(() => {
        const needle = search.trim().toLocaleLowerCase('de-DE');
        return items.filter((item) => (statusFilter === 'all' || item.status === statusFilter)
            && (!needle || `${item.clientName} ${item.medicationName} ${item.activeIngredient ?? ''}`.toLocaleLowerCase('de-DE').includes(needle)));
    }, [items, search, statusFilter]);
    const renderPool = structuredClone(items), renderTicket = boundary.current.ticket, renderReadId = envelope?.readId ?? null;
    const latest = useRef({ items, envelope, ready, search, statusFilter, queryKey, ticket: renderTicket, refresh: query.refresh });
    latest.current = { items, envelope, ready, search, statusFilter, queryKey, ticket: renderTicket, refresh: query.refresh };
    function currentPool() {
        const current = latest.current;
        if (!owner || !ownRead(renderTicket) || !current.ready || current.ticket !== renderTicket || current.queryKey !== queryKey
            || readFlight.current !== null || !current.envelope || completedRead.current !== renderReadId || current.envelope.readId !== renderReadId
            || current.envelope.ticket !== renderTicket || !same(current.envelope.owner, owner))
            return null;
        try {
            const pool = captureMedicationListOriginal(current.envelope.items, owner.tenantId);
            return same(pool, current.items) && same(pool, renderPool) ? pool : null;
        }
        catch {
            return null;
        }
    }
    function openDetail(id: string) {
        const pool = currentPool(), current = latest.current;
        if (!pool || current.search !== search || current.statusFilter !== statusFilter || !woundUuid(id) || !filteredItems.some(item => item.id === id))
            return;
        const original = renderPool.find(item => item.id === id), actual = pool.find(item => item.id === id);
        if (!original || !actual || !same(original, actual))
            return;
        router.push(`/pflege/medikation/${actual.id}` as never);
    }
    function openCreate() { if (!currentPool() || !runtime.current.access.canManage)
        return; router.push('/pflege/medikation/new' as never); }
    function refresh() { if (ownRead(renderTicket)) {
        completedRead.current = null;
        void latest.current.refresh();
    } }
    function changeSearch(next: string) { if (ownRead(renderTicket)) {
        latest.current.search = next;
        setSearch(next);
    } }
    function changeStatus(next: string) { if (ownRead(renderTicket)) {
        latest.current.statusFilter = next;
        setStatusFilter(next);
    } }
    function changeView(next: typeof viewMode) { if (ownRead(renderTicket))
        setViewMode(next); }
    if (!canRead)
        return <ScreenShell title="Medikationsplan" subtitle="Zugriff"><CarePermissionStatus state={props.permissionStatus}/></ScreenShell>;
    if (!ready)
        return <ScreenShell title="Medikationsplan" subtitle="Aktuellen Bestand prüfen">
    {query.loading || query.refreshing ? <LoadingState message="Aktuelle Verordnungen werden geladen…"/>
                : <ErrorState message={poolError ?? query.error ?? query.refreshError ?? 'Der aktuelle Medikationslistenbestand ist noch nicht bestätigt. Bitte neu laden.'} onRetry={refresh}/>}
  </ScreenShell>;
    const header = (<View style={styles.header}>
      <MedicationListHero items={items} roleKey={roleKey} isReadOnly={isReadOnly} viewMode={viewMode} onViewModeChange={changeView} showViewToggle={isDesktop}/>
      <View style={styles.toolbar}>
        <PremiumButton title="+ Verordnung anlegen" disabled={isReadOnly} onPress={openCreate}/>
        <PremiumButton title="Aktualisieren" variant="secondary" onPress={refresh}/>
      </View>
      <PremiumInput label="Suche" placeholder="Klient:in, Präparat oder Wirkstoff" value={search} onChangeText={changeSearch}/>
      <FilterChipGroup options={[{ key: 'active', label: 'Aktiv' }, { key: 'paused', label: 'Pausiert' }, { key: 'stopped', label: 'Beendet' }, { key: 'all', label: 'Alle' }]} value={statusFilter} onChange={changeStatus}/>
    </View>);
    if (useTableLayout) {
        return (<ScreenShell title="Medikationsplan" subtitle={`Medikation · ${roleLabel ?? 'Pflegefachkraft'}`} scroll={false}>
        <ScrollView contentContainerStyle={styles.tableScroll} refreshControl={<RefreshControl refreshing={query.refreshing} onRefresh={refresh} tintColor={colors.primary}/>}>
          {header}
          {filteredItems.length === 0 ? (<EmptyState title={items.length ? "Keine passenden Verordnungen" : "Keine Verordnungen im geladenen Bestand"} message={items.length ? "Suchtext oder Statusfilter anpassen." : "Der aktuell geladene Medikationslistenbestand ist leer."}/>) : (<MedicationListTable items={filteredItems} onOpenDetail={openDetail}/>)}
        </ScrollView>
      </ScreenShell>);
    }
    return (<ScreenShell title="Medikationsplan" subtitle={`Medikation · ${roleLabel ?? 'Pflegefachkraft'}`} scroll={false}>
      <FlatList data={filteredItems} keyExtractor={(item) => item.id} ListHeaderComponent={header} ListEmptyComponent={<EmptyState title={items.length ? "Keine passenden Verordnungen" : "Keine Verordnungen im geladenen Bestand"} message={items.length ? "Suchtext oder Statusfilter anpassen." : "Der aktuell geladene Medikationslistenbestand ist leer."}/>} renderItem={({ item }) => (<MedicationListCard item={item} onPress={() => openDetail(item.id)}/>)} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={query.refreshing} onRefresh={refresh} tintColor={colors.primary}/>}/>
    </ScreenShell>);
}
const styles = StyleSheet.create({
    header: { marginBottom: spacing.sm, gap: spacing.sm },
    list: { paddingBottom: spacing.xxl },
    tableScroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
    toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
