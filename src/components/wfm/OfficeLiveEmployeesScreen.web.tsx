import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useLiveRefresh } from '@/hooks/core/useLiveRefresh';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import { readOfficeLivePresence } from '@/lib/wfm/wfmOfficeLivePresence.web';
import type { WfmLiveEmployeeRow } from '@/types/modules/wfm';
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { officeWorktimeLiveCss } from './officeWorktimeLiveCss.web';

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
type Filter = 'all' | 'active' | 'pause' | 'ended';
const filterValue = (value: string): Filter => value === 'active' || value === 'pause' || value === 'ended' ? value : 'all';
const isActive = (row: WfmLiveEmployeeRow) => Boolean(row.session?.isOnline && !['ended', 'offline'].includes(row.session.status));
const time = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const duration = (value: number | undefined) => value == null || !Number.isFinite(value) ? '—' : `${Math.floor(Math.max(0, value) / 60)} Std. ${Math.round(Math.max(0, value) % 60)} Min.`;

export function OfficeLiveEmployeesScreen() {
  const auth = useAuth(); const tenantId = useServiceTenantId()?.trim() ?? '';
  const { roleKey, permissions, can } = usePermissions();
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('time.tracking.team.view'));
  const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, [...new Set(permissions)].sort()]);
  return <section className="ow-live" data-worktime-live="presence-v1"><style>{officeWorktimeLiveCss}</style>
    {!auth.authReady ? <div className="ow-live-state" role="status">Zugang wird geprüft …</div>
      : allowed && roleKey ? <Presence key={scopeKey} tenantId={tenantId} roleKey={roleKey} permissions={permissions} scopeKey={scopeKey} canMap={can('assist.access') && can('assist.tracking.view') && can('assist.assignments.view')} />
        : <div className="ow-live-state"><h2>Live-Übersicht</h2><p>Für diesen Bereich benötigen Sie einen Verwaltungszugang und die Freigabe für die Team-Zeiterfassung.</p></div>}
  </section>;
}

function Presence({ tenantId, roleKey, permissions, scopeKey, canMap }: { tenantId: string; roleKey: RoleKey; permissions: readonly PermissionKey[]; scopeKey: string; canMap: boolean }) {
  const router = useRouter(); const focused = useIsFocused();
  const params = useLocalSearchParams<{ search?: string | string[]; status?: string | string[] }>();
  const requestedSearch = first(params.search).slice(0, 180); const requestedFilter = filterValue(first(params.status));
  const [search, setSearch] = useState(requestedSearch); const [filter, setFilter] = useState<Filter>(requestedFilter);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  useEffect(() => setSearch(requestedSearch), [requestedSearch]); useEffect(() => setFilter(requestedFilter), [requestedFilter]);
  const query = useAsyncQuery(() => readOfficeLivePresence({ tenantId, roleKey, effectivePermissions: permissions }), [scopeKey], { queryKey: 'office-live:' + scopeKey, refreshOnAppFocus: false, onSuccess: () => setUpdatedAt(new Date().toISOString()) });
  const subscribe = useCallback((handler: () => void) => subscribeToWfmLiveChanges(tenantId, handler), [tenantId]);
  useLiveRefresh({ enabled: focused, subscribe, onRefresh: query.refresh, pollMs: 30000, refreshOnFocus: true });
  const wasFocused = useRef(focused);
  useEffect(() => { if (focused && !wasFocused.current) void query.refresh(); wasFocused.current = focused; }, [focused, query.refresh]);
  const rows = query.data?.rows ?? [];
  const visible = rows.filter(row => (!search || row.employeeName.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))) && (filter === 'all' || (filter === 'active' && isActive(row)) || (filter === 'pause' && row.session?.status === 'paused') || (filter === 'ended' && row.session?.status === 'ended')));
  const busy = query.loading || query.refreshing; const error = query.refreshError || query.error;
  const writeParams = (next: Record<string, string | undefined>) => { if (focused) router.setParams(next); };
  return <>
    <header className="ow-live-header"><div><h2>Live-Übersicht</h2><p className="ow-live-subtle">Heutige Erfassung im Team · Zeiten in Berliner Ortszeit</p></div><div className="ow-live-actions">{updatedAt ? <span className="ow-live-subtle">Stand {time(updatedAt)} Uhr</span> : null}<button type="button" className="ow-live-button" disabled={busy} onClick={() => void query.refresh()}>{busy ? <span className="ow-live-spinner" aria-hidden="true" /> : null}Aktualisieren</button>{canMap ? <button type="button" className="ow-live-button" data-primary onClick={() => router.push('/business/office/time-tracking/live-map' as never)}>Live-Karte öffnen</button> : null}</div></header>
    <div className="ow-live-metrics" aria-label="Heutige Erfassung"><div className="ow-live-metric"><span>Heute erfasst</span><strong>{query.data ? new Set(rows.map(row => row.employeeId)).size : '—'}</strong></div><div className="ow-live-metric"><span>Aktive Erfassung</span><strong>{query.data ? rows.filter(isActive).length : '—'}</strong></div><div className="ow-live-metric"><span>In Pause</span><strong>{query.data ? rows.filter(row => row.session?.status === 'paused').length : '—'}</strong></div></div>
    {error ? <div className="ow-live-message" data-error role="alert"><strong>{query.data ? 'Aktualisierung fehlgeschlagen.' : 'Live-Übersicht nicht verfügbar.'}</strong><p>{error}</p>{query.data ? <p>Die Liste zeigt den letzten erfolgreichen Abruf.</p> : null}<button type="button" className="ow-live-button" disabled={busy} onClick={() => void query.refresh()}>Erneut laden</button></div> : null}
    <div className="ow-live-toolbar"><label>Suche<input type="search" placeholder="Mitarbeitende suchen …" value={search} onChange={event => { const next = event.currentTarget.value.slice(0, 180); setSearch(next); writeParams({ search: next || undefined }); }} /></label><label>Status<select value={filter} onChange={event => { const next = filterValue(event.currentTarget.value); setFilter(next); writeParams({ status: next === 'all' ? undefined : next }); }}><option value="all">Alle Erfassungen</option><option value="active">Aktive Erfassung</option><option value="pause">In Pause</option><option value="ended">Beendet</option></select></label>{search || filter !== 'all' ? <button type="button" className="ow-live-button" onClick={() => { setSearch(''); setFilter('all'); writeParams({ search: undefined, status: undefined }); }}>Filter zurücksetzen</button> : null}</div>
    <div className="ow-live-panel" aria-busy={busy}><div className="ow-live-panel-title"><h3>Mitarbeitende heute</h3><span className="ow-live-subtle">{query.data ? `${visible.length} von ${rows.length}` : '—'}</span></div>
      {query.loading && !query.data ? <div className="ow-live-state" role="status">Erfassungen werden geladen …</div>
        : query.data && !visible.length ? <div className="ow-live-state"><h3>{rows.length ? 'Keine passenden Erfassungen' : 'Heute noch keine Erfassung'}</h3><p>{rows.length ? 'Passen Sie die Suche oder den Status an.' : 'Gestempelte Arbeitszeiten erscheinen hier, sobald sie gespeichert sind.'}</p></div>
          : query.data ? <div className="ow-live-table-wrap"><table><thead><tr><th scope="col">Mitarbeitende</th><th scope="col">Status</th><th scope="col">Beginn · Ende</th><th scope="col">Gespeicherte Nettozeit</th><th scope="col">Letztes Ereignis</th><th scope="col">Zeitkonto</th></tr></thead><tbody>{visible.map(row => <tr key={row.session?.id ?? row.employeeId}><td><strong>{row.employeeName}</strong></td><td><span className="ow-live-tag" data-tone={row.session?.status === 'paused' ? 'warning' : isActive(row) ? 'good' : 'muted'}>{row.statusLabel}</span></td><td><time>{time(row.session?.startedAt)} · {row.session?.endedAt ? time(row.session.endedAt) : isActive(row) ? 'läuft' : '—'}</time></td><td>{duration(row.session?.netMinutes)}<p className="ow-live-subtle">Pause {duration(row.session?.pauseMinutes)}</p></td><td><time>{time(row.lastEventAt)}</time></td><td><button type="button" className="ow-live-button" aria-label={'Zeitkonto von ' + row.employeeName + ' öffnen'} onClick={() => router.push(('/business/office/time-tracking/zeitkonten?employee=' + encodeURIComponent(row.employeeId) + '&account=' + encodeURIComponent(row.employeeId)) as never)}>Öffnen</button></td></tr>)}</tbody></table></div> : null}
      <p className="ow-live-note">Der Status folgt der gespeicherten Zeiterfassung. Die Nettozeit ist der gespeicherte Stand und läuft hier nicht als Stoppuhr weiter.</p>
    </div>
  </>;
}
