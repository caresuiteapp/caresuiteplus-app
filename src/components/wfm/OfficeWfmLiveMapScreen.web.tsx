import { useEffect, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { GoogleMapsLiveMap } from '@/components/maps/GoogleMapsLiveMap.web';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useLiveRefresh } from '@/hooks/core/useLiveRefresh';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { fetchAssistMobilityTracking, type AssistMobilityScope } from '@/lib/assist/assistMobilityService.web';
import type { AssistMobilityTrackingRow } from '@/lib/assist/assistMobilityModel.web';
import { officeWorktimeLiveCss } from './officeWorktimeLiveCss.web';

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
const time = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) + ' Uhr' : 'Noch kein Signal';
function currentPosition(row: AssistMobilityTrackingRow) {
  const position = row.position; const age = Date.now() - Date.parse(position?.capturedAt ?? '');
  return row.trackingState === 'live' && position && Number.isFinite(age) && age >= 0 && age <= 150000 ? position : null;
}

export function OfficeWfmLiveMapScreen() {
  const auth = useAuth(); const tenantId = useServiceTenantId()?.trim() ?? '';
  const { roleKey, permissions, can } = usePermissions();
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('time.tracking.team.view') && can('assist.access') && can('assist.tracking.view') && can('assist.assignments.view'));
  const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, [...new Set(permissions)].sort()]);
  return <section className="ow-live" data-worktime-live="map-v1"><style>{officeWorktimeLiveCss}</style>
    {!auth.authReady ? <div className="ow-live-state" role="status">Zugang wird geprüft …</div>
      : allowed && roleKey ? <LiveMap key={scopeKey} scopeKey={scopeKey} scope={{ tenantId, roleKey, effectivePermissions: permissions }} />
        : <div className="ow-live-state"><h2>Live-Karte</h2><p>Für die Karte benötigen Sie einen Verwaltungszugang sowie die Freigaben für Team-Zeiterfassung, Assist, Einsätze und Tracking.</p></div>}
  </section>;
}

function LiveMap({ scope, scopeKey }: { scope: AssistMobilityScope; scopeKey: string }) {
  const router = useRouter(); const focused = useIsFocused();
  const params = useLocalSearchParams<{ search?: string | string[]; tracking?: string | string[]; signal?: string | string[] }>();
  const requestedSearch = first(params.search).slice(0, 180); const requestedId = first(params.tracking); const requestedFilter = first(params.signal) === 'live' ? 'live' : 'all';
  const [search, setSearch] = useState(requestedSearch); const [selectedId, setSelectedId] = useState(requestedId); const [filter, setFilter] = useState<'all' | 'live'>(requestedFilter);
  useEffect(() => setSearch(requestedSearch), [requestedSearch]); useEffect(() => setSelectedId(requestedId), [requestedId]); useEffect(() => setFilter(requestedFilter), [requestedFilter]);
  const query = useAsyncQuery(() => fetchAssistMobilityTracking(scope), [scopeKey], { queryKey: 'office-live-map:' + scopeKey, refreshOnAppFocus: false });
  useLiveRefresh({ enabled: focused, onRefresh: query.refresh, pollMs: 15000, refreshOnFocus: true });
  const wasFocused = useRef(focused);
  useEffect(() => { if (focused && !wasFocused.current) void query.refresh(); wasFocused.current = focused; }, [focused, query.refresh]);
  const error = query.refreshError || query.error; const busy = query.loading || query.refreshing;
  const rows = query.data?.rows ?? [];
  // A failed refresh cannot confirm whether a previously granted consent is still valid.
  const livePosition = (row: AssistMobilityTrackingRow) => error ? null : currentPosition(row);
  const visible = rows.filter(row => (!search || [row.employeeName, row.clientName, row.title].filter(Boolean).join(' ').toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))) && (filter === 'all' || livePosition(row)));
  const selected = visible.find(row => row.id === selectedId) ?? visible[0] ?? null;
  const markers = visible.flatMap(row => { const position = livePosition(row); return position ? [{ id: row.id, ...position, label: row.employeeName, subtitle: row.statusLabel }] : []; });
  const writeParams = (next: Record<string, string | undefined>) => { if (focused) router.setParams(next); };
  const select = (id: string) => { setSelectedId(id); writeParams({ tracking: id }); };
  const label = (row: AssistMobilityTrackingRow) => error ? 'Standort wird erneut geprüft' : row.trackingState === 'live' && !currentPosition(row) ? 'GPS-Signal veraltet' : row.trackingLabel;
  return <>
    <header className="ow-live-header"><div><h2>Live-Karte</h2><p className="ow-live-subtle">Freigegebene Positionen aus laufenden Einsätzen</p></div><div className="ow-live-actions"><button type="button" className="ow-live-button" onClick={() => router.push('/business/office/time-tracking/live' as never)}>Zur Live-Übersicht</button><button type="button" className="ow-live-button" disabled={busy} onClick={() => void query.refresh()}>{busy ? <span className="ow-live-spinner" aria-hidden="true" /> : null}Karte aktualisieren</button></div></header>
    {error ? <div className="ow-live-message" data-error role="alert"><strong>{query.data ? 'Aktualisierung fehlgeschlagen.' : 'Standorte nicht verfügbar.'}</strong><p>{error}</p>{query.data ? <p>Die Einsatzliste zeigt den letzten Abruf. Kartenpunkte bleiben bis zur erfolgreichen Prüfung ausgeblendet.</p> : null}<button type="button" className="ow-live-button" disabled={busy} onClick={() => void query.refresh()}>Erneut laden</button></div> : null}
    {query.data?.warnings.map(warning => <p key={warning} className="ow-live-message" role="status">{warning}</p>)}
    <div className="ow-live-toolbar"><label>Suche<input type="search" placeholder="Name oder Einsatz suchen …" value={search} onChange={event => { const next = event.currentTarget.value.slice(0, 180); setSearch(next); writeParams({ search: next || undefined }); }} /></label><label>Standortsignal<select value={filter} onChange={event => { const next = event.currentTarget.value === 'live' ? 'live' : 'all'; setFilter(next); writeParams({ signal: next === 'all' ? undefined : next }); }}><option value="all">Alle Einsätze</option><option value="live">Nur aktuelle Positionen</option></select></label>{search || filter !== 'all' ? <button type="button" className="ow-live-button" onClick={() => { setSearch(''); setFilter('all'); writeParams({ search: undefined, signal: undefined }); }}>Filter zurücksetzen</button> : null}</div>
    <p className="ow-live-count">{query.data ? `${markers.length} aktuelle Positionen · ${visible.length} von ${rows.length} Einsätzen · Stand ${time(query.data.generatedAt)}` : 'Standorte werden geprüft.'}</p>
    {query.loading && !query.data ? <div className="ow-live-state" role="status">Einsätze und Standortfreigaben werden geladen …</div>
      : query.data ? <div className="ow-live-layout"><div className="ow-live-panel"><div className="ow-live-map">{markers.length ? <GoogleMapsLiveMap tenantId={scope.tenantId} markers={markers} selectedMarkerId={selected && livePosition(selected) ? selected.id : null} onMarkerSelect={select} height={380} appearance="light" showControls showMeta={false} /> : <div className="ow-live-state"><h3>Keine aktuelle Position</h3><p>{error ? 'Nach einer erfolgreichen Aktualisierung werden freigegebene Positionen wieder angezeigt.' : 'Nur aktuelle, ausreichend genaue GPS-Signale mit gültiger Freigabe erscheinen auf der Karte.'}</p></div>}</div><p className="ow-live-note">Ein fehlender Kartenpunkt ist keine Aussage über die Arbeitszeit. Erfassung und Standortfreigabe werden getrennt geprüft.</p>{selected ? <div className="ow-live-detail"><div className="ow-live-selected-heading"><h3>{selected.employeeName}</h3><span className="ow-live-tag" data-tone={livePosition(selected) ? 'good' : 'warning'}>{label(selected)}</span></div><p>{selected.title}{selected.clientName ? ` · ${selected.clientName}` : ''}</p><p className="ow-live-subtle">{selected.statusLabel} · Letztes Signal: {time(selected.lastSignalAt)}</p><div><button type="button" className="ow-live-button" onClick={() => router.push(selected.detailHref as never)}>Einsatz öffnen</button></div></div> : null}</div><div className="ow-live-panel"><div className="ow-live-panel-title"><h3>Einsätze im Überblick</h3><span className="ow-live-subtle">{visible.length}</span></div>{visible.length ? <div className="ow-live-position-list">{visible.map(row => <button type="button" key={row.id} className="ow-live-position" aria-pressed={selected?.id === row.id} aria-label={'Standort von ' + row.employeeName + ' auswählen'} onClick={() => select(row.id)}><strong>{row.employeeName}</strong><small>{row.title}{row.clientName ? ` · ${row.clientName}` : ''}</small><small>{row.statusLabel} · {time(row.lastSignalAt)}</small><span className="ow-live-tag" data-tone={livePosition(row) ? 'good' : 'muted'}>{label(row)}</span></button>)}</div> : <div className="ow-live-state"><h3>Keine passenden Einsätze</h3><p>{rows.length ? 'Passen Sie die Filter an.' : 'Für heute sind keine freigegebenen Einsätze verfügbar.'}</p></div>}</div></div> : null}
  </>;
}
