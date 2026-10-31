// Generated native presentation from src/components/wfm/OfficeWfmLiveMapScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeStyle,NativeDiv,NativeH2,NativeP,NativeHeader,NativeButton,NativeSpan,NativeStrong,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeH3,NativeSmall,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { GoogleMapsLiveMap } from "../maps/GoogleMapsLiveMap.native.tsx";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useLiveRefresh } from '@/hooks/core/useLiveRefresh';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { fetchAssistMobilityTracking, type AssistMobilityScope } from "../../lib/assist/assistMobilityService.native.ts";
import type { AssistMobilityTrackingRow } from "../../lib/assist/assistMobilityModel.native.ts";
import { officeWorktimeLiveCss } from "./officeWorktimeLiveCss.native.ts";
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
const time = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) + ' Uhr' : 'Noch kein Signal';
function currentPosition(row: AssistMobilityTrackingRow) {
    const position = row.position;
    const age = Date.now() - Date.parse(position?.capturedAt ?? '');
    return row.trackingState === 'live' && position && Number.isFinite(age) && age >= 0 && age <= 150000 ? position : null;
}
export function OfficeWfmLiveMapScreen() {
    const auth = useAuth();
    const tenantId = useServiceTenantId()?.trim() ?? '';
    const { roleKey, permissions, can } = usePermissions();
    const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('time.tracking.team.view') && can('assist.access') && can('assist.tracking.view') && can('assist.assignments.view'));
    const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, [...new Set(permissions)].sort()]);
    return <NativeWorkspaceStyleScope css={[officeWorktimeLiveCss, officeWorktimeLiveCss]}>{<NativeSection className="ow-live" data-worktime-live="map-v1"><NativeStyle>{officeWorktimeLiveCss}</NativeStyle>
    {!auth.authReady ? <NativeDiv className="ow-live-state" role="status">Zugang wird geprüft …</NativeDiv>
            : allowed && roleKey ? <LiveMap key={scopeKey} scopeKey={scopeKey} scope={{ tenantId, roleKey, effectivePermissions: permissions }}/>
                : <NativeDiv className="ow-live-state"><NativeH2>Live-Karte</NativeH2><NativeP>Für die Karte benötigen Sie einen Verwaltungszugang sowie die Freigaben für Team-Zeiterfassung, Assist, Einsätze und Tracking.</NativeP></NativeDiv>}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
function LiveMap({ scope, scopeKey }: {
    scope: AssistMobilityScope;
    scopeKey: string;
}) {
    const router = useRouter();
    const focused = useIsFocused();
    const params = useLocalSearchParams<{
        search?: string | string[];
        tracking?: string | string[];
        signal?: string | string[];
    }>();
    const requestedSearch = first(params.search).slice(0, 180);
    const requestedId = first(params.tracking);
    const requestedFilter = first(params.signal) === 'live' ? 'live' : 'all';
    const [search, setSearch] = useState(requestedSearch);
    const [selectedId, setSelectedId] = useState(requestedId);
    const [filter, setFilter] = useState<'all' | 'live'>(requestedFilter);
    useEffect(() => setSearch(requestedSearch), [requestedSearch]);
    useEffect(() => setSelectedId(requestedId), [requestedId]);
    useEffect(() => setFilter(requestedFilter), [requestedFilter]);
    const query = useAsyncQuery(() => fetchAssistMobilityTracking(scope), [scopeKey], { queryKey: 'office-live-map:' + scopeKey, refreshOnAppFocus: false });
    useLiveRefresh({ enabled: focused, onRefresh: query.refresh, pollMs: 15000, refreshOnFocus: true });
    const wasFocused = useRef(focused);
    useEffect(() => { if (focused && !wasFocused.current)
        void query.refresh(); wasFocused.current = focused; }, [focused, query.refresh]);
    const error = query.refreshError || query.error;
    const busy = query.loading || query.refreshing;
    const rows = query.data?.rows ?? [];
    // A failed refresh cannot confirm whether a previously granted consent is still valid.
    const livePosition = (row: AssistMobilityTrackingRow) => error ? null : currentPosition(row);
    const visible = rows.filter(row => (!search || [row.employeeName, row.clientName, row.title].filter(Boolean).join(' ').toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))) && (filter === 'all' || livePosition(row)));
    const selected = visible.find(row => row.id === selectedId) ?? visible[0] ?? null;
    const markers = visible.flatMap(row => { const position = livePosition(row); return position ? [{ id: row.id, ...position, label: row.employeeName, subtitle: row.statusLabel }] : []; });
    const writeParams = (next: Record<string, string | undefined>) => { if (focused)
        router.setParams(next); };
    const select = (id: string) => { setSelectedId(id); writeParams({ tracking: id }); };
    const label = (row: AssistMobilityTrackingRow) => error ? 'Standort wird erneut geprüft' : row.trackingState === 'live' && !currentPosition(row) ? 'GPS-Signal veraltet' : row.trackingLabel;
    return <NativeWorkspaceStyleScope css={[officeWorktimeLiveCss]}>{<>
    <NativeHeader className="ow-live-header"><NativeDiv><NativeH2>Live-Karte</NativeH2><NativeP className="ow-live-subtle">Freigegebene Positionen aus laufenden Einsätzen</NativeP></NativeDiv><NativeDiv className="ow-live-actions"><NativeButton type="button" className="ow-live-button" onClick={() => router.push('/business/office/time-tracking/live' as never)}>Zur Live-Übersicht</NativeButton><NativeButton type="button" className="ow-live-button" disabled={busy} onClick={() => void query.refresh()}>{busy ? <NativeSpan className="ow-live-spinner" aria-hidden="true"/> : null}Karte aktualisieren</NativeButton></NativeDiv></NativeHeader>
    {error ? <NativeDiv className="ow-live-message" data-error role="alert"><NativeStrong>{query.data ? 'Aktualisierung fehlgeschlagen.' : 'Standorte nicht verfügbar.'}</NativeStrong><NativeP>{error}</NativeP>{query.data ? <NativeP>Die Einsatzliste zeigt den letzten Abruf. Kartenpunkte bleiben bis zur erfolgreichen Prüfung ausgeblendet.</NativeP> : null}<NativeButton type="button" className="ow-live-button" disabled={busy} onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
    {query.data?.warnings.map(warning => <NativeP key={warning} className="ow-live-message" role="status">{warning}</NativeP>)}
    <NativeDiv className="ow-live-toolbar"><NativeLabel>Suche<NativeInput type="search" placeholder="Name oder Einsatz suchen …" value={search} onChange={event => { const next = event.currentTarget.value.slice(0, 180); setSearch(next); writeParams({ search: next || undefined }); }}/></NativeLabel><NativeLabel>Standortsignal<NativeSelect value={filter} onChange={event => { const next = event.currentTarget.value === 'live' ? 'live' : 'all'; setFilter(next); writeParams({ signal: next === 'all' ? undefined : next }); }}><NativeOption value="all">Alle Einsätze</NativeOption><NativeOption value="live">Nur aktuelle Positionen</NativeOption></NativeSelect></NativeLabel>{search || filter !== 'all' ? <NativeButton type="button" className="ow-live-button" onClick={() => { setSearch(''); setFilter('all'); writeParams({ search: undefined, signal: undefined }); }}>Filter zurücksetzen</NativeButton> : null}</NativeDiv>
    <NativeP className="ow-live-count">{query.data ? `${markers.length} aktuelle Positionen · ${visible.length} von ${rows.length} Einsätzen · Stand ${time(query.data.generatedAt)}` : 'Standorte werden geprüft.'}</NativeP>
    {query.loading && !query.data ? <NativeDiv className="ow-live-state" role="status">Einsätze und Standortfreigaben werden geladen …</NativeDiv>
            : query.data ? <NativeDiv className="ow-live-layout"><NativeDiv className="ow-live-panel"><NativeDiv className="ow-live-map">{markers.length ? <GoogleMapsLiveMap tenantId={scope.tenantId} markers={markers} selectedMarkerId={selected && livePosition(selected) ? selected.id : null} onMarkerSelect={select} height={380} appearance="light" showControls showMeta={false}/> : <NativeDiv className="ow-live-state"><NativeH3>Keine aktuelle Position</NativeH3><NativeP>{error ? 'Nach einer erfolgreichen Aktualisierung werden freigegebene Positionen wieder angezeigt.' : 'Nur aktuelle, ausreichend genaue GPS-Signale mit gültiger Freigabe erscheinen auf der Karte.'}</NativeP></NativeDiv>}</NativeDiv><NativeP className="ow-live-note">Ein fehlender Kartenpunkt ist keine Aussage über die Arbeitszeit. Erfassung und Standortfreigabe werden getrennt geprüft.</NativeP>{selected ? <NativeDiv className="ow-live-detail"><NativeDiv className="ow-live-selected-heading"><NativeH3>{selected.employeeName}</NativeH3><NativeSpan className="ow-live-tag" data-tone={livePosition(selected) ? 'good' : 'warning'}>{label(selected)}</NativeSpan></NativeDiv><NativeP>{selected.title}{selected.clientName ? ` · ${selected.clientName}` : ''}</NativeP><NativeP className="ow-live-subtle">{selected.statusLabel} · Letztes Signal: {time(selected.lastSignalAt)}</NativeP><NativeDiv><NativeButton type="button" className="ow-live-button" onClick={() => router.push(selected.detailHref as never)}>Einsatz öffnen</NativeButton></NativeDiv></NativeDiv> : null}</NativeDiv><NativeDiv className="ow-live-panel"><NativeDiv className="ow-live-panel-title"><NativeH3>Einsätze im Überblick</NativeH3><NativeSpan className="ow-live-subtle">{visible.length}</NativeSpan></NativeDiv>{visible.length ? <NativeDiv className="ow-live-position-list">{visible.map(row => <NativeButton type="button" key={row.id} className="ow-live-position" aria-pressed={selected?.id === row.id} aria-label={'Standort von ' + row.employeeName + ' auswählen'} onClick={() => select(row.id)}><NativeStrong>{row.employeeName}</NativeStrong><NativeSmall>{row.title}{row.clientName ? ` · ${row.clientName}` : ''}</NativeSmall><NativeSmall>{row.statusLabel} · {time(row.lastSignalAt)}</NativeSmall><NativeSpan className="ow-live-tag" data-tone={livePosition(row) ? 'good' : 'muted'}>{label(row)}</NativeSpan></NativeButton>)}</NativeDiv> : <NativeDiv className="ow-live-state"><NativeH3>Keine passenden Einsätze</NativeH3><NativeP>{rows.length ? 'Passen Sie die Filter an.' : 'Für heute sind keine freigegebenen Einsätze verfügbar.'}</NativeP></NativeDiv>}</NativeDiv></NativeDiv> : null}
  </>}</NativeWorkspaceStyleScope>;
}
