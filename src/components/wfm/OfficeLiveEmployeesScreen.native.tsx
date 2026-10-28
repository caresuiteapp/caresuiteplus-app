// Generated native presentation from src/components/wfm/OfficeLiveEmployeesScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeStyle,NativeDiv,NativeH2,NativeP,NativeHeader,NativeSpan,NativeButton,NativeStrong,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeH3,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeTime,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useLiveRefresh } from '@/hooks/core/useLiveRefresh';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import { readOfficeLivePresence } from "../../lib/wfm/wfmOfficeLivePresence.native.ts";
import type { WfmLiveEmployeeRow } from '@/types/modules/wfm';
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { officeWorktimeLiveCss } from "./officeWorktimeLiveCss.native.ts";
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
type Filter = 'all' | 'active' | 'pause' | 'ended';
const filterValue = (value: string): Filter => value === 'active' || value === 'pause' || value === 'ended' ? value : 'all';
const isActive = (row: WfmLiveEmployeeRow) => Boolean(row.session?.isOnline && !['ended', 'offline'].includes(row.session.status));
const time = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const duration = (value: number | undefined) => value == null || !Number.isFinite(value) ? '—' : `${Math.floor(Math.max(0, value) / 60)} Std. ${Math.round(Math.max(0, value) % 60)} Min.`;
export function OfficeLiveEmployeesScreen() {
    const auth = useAuth();
    const tenantId = useServiceTenantId()?.trim() ?? '';
    const { roleKey, permissions, can } = usePermissions();
    const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('time.tracking.team.view'));
    const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, [...new Set(permissions)].sort()]);
    return <NativeWorkspaceStyleScope css={[officeWorktimeLiveCss, officeWorktimeLiveCss]}>{<NativeSection className="ow-live" data-worktime-live="presence-v1"><NativeStyle>{officeWorktimeLiveCss}</NativeStyle>
    {!auth.authReady ? <NativeDiv className="ow-live-state" role="status">Zugang wird geprüft …</NativeDiv>
            : allowed && roleKey ? <Presence key={scopeKey} tenantId={tenantId} roleKey={roleKey} permissions={permissions} scopeKey={scopeKey} canMap={can('assist.access') && can('assist.tracking.view') && can('assist.assignments.view')}/>
                : <NativeDiv className="ow-live-state"><NativeH2>Live-Übersicht</NativeH2><NativeP>Für diesen Bereich benötigen Sie einen Verwaltungszugang und die Freigabe für die Team-Zeiterfassung.</NativeP></NativeDiv>}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
function Presence({ tenantId, roleKey, permissions, scopeKey, canMap }: {
    tenantId: string;
    roleKey: RoleKey;
    permissions: readonly PermissionKey[];
    scopeKey: string;
    canMap: boolean;
}) {
    const router = useRouter();
    const focused = useIsFocused();
    const params = useLocalSearchParams<{
        search?: string | string[];
        status?: string | string[];
    }>();
    const requestedSearch = first(params.search).slice(0, 180);
    const requestedFilter = filterValue(first(params.status));
    const [search, setSearch] = useState(requestedSearch);
    const [filter, setFilter] = useState<Filter>(requestedFilter);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    useEffect(() => setSearch(requestedSearch), [requestedSearch]);
    useEffect(() => setFilter(requestedFilter), [requestedFilter]);
    const query = useAsyncQuery(() => readOfficeLivePresence({ tenantId, roleKey, effectivePermissions: permissions }), [scopeKey], { queryKey: 'office-live:' + scopeKey, refreshOnAppFocus: false, onSuccess: () => setUpdatedAt(new Date().toISOString()) });
    const subscribe = useCallback((handler: () => void) => subscribeToWfmLiveChanges(tenantId, handler), [tenantId]);
    useLiveRefresh({ enabled: focused, subscribe, onRefresh: query.refresh, pollMs: 30000, refreshOnFocus: true });
    const wasFocused = useRef(focused);
    useEffect(() => { if (focused && !wasFocused.current)
        void query.refresh(); wasFocused.current = focused; }, [focused, query.refresh]);
    const rows = query.data?.rows ?? [];
    const visible = rows.filter(row => (!search || row.employeeName.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))) && (filter === 'all' || (filter === 'active' && isActive(row)) || (filter === 'pause' && row.session?.status === 'paused') || (filter === 'ended' && row.session?.status === 'ended')));
    const busy = query.loading || query.refreshing;
    const error = query.refreshError || query.error;
    const writeParams = (next: Record<string, string | undefined>) => { if (focused)
        router.setParams(next); };
    return <NativeWorkspaceStyleScope css={[officeWorktimeLiveCss]}>{<>
    <NativeHeader className="ow-live-header"><NativeDiv><NativeH2>Live-Übersicht</NativeH2><NativeP className="ow-live-subtle">Heutige Erfassung im Team · Zeiten in Berliner Ortszeit</NativeP></NativeDiv><NativeDiv className="ow-live-actions">{updatedAt ? <NativeSpan className="ow-live-subtle">Stand {time(updatedAt)} Uhr</NativeSpan> : null}<NativeButton type="button" className="ow-live-button" disabled={busy} onClick={() => void query.refresh()}>{busy ? <NativeSpan className="ow-live-spinner" aria-hidden="true"/> : null}Aktualisieren</NativeButton>{canMap ? <NativeButton type="button" className="ow-live-button" data-primary onClick={() => router.push('/business/office/time-tracking/live-map' as never)}>Live-Karte öffnen</NativeButton> : null}</NativeDiv></NativeHeader>
    <NativeDiv className="ow-live-metrics" aria-label="Heutige Erfassung"><NativeDiv className="ow-live-metric"><NativeSpan>Heute erfasst</NativeSpan><NativeStrong>{query.data ? new Set(rows.map(row => row.employeeId)).size : '—'}</NativeStrong></NativeDiv><NativeDiv className="ow-live-metric"><NativeSpan>Aktive Erfassung</NativeSpan><NativeStrong>{query.data ? rows.filter(isActive).length : '—'}</NativeStrong></NativeDiv><NativeDiv className="ow-live-metric"><NativeSpan>In Pause</NativeSpan><NativeStrong>{query.data ? rows.filter(row => row.session?.status === 'paused').length : '—'}</NativeStrong></NativeDiv></NativeDiv>
    {error ? <NativeDiv className="ow-live-message" data-error role="alert"><NativeStrong>{query.data ? 'Aktualisierung fehlgeschlagen.' : 'Live-Übersicht nicht verfügbar.'}</NativeStrong><NativeP>{error}</NativeP>{query.data ? <NativeP>Die Liste zeigt den letzten erfolgreichen Abruf.</NativeP> : null}<NativeButton type="button" className="ow-live-button" disabled={busy} onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
    <NativeDiv className="ow-live-toolbar"><NativeLabel>Suche<NativeInput type="search" placeholder="Mitarbeitende suchen …" value={search} onChange={event => { const next = event.currentTarget.value.slice(0, 180); setSearch(next); writeParams({ search: next || undefined }); }}/></NativeLabel><NativeLabel>Status<NativeSelect value={filter} onChange={event => { const next = filterValue(event.currentTarget.value); setFilter(next); writeParams({ status: next === 'all' ? undefined : next }); }}><NativeOption value="all">Alle Erfassungen</NativeOption><NativeOption value="active">Aktive Erfassung</NativeOption><NativeOption value="pause">In Pause</NativeOption><NativeOption value="ended">Beendet</NativeOption></NativeSelect></NativeLabel>{search || filter !== 'all' ? <NativeButton type="button" className="ow-live-button" onClick={() => { setSearch(''); setFilter('all'); writeParams({ search: undefined, status: undefined }); }}>Filter zurücksetzen</NativeButton> : null}</NativeDiv>
    <NativeDiv className="ow-live-panel" aria-busy={busy}><NativeDiv className="ow-live-panel-title"><NativeH3>Mitarbeitende heute</NativeH3><NativeSpan className="ow-live-subtle">{query.data ? `${visible.length} von ${rows.length}` : '—'}</NativeSpan></NativeDiv>
      {query.loading && !query.data ? <NativeDiv className="ow-live-state" role="status">Erfassungen werden geladen …</NativeDiv>
            : query.data && !visible.length ? <NativeDiv className="ow-live-state"><NativeH3>{rows.length ? 'Keine passenden Erfassungen' : 'Heute noch keine Erfassung'}</NativeH3><NativeP>{rows.length ? 'Passen Sie die Suche oder den Status an.' : 'Gestempelte Arbeitszeiten erscheinen hier, sobald sie gespeichert sind.'}</NativeP></NativeDiv>
                : query.data ? <NativeDiv className="ow-live-table-wrap"><NativeTable><NativeThead><NativeTr><NativeTh scope="col">Mitarbeitende</NativeTh><NativeTh scope="col">Status</NativeTh><NativeTh scope="col">Beginn · Ende</NativeTh><NativeTh scope="col">Gespeicherte Nettozeit</NativeTh><NativeTh scope="col">Letztes Ereignis</NativeTh><NativeTh scope="col">Zeitkonto</NativeTh></NativeTr></NativeThead><NativeTbody>{visible.map(row => <NativeTr key={row.session?.id ?? row.employeeId}><NativeTd><NativeStrong>{row.employeeName}</NativeStrong></NativeTd><NativeTd><NativeSpan className="ow-live-tag" data-tone={row.session?.status === 'paused' ? 'warning' : isActive(row) ? 'good' : 'muted'}>{row.statusLabel}</NativeSpan></NativeTd><NativeTd><NativeTime>{time(row.session?.startedAt)} · {row.session?.endedAt ? time(row.session.endedAt) : isActive(row) ? 'läuft' : '—'}</NativeTime></NativeTd><NativeTd>{duration(row.session?.netMinutes)}<NativeP className="ow-live-subtle">Pause {duration(row.session?.pauseMinutes)}</NativeP></NativeTd><NativeTd><NativeTime>{time(row.lastEventAt)}</NativeTime></NativeTd><NativeTd><NativeButton type="button" className="ow-live-button" aria-label={'Zeitkonto von ' + row.employeeName + ' öffnen'} onClick={() => router.push(('/business/office/time-tracking/zeitkonten?employee=' + encodeURIComponent(row.employeeId) + '&account=' + encodeURIComponent(row.employeeId)) as never)}>Öffnen</NativeButton></NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv> : null}
      <NativeP className="ow-live-note">Der Status folgt der gespeicherten Zeiterfassung. Die Nettozeit ist der gespeicherte Stand und läuft hier nicht als Stoppuhr weiter.</NativeP>
    </NativeDiv>
  </>}</NativeWorkspaceStyleScope>;
}
