import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { MobilityWorkspaceNav } from '@/components/assist/MobilityWorkspaceNav.web';
import { GoogleMapsLiveMap } from '@/components/maps/GoogleMapsLiveMap.web';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useLiveRefresh } from '@/hooks/core/useLiveRefresh';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { fetchAssistMobilityJournal, fetchAssistMobilityTracking, fetchAssistMobilityTrip, correctAssistMobilityTrip } from '@/lib/assist/assistMobilityService.web';
import { filterMobilityTrips, mobilityBerlinMonth, mobilityMonthLabel, shiftMobilityMonth, validMobilityMonth, type AssistMobilityTrip, type AssistMobilityTrackingRow } from '@/lib/assist/assistMobilityModel.web';
import type { PermissionKey } from '@/types/permissions';
import type { RoleKey } from '@/types';
import { assistMobilityWorkspaceCss } from './assistMobilityWorkspaceCss.web';

type Scope = { tenantId: string; roleKey: RoleKey; effectivePermissions: readonly PermissionKey[] };
type Params = { tab?: string | string[]; month?: string | string[]; search?: string | string[]; employee?: string | string[]; status?: string | string[]; view?: string | string[]; trip?: string | string[]; source?: string | string[]; tracking?: string | string[]; signal?: string | string[]; sort?: string | string[]; purpose?: string | string[] };
type StatusFilter = 'all' | 'review' | 'recording' | 'completed' | 'cancelled';
type SignalFilter = 'all' | 'live' | 'attention';
type Sort = 'newest' | 'oldest' | 'employee' | 'distance';
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
const readStatus = (value: string): StatusFilter => ['review', 'recording', 'completed', 'cancelled'].includes(value) ? value as StatusFilter : 'all';
const readSignal = (value: string): SignalFilter => value === 'live' || value === 'attention' ? value : 'all';
const readSort = (value: string): Sort => ['oldest', 'employee', 'distance'].includes(value) ? value as Sort : 'newest';
const sourceValue = (value: string): AssistMobilityTrip['source'] | undefined => value === 'logbook' || value === 'legacy' ? value : undefined;
const tripKey = (row: AssistMobilityTrip) => row.source + ':' + row.id;
const datetime = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) + ' Uhr' : 'Nicht hinterlegt';
const distance = (value: number | null) => value === null ? 'Nicht erfasst' : value.toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' km';
const duration = (value: number | null) => value === null ? 'Dauer offen' : value < 60 ? Math.round(value) + ' Min.' : Math.floor(value / 60) + ' Std. ' + Math.round(value % 60) + ' Min.';
function age(value: string | null, now: number) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Kein bestätigtes Signal';
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  if (seconds < 60) return 'vor ' + seconds + ' Sek.';
  if (seconds < 3600) return 'vor ' + Math.floor(seconds / 60) + ' Min.';
  return 'vor ' + Math.floor(seconds / 3600) + ' Std.';
}
function Icon({ name, size = 18 }: { name: 'car' | 'refresh' | 'back' | 'next' | 'close' | 'pin'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    car: <><path d="m4 10 2-6h12l2 6M4 10h16v8H4zM6 18v3M18 18v3M7 14h2M15 14h2M2 10h2M20 10h2" /></>,
    refresh: <path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M19 16a8 8 0 0 1-13 3l-2-3" />,
    back: <path d="m14 6-6 6 6 6" />, next: <path d="m10 6 6 6-6 6" />, close: <path d="m6 6 12 12M18 6 6 18" />,
    pin: <><path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: string }) { return <span className="amw-badge" data-tone={tone}>{children}</span>; }
const tripTone = (row: AssistMobilityTrip) => row.needsReview ? 'warning' : ['completed', 'confirmed', 'corrected'].includes(row.status) ? 'good' : row.status === 'recording' ? 'blue' : 'muted';
function Empty({ title, children }: { title: string; children: ReactNode }) { return <div className="amw-state"><h2>{title}</h2><p>{children}</p></div>; }
function RefreshError({ error, hasData, busy, onRetry }: { error: string | null; hasData: boolean; busy: boolean; onRetry: () => void }) {
  return error ? <div className="amw-message" data-tone="error" role="alert"><p>{hasData ? 'Aktualisierung fehlgeschlagen. Die angezeigten Daten stammen vom letzten erfolgreichen Abruf.' : 'Die Daten konnten nicht geladen werden.'}</p><p>{error}</p><button type="button" className="amw-button" onClick={onRetry} disabled={busy}>Erneut laden</button></div> : null;
}
function useMobilityLiveRefresh(focused: boolean, editing: boolean, refresh: () => Promise<void>, pollMs: number) {
  const wasFocused = useRef(focused);
  useLiveRefresh({ enabled: focused && !editing, onRefresh: refresh, pollMs, refreshOnFocus: true });
  useEffect(() => { if (focused && !wasFocused.current && !editing) void refresh(); wasFocused.current = focused; }, [focused, editing, refresh]);
}

export function AssistMobilityWorkspace({ initialSelectedId = null }: { initialSelectedId?: string | null } = {}) {
  const auth = useAuth();
  const tenantId = useServiceTenantId()?.trim() ?? '';
  const { roleKey, permissions, can } = usePermissions();
  const userId = auth.user?.id ?? '';
  const scopeKey = JSON.stringify([tenantId, userId, roleKey, [...new Set(permissions)].sort()]);
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && userId && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('assist.access') && (can('assist.trips.view') || can('assist.tracking.view')));
  return <ScreenShell title="Fahrtenbuch & Tracking" contentOwnsHeader scroll={false}><style>{assistMobilityWorkspaceCss}</style>
    {!auth.authReady ? <section className="amw" role="status"><Empty title="Fahrtenbuch & Tracking">Zugang wird geprüft …</Empty></section>
      : allowed && roleKey ? <MobilityContent key={scopeKey} scopeKey={scopeKey} scope={{ tenantId, roleKey, effectivePermissions: permissions }} initialSelectedId={initialSelectedId} />
        : <section className="amw"><Empty title="Fahrtenbuch & Tracking">Für diesen Bereich benötigen Sie einen Verwaltungszugang und die Freigabe für Fahrtenbuch oder Tracking.</Empty></section>}
  </ScreenShell>;
}

function MobilityContent({ scope, scopeKey, initialSelectedId }: { scope: Scope; scopeKey: string; initialSelectedId: string | null }) {
  const params = useLocalSearchParams<Params>();
  const navigation = useNavigation();
  const [editing, setEditing] = useState(false); const [editorBusy, setEditorBusy] = useState(false);
  function beforeNavigate() {
    if (editorBusy) return false;
    if (editing && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return false;
    setEditing(false); return true;
  }
  usePreventRemove(editing || editorBusy, ({ data }) => { if (beforeNavigate()) navigation.dispatch(data.action); });
  useEffect(() => {
    if (!editing && !editorBusy) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', unload); return () => window.removeEventListener('beforeunload', unload);
  }, [editing, editorBusy]);
  const canTrips = scope.effectivePermissions.includes('assist.trips.view');
  const canTracking = scope.effectivePermissions.includes('assist.tracking.view') && scope.effectivePermissions.includes('assist.assignments.view');
  const tab = first(params.tab) === 'tracking' ? 'tracking' : canTrips ? 'fahrten' : 'tracking';
  const canTab = tab === 'fahrten' ? canTrips : canTracking;
  return <section className="amw" data-assist-mobility="workspace-v1">
    <MobilityWorkspaceNav active={tab === 'fahrten' ? 'journal' : 'tracking'} beforeNavigate={beforeNavigate} />
    {!canTab ? <Empty title="Bereich nicht freigegeben">Für Tracking sind die Freigaben für Tracking und Einsätze erforderlich. Wählen Sie einen verfügbaren Bereich aus.</Empty>
      : tab === 'fahrten' ? <Journal key={'journal:' + scopeKey} scope={scope} scopeKey={scopeKey} initialSelectedId={initialSelectedId} editing={editing} setEditing={setEditing} editorBusy={editorBusy} onBusy={setEditorBusy} />
        : <Tracking key={'tracking:' + scopeKey} scope={scope} scopeKey={scopeKey} />}
  </section>;
}

function Journal({ scope, scopeKey, initialSelectedId, editing, setEditing, editorBusy, onBusy }: { scope: Scope; scopeKey: string; initialSelectedId: string | null; editing: boolean; setEditing: (value: boolean) => void; editorBusy: boolean; onBusy: (value: boolean) => void }) {
  const router = useRouter(); const focused = useIsFocused(); const params = useLocalSearchParams<Params>();
  const requestedMonth = validMobilityMonth(first(params.month)) ? first(params.month) : mobilityBerlinMonth();
  const requestedSearch = first(params.search).slice(0, 180); const requestedEmployee = first(params.employee);
  const requestedStatus = readStatus(first(params.status)); const requestedView = first(params.view) === 'cards' ? 'cards' : 'table';
  const requestedSort = readSort(first(params.sort)); const requestedPurpose = first(params.purpose);
  const requestedTrip = first(params.trip) || initialSelectedId || ''; const requestedSource = sourceValue(first(params.source));
  const [month, setMonth] = useState(requestedMonth); const [search, setSearch] = useState(requestedSearch); const [employee, setEmployee] = useState(requestedEmployee);
  const [status, setStatus] = useState<StatusFilter>(requestedStatus); const [view, setView] = useState<'table' | 'cards'>(requestedView);
  const [sort, setSort] = useState<Sort>(requestedSort); const [purpose, setPurpose] = useState(requestedPurpose);
  const [selectedId, setSelectedId] = useState(requestedTrip); const [selectedSource, setSelectedSource] = useState<AssistMobilityTrip['source'] | undefined>(requestedSource);
  const selectionRef = useRef({ id: selectedId, source: selectedSource });
  selectionRef.current = { id: selectedId, source: selectedSource };
  const [notice, setNotice] = useState(''); const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setMonth(requestedMonth); }, [requestedMonth]); useEffect(() => { setSearch(requestedSearch); }, [requestedSearch]);
  useEffect(() => { setEmployee(requestedEmployee); }, [requestedEmployee]); useEffect(() => { setStatus(requestedStatus); }, [requestedStatus]);
  useEffect(() => { setView(requestedView); }, [requestedView]);
  useEffect(() => { setSort(requestedSort); }, [requestedSort]); useEffect(() => { setPurpose(requestedPurpose); }, [requestedPurpose]);
  useEffect(() => {
    if (selectionRef.current.id === requestedTrip && selectionRef.current.source === requestedSource) return;
    setSelectedId(requestedTrip); setSelectedSource(requestedSource); setEditing(false); setNotice('');
  }, [requestedTrip, requestedSource]);
  const query = useAsyncQuery(() => fetchAssistMobilityJournal({ ...scope, month }), [scopeKey, month], { queryKey: 'assist-mobility-journal:' + scopeKey + ':' + month, refreshOnAppFocus: false });
  const rows = query.data?.rows ?? [];
  const selectedInList = rows.find(row => row.id === selectedId && (!selectedSource || row.source === selectedSource));
  const detailQuery = useAsyncQuery(() => fetchAssistMobilityTrip({ ...scope, id: selectedId, source: selectedSource }), [scopeKey, selectedId, selectedSource], { queryKey: 'assist-mobility-trip:' + scopeKey + ':' + selectedSource + ':' + selectedId, enabled: Boolean(selectedId && !selectedInList), refreshOnAppFocus: false });
  const selected = selectedInList ?? detailQuery.data;
  const visible = useMemo(() => filterMobilityTrips(query.data?.rows ?? [], { search, employeeId: employee, status }).filter(row => !purpose || row.routeType === purpose).sort((left, right) => {
    if (sort === 'employee') return left.employeeName.localeCompare(right.employeeName, 'de') || right.startedAt.localeCompare(left.startedAt);
    if (sort === 'distance') return (right.distanceKm ?? -1) - (left.distanceKm ?? -1) || right.startedAt.localeCompare(left.startedAt);
    return sort === 'oldest' ? left.startedAt.localeCompare(right.startedAt) : right.startedAt.localeCompare(left.startedAt);
  }), [query.data, search, employee, status, sort, purpose]);
  const purposes = [...new Map(rows.filter(row => row.routeType).map(row => [row.routeType, row.routeTypeLabel])).entries()].sort((left, right) => left[1].localeCompare(right[1], 'de'));
  const error = query.refreshError || query.error; const busy = query.loading || query.refreshing;
  useMobilityLiveRefresh(focused, editing, query.refresh, 60000);
  const canCorrect = scope.effectivePermissions.includes('assist.trips.manage') && scope.effectivePermissions.includes('office.employees.edit');
  const completed = visible.filter(row => ['completed', 'corrected', 'confirmed'].includes(row.status));
  const measured = completed.filter(row => row.distanceKm !== null);
  const totalDistance = measured.reduce((sum, row) => sum + row.distanceKm!, 0);
  const filtersActive = Boolean(search || employee || status !== 'all' || purpose);
  const writeParams = (next: Record<string, string | undefined>) => { if (focused) router.setParams(next); };
  const returnQuery = () => new URLSearchParams({ tab: 'fahrten', month, ...(search ? { search } : {}), ...(employee ? { employee } : {}), ...(status !== 'all' ? { status } : {}), ...(purpose ? { purpose } : {}), ...(sort !== 'newest' ? { sort } : {}), ...(view === 'cards' ? { view } : {}) }).toString();
  function select(row: AssistMobilityTrip) {
    if (editorBusy) return;
    if (editing && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return;
    setSelectedId(row.id); setSelectedSource(row.source); setEditing(false); setNotice('');
    if (focused && initialSelectedId) router.replace(('/assist/fahrten/' + encodeURIComponent(row.id) + '?' + returnQuery() + '&source=' + row.source) as never);
    else writeParams({ trip: row.id, source: row.source });
    requestAnimationFrame(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView?.({ block: 'start', behavior: 'auto' }); });
  }
  function close() {
    if (editorBusy) return;
    if (editing && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return;
    setSelectedId(''); setSelectedSource(undefined); setEditing(false); setNotice('');
    if (focused && initialSelectedId) router.replace(('/assist/fahrten?' + returnQuery()) as never); else writeParams({ trip: undefined, source: undefined });
  }
  function changeMonth(next: string) {
    if (editorBusy || !validMobilityMonth(next) || (editing && !window.confirm('Ungespeicherte Änderungen verwerfen?'))) return;
    setMonth(next); setSelectedId(''); setSelectedSource(undefined); setEditing(false); setNotice('');
    if (focused && initialSelectedId) { const values = new URLSearchParams(returnQuery()); values.set('month', next); router.replace(('/assist/fahrten?' + values) as never); }
    else writeParams({ month: next, trip: undefined, source: undefined });
  }
  function reset() { setSearch(''); setEmployee(''); setStatus('all'); setPurpose(''); writeParams({ search: undefined, employee: undefined, status: undefined, purpose: undefined }); }
  async function saved(row: AssistMobilityTrip) {
    query.setData(previous => previous ? { ...previous, rows: previous.rows.map(item => tripKey(item) === tripKey(row) ? row : item) } : previous);
    detailQuery.setData(row); setEditing(false); setNotice('Die Fahrt wurde korrigiert.');
    await query.refresh();
  }
  return <>
    <header className="amw-header"><div className="amw-heading"><span className="amw-symbol"><Icon name="car" size={25} /></span><div><h1>Fahrtenbuch</h1><p>Fahrten prüfen und nachvollziehbar korrigieren.</p></div></div><div className="amw-actions">{query.data ? <span className="amw-sync">Stand {datetime(query.data.generatedAt)}</span> : null}<button className="amw-button" type="button" aria-label="Fahrtenbuch aktualisieren" disabled={busy || editing} onClick={() => void query.refresh()}>{busy ? <span className="amw-spinner" /> : <Icon name="refresh" />}Aktualisieren</button></div></header>
    <div className="amw-metrics" aria-label="Gefilterte Fahrten"><Metric label="Fahrten" value={query.data ? String(visible.length) : '—'} /><Metric label="Abgeschlossene Strecke" value={query.data ? distance(totalDistance) : '—'} /><Metric label="Prüfung offen" value={query.data ? String(visible.filter(row => row.needsReview).length) : '—'} /><Metric label="Aufzeichnungen laufen" value={query.data ? String(visible.filter(row => row.status === 'recording').length) : '—'} /></div>
    {completed.length > measured.length ? <p className="amw-message" data-tone="warning">Bei {completed.length - measured.length} abgeschlossenen Fahrten fehlt die Distanz. Diese Fahrten sind in der Kilometerzahl nicht enthalten.</p> : null}
    <RefreshError error={error} hasData={Boolean(query.data)} busy={busy} onRetry={() => void query.refresh()} />
    {query.data?.warnings.map(warning => <p key={warning} className="amw-message" data-tone="warning" role="status">{warning}</p>)}
    <div className="amw-toolbar" aria-label="Fahrten filtern">
      <div className="amw-period-label">Monat<div className="amw-period"><button className="amw-button" type="button" aria-label="Vorheriger Monat" onClick={() => changeMonth(shiftMobilityMonth(month, -1))}><Icon name="back" /></button><input type="month" aria-label="Monat auswählen" value={month} onChange={event => changeMonth(event.currentTarget.value)} /><button className="amw-button" type="button" aria-label="Nächster Monat" onClick={() => changeMonth(shiftMobilityMonth(month, 1))}><Icon name="next" /></button></div></div>
      <label className="amw-search">Suche<input type="search" value={search} placeholder="Name, Fahrtzweck, Adresse, Kennzeichen …" onChange={event => { const next = event.currentTarget.value.slice(0, 180); setSearch(next); writeParams({ search: next || undefined }); }} /></label>
      <label className="amw-filter">Mitarbeitende<select value={employee} onChange={event => { setEmployee(event.currentTarget.value); writeParams({ employee: event.currentTarget.value || undefined }); }}><option value="">Alle Mitarbeitenden</option>{employee && !query.data?.employees.some(item => item.id === employee) ? <option value={employee}>Ausgewählte Person ohne Fahrten</option> : null}{query.data?.employees.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="amw-filter">Status<select value={status} onChange={event => { const next = readStatus(event.currentTarget.value); setStatus(next); writeParams({ status: next === 'all' ? undefined : next }); }}><option value="all">Alle Status</option><option value="review">Prüfung offen</option><option value="recording">Aufzeichnung läuft</option><option value="completed">Abgeschlossen</option><option value="cancelled">Storniert</option></select></label>
      <label className="amw-filter">Fahrtart<select value={purpose} onChange={event => { setPurpose(event.currentTarget.value); writeParams({ purpose: event.currentTarget.value || undefined }); }}><option value="">Alle Fahrtarten</option>{purpose && !purposes.some(([key]) => key === purpose) ? <option value={purpose}>Ausgewählte Fahrtart ohne Fahrten</option> : null}{purposes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="amw-filter">Sortierung<select value={sort} onChange={event => { const next = readSort(event.currentTarget.value); setSort(next); writeParams({ sort: next === 'newest' ? undefined : next }); }}><option value="newest">Neueste zuerst</option><option value="oldest">Älteste zuerst</option><option value="employee">Mitarbeitende A–Z</option><option value="distance">Längste Strecke zuerst</option></select></label>
      <div className="amw-view-switch" aria-label="Darstellung">{(['table', 'cards'] as const).map(value => <button type="button" key={value} aria-pressed={view === value} onClick={() => { setView(value); writeParams({ view: value === 'table' ? undefined : value }); }}>{value === 'table' ? 'Tabelle' : 'Karten'}</button>)}</div>
    </div>
    <div className="amw-count"><span>{mobilityMonthLabel(month)}{query.data ? ' · ' + visible.length + ' von ' + rows.length + ' Fahrten' : ''}</span>{filtersActive ? <button type="button" className="amw-button" onClick={reset}>Filter zurücksetzen</button> : null}</div>
    <div className="amw-layout" data-selected={Boolean(selectedId)}>
      <section className="amw-results" aria-label="Fahrtenliste" aria-busy={busy}>
        {query.loading && !query.data ? <div className="amw-state" role="status">Fahrten werden geladen …</div>
          : !query.data && error ? <Empty title="Fahrten nicht verfügbar">Bitte laden Sie die Daten erneut.</Empty>
            : !visible.length ? <Empty title={filtersActive ? 'Keine passenden Fahrten' : 'Keine Fahrten in diesem Monat'}>{filtersActive ? 'Passen Sie die Filter an oder setzen Sie die Auswahl zurück.' : 'Wählen Sie einen anderen Monat. Neue Fahrten werden im Mitarbeiterportal erfasst.'}</Empty>
              : view === 'table' ? <div className="amw-table-scroll"><table className="amw-table"><thead><tr><th scope="col">Mitarbeitende · Zeit</th><th scope="col">Strecke · Fahrtzweck</th><th scope="col">Distanz · Dauer</th><th scope="col">Status</th></tr></thead><tbody>{visible.map(row => <tr key={tripKey(row)} data-selected={selectedId === row.id && (!selectedSource || selectedSource === row.source)}><td><button type="button" className="amw-row-button" aria-label={'Fahrt von ' + row.employeeName + ' am ' + datetime(row.startedAt) + ' öffnen'} onClick={() => select(row)}>{row.employeeName}</button><span className="amw-cell-sub">{datetime(row.startedAt)}</span><span className="amw-cell-sub">{row.vehicleLabel}</span></td><td><Route row={row} /><span className="amw-cell-sub">{row.purpose}</span></td><td><span className="amw-number">{distance(row.distanceKm)}</span><span className="amw-cell-sub">{duration(row.durationMinutes)}</span></td><td><Badge tone={tripTone(row)}>{row.statusLabel}</Badge><span className="amw-cell-sub">{row.routeTypeLabel}</span></td></tr>)}</tbody></table></div>
                : <div className="amw-card-list">{visible.map(row => <article className="amw-trip-card" key={tripKey(row)} data-selected={selectedId === row.id && (!selectedSource || selectedSource === row.source)}><div className="amw-card-top"><div><button type="button" className="amw-row-button" aria-label={'Fahrt von ' + row.employeeName + ' am ' + datetime(row.startedAt) + ' öffnen'} onClick={() => select(row)}>{row.employeeName}</button><span className="amw-cell-sub">{datetime(row.startedAt)}</span></div><Badge tone={tripTone(row)}>{row.statusLabel}</Badge></div><Route row={row} /><p className="amw-cell-sub">{row.purpose} · {row.vehicleLabel}</p><div className="amw-card-bottom"><strong className="amw-number">{distance(row.distanceKm)}</strong><span>{duration(row.durationMinutes)}</span></div></article>)}</div>}
      </section>
      {selectedId ? <aside className="amw-detail" aria-label="Fahrtdetails"><header className="amw-detail-header"><div><h2 ref={heading} tabIndex={-1}>{selected?.employeeName ?? 'Fahrtdetails'}</h2><p>{selected ? datetime(selected.startedAt) : 'Ausgewählte Fahrt'}</p></div><button type="button" className="amw-button" aria-label="Fahrtdetails schließen" disabled={editorBusy} onClick={close}><Icon name="close" /></button></header>
        {notice ? <p className="amw-message" data-tone="good" role="status">{notice}</p> : null}
        {!selectedInList ? <RefreshError error={detailQuery.refreshError || detailQuery.error} hasData={Boolean(detailQuery.data)} busy={detailQuery.loading || detailQuery.refreshing} onRetry={() => void detailQuery.refresh()} /> : null}
        {!selected && detailQuery.loading ? <p role="status">Fahrtdetails werden geladen …</p> : selected ? <TripDetail key={tripKey(selected)} row={selected} scope={scope} canCorrect={canCorrect} editing={editing} onEditing={setEditing} onSaved={saved} onBusy={onBusy} /> : !detailQuery.error ? <p>Diese Fahrt ist nicht verfügbar.</p> : null}
      </aside> : null}
    </div>
  </>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="amw-metric"><strong>{value}</strong><span>{label}</span></div>; }
function Route({ row }: { row: AssistMobilityTrip }) { return <div className="amw-route"><span>{row.startAddress || 'Startadresse nicht hinterlegt'}</span><span>{row.endAddress || (row.status === 'recording' ? 'Ziel noch offen' : 'Zieladresse nicht hinterlegt')}</span></div>; }
function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) { return <div className={full ? 'amw-full' : undefined}><dt>{label}</dt><dd>{children}</dd></div>; }
function TripDetail({ row, scope, canCorrect, editing, onEditing, onSaved, onBusy }: { row: AssistMobilityTrip; scope: Scope; canCorrect: boolean; editing: boolean; onEditing: (value: boolean) => void; onSaved: (row: AssistMobilityTrip) => Promise<void>; onBusy: (value: boolean) => void }) {
  const router = useRouter();
  const [km, setKm] = useState(''); const [purpose, setPurpose] = useState(''); const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [reason, setReason] = useState('');
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const busy = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const editable = canCorrect && row.source === 'logbook' && Boolean(row.employeeId && row.endedAt) && ['completed', 'confirmed', 'corrected', 'confirmation_required', 'review_required'].includes(row.status);
  function edit() { setKm(row.distanceKm === null ? '' : String(row.distanceKm).replace('.', ',')); setPurpose(row.purpose); setStart(row.startAddress || ''); setEnd(row.endAddress || ''); setReason(''); setError(''); onEditing(true); }
  async function save() {
    if (busy.current || !editable || !row.employeeId) return;
    const value = Number(km.trim().replace(',', '.'));
    if (!km.trim() || !Number.isFinite(value) || value < 0) { setError('Bitte geben Sie eine gültige Distanz ab 0 km ein.'); return; }
    if (!purpose.trim()) { setError('Bitte geben Sie einen Fahrtzweck ein.'); return; }
    if (!reason.trim()) { setError('Bitte begründen Sie die Korrektur.'); return; }
    busy.current = true; setSaving(true); onBusy(true); setError('');
    try {
      const result = await correctAssistMobilityTrip({ ...scope, id: row.id, employeeId: row.employeeId, expectedUpdatedAt: row.updatedAt, distanceKm: value, purpose: purpose.trim(), startAddress: start.trim(), endAddress: end.trim(), reason: reason.trim() });
      if (!mounted.current) return;
      if (!result.ok) { setError(result.error); return; }
      await onSaved(result.data);
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Die Korrektur konnte nicht gespeichert werden.'); }
    finally { busy.current = false; if (mounted.current) { setSaving(false); onBusy(false); } }
  }
  return <>
    <Badge tone={tripTone(row)}>{row.statusLabel}</Badge>
    <dl><Field label="Start">{datetime(row.startedAt)}</Field><Field label="Ende">{row.endedAt ? datetime(row.endedAt) : row.status === 'recording' ? 'Aufzeichnung läuft' : 'Nicht hinterlegt'}</Field><Field label="Distanz">{distance(row.distanceKm)}</Field><Field label="Dauer">{duration(row.durationMinutes)}</Field><Field label="Fahrzeug">{row.vehicleLabel}</Field><Field label="Art der Fahrt">{row.routeTypeLabel}</Field><Field label="Fahrtzweck" full>{row.purpose}</Field><Field label="Klient:in">{row.clientName || 'Nicht zugeordnet'}</Field><Field label="Streckenermittlung">{row.distanceSourceLabel}</Field></dl>
    <Route row={row} />
    {row.notes ? <div className="amw-detail-section"><h3>Notizen</h3><p className="amw-note">{row.notes}</p></div> : null}
    {row.source === 'legacy' ? <p className="amw-message" style={{ marginTop: 14 }}>Diese Fahrt stammt aus dem bisherigen Fahrtenbuch. Gespeicherte Angaben werden unverändert angezeigt.</p> : null}
    {!editing ? <div className="amw-actions amw-detail-section">{editable ? <button type="button" className="amw-button amw-button-primary" onClick={edit}>Fahrt korrigieren</button> : null}{row.assignmentId && scope.effectivePermissions.includes('assist.assignments.view') ? <button type="button" className="amw-button" onClick={() => router.push(('/assist/assignments/' + encodeURIComponent(row.assignmentId!)) as never)}>Einsatz öffnen</button> : null}</div> : <form className="amw-editor amw-detail-section" aria-label="Fahrt korrigieren" onSubmit={event => { event.preventDefault(); void save(); }}>
      <h3>Fahrt korrigieren</h3><small>Die Änderung wird mit Ihrer Begründung protokolliert.</small>
      {row.status === 'review_required' ? <p className="amw-message" data-tone="warning">Kilometer und Angaben können korrigiert werden. Die Zeitprüfung bleibt offen.</p> : null}
      {error ? <p className="amw-message" data-tone="error" role="alert">{error}</p> : null}
      <div className="amw-editor-grid"><label>Distanz in km<input inputMode="decimal" value={km} onChange={event => setKm(event.currentTarget.value)} required disabled={saving} /></label><label>Fahrtzweck<input value={purpose} onChange={event => setPurpose(event.currentTarget.value)} required maxLength={500} disabled={saving} /></label><label>Startadresse<input value={start} onChange={event => setStart(event.currentTarget.value)} maxLength={500} disabled={saving} /></label><label>Zieladresse<input value={end} onChange={event => setEnd(event.currentTarget.value)} maxLength={500} disabled={saving} /></label><label className="amw-full">Grund der Korrektur<textarea value={reason} onChange={event => setReason(event.currentTarget.value)} required maxLength={1000} disabled={saving} /></label></div>
      <div className="amw-actions"><button type="submit" className="amw-button amw-button-primary" disabled={saving}>{saving ? 'Wird gespeichert …' : 'Korrektur speichern'}</button><button type="button" className="amw-button" disabled={saving} onClick={() => onEditing(false)}>Abbrechen</button></div>
    </form>}
  </>;
}

function Tracking({ scope, scopeKey }: { scope: Scope; scopeKey: string }) {
  const router = useRouter(); const focused = useIsFocused(); const params = useLocalSearchParams<Params>();
  const heading = useRef<HTMLHeadingElement>(null);
  const requestedSearch = first(params.search).slice(0, 180); const requestedEmployee = first(params.employee); const requestedSignal = readSignal(first(params.signal)); const requestedId = first(params.tracking);
  const [search, setSearch] = useState(requestedSearch); const [employee, setEmployee] = useState(requestedEmployee); const [signal, setSignal] = useState<SignalFilter>(requestedSignal); const [selectedId, setSelectedId] = useState(requestedId); const [now, setNow] = useState(Date.now());
  useEffect(() => { setSearch(requestedSearch); }, [requestedSearch]); useEffect(() => { setEmployee(requestedEmployee); }, [requestedEmployee]); useEffect(() => { setSignal(requestedSignal); }, [requestedSignal]); useEffect(() => { setSelectedId(requestedId); }, [requestedId]);
  useEffect(() => { if (!focused) return; setNow(Date.now()); const interval = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(interval); }, [focused]);
  const query = useAsyncQuery(() => fetchAssistMobilityTracking(scope), [scopeKey], { queryKey: 'assist-mobility-tracking:' + scopeKey, refreshOnAppFocus: false });
  useEffect(() => { if (query.data) setNow(Date.now()); }, [query.data]);
  useMobilityLiveRefresh(focused, false, query.refresh, 30000);
  const error = query.refreshError || query.error; const busy = query.loading || query.refreshing;
  const rows = useMemo(() => (query.data?.rows ?? []).map((row): AssistMobilityTrackingRow => {
    const timestamp = row.position?.capturedAt ? Date.parse(row.position.capturedAt) : NaN;
    if (error && row.trackingState === 'live') return { ...row, trackingState: 'stale', trackingLabel: 'Standort nicht erneut bestätigt', position: null };
    if (row.trackingState === 'live' && (!Number.isFinite(timestamp) || now - timestamp > 150000 || timestamp > now)) return { ...row, trackingState: 'stale', trackingLabel: 'GPS-Signal veraltet', position: null };
    return row;
  }), [query.data, now, error]);
  const employees = [...new Map(rows.filter(row => row.employeeId).map(row => [row.employeeId!, { id: row.employeeId!, name: row.employeeName }])).values()].sort((left, right) => left.name.localeCompare(right.name, 'de'));
  const words = search.trim().toLocaleLowerCase('de-DE').split(/\s+/).filter(Boolean);
  const visible = rows.filter(row => (!employee || row.employeeId === employee) && (signal === 'all' || (signal === 'live' ? row.trackingState === 'live' : row.trackingState !== 'live')) && words.every(word => [row.employeeName, row.clientName, row.title, row.statusLabel].join(' ').toLocaleLowerCase('de-DE').includes(word)));
  const selected = rows.find(row => row.id === selectedId) ?? null;
  const markers = visible.filter(row => row.position && row.trackingState === 'live').map(row => ({ ...row.position!, id: row.id, label: row.employeeName, subtitle: row.clientName ?? row.title }));
  const writeParams = (next: Record<string, string | undefined>) => { if (focused) router.setParams(next); };
  const select = (id: string) => { setSelectedId(id); writeParams({ tracking: id }); requestAnimationFrame(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView?.({ block: 'start', behavior: 'auto' }); }); };
  const filtersActive = Boolean(search || employee || signal !== 'all');
  return <>
    <header className="amw-header"><div className="amw-heading"><span className="amw-symbol"><Icon name="pin" size={25} /></span><div><h1>Tracking</h1><p>Einsätze und freigegebene GPS-Signale.</p></div></div><div className="amw-actions">{query.data ? <span className="amw-sync">Stand {datetime(query.data.generatedAt)}</span> : null}<button type="button" className="amw-button" aria-label="Tracking aktualisieren" disabled={busy} onClick={() => void query.refresh()}>{busy ? <span className="amw-spinner" /> : <Icon name="refresh" />}Aktualisieren</button></div></header>
    <div className="amw-metrics" aria-label="Gefilterte Tracking-Übersicht"><Metric label="Einsätze" value={query.data ? String(visible.length) : '—'} /><Metric label="GPS aktuell" value={query.data ? String(visible.filter(row => row.trackingState === 'live').length) : '—'} /><Metric label="Kein aktuelles Signal" value={query.data ? String(visible.filter(row => row.trackingState !== 'live').length) : '—'} /></div>
    <RefreshError error={error} hasData={Boolean(query.data)} busy={busy} onRetry={() => void query.refresh()} />
    {query.data?.warnings.map(warning => <p className="amw-message" data-tone="warning" role="status" key={warning}>{warning}</p>)}
    <div className="amw-toolbar"><label className="amw-search">Suche<input type="search" placeholder="Mitarbeitende, Klient:in, Einsatz …" value={search} onChange={event => { const next = event.currentTarget.value.slice(0, 180); setSearch(next); writeParams({ search: next || undefined }); }} /></label><label className="amw-filter">Mitarbeitende<select value={employee} onChange={event => { setEmployee(event.currentTarget.value); writeParams({ employee: event.currentTarget.value || undefined }); }}><option value="">Alle Mitarbeitenden</option>{employee && !employees.some(item => item.id === employee) ? <option value={employee}>Ausgewählte Person ohne Einsatz</option> : null}{employees.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="amw-filter">GPS-Signal<select value={signal} onChange={event => { const next = readSignal(event.currentTarget.value); setSignal(next); writeParams({ signal: next === 'all' ? undefined : next }); }}><option value="all">Alle Signale</option><option value="live">GPS aktuell</option><option value="attention">Kein aktuelles Signal</option></select></label></div>
    <div className="amw-count"><span>{query.data ? visible.length + ' von ' + rows.length + ' Einsätzen' : 'Einsatzübersicht'} · Standortdaten werden alle 30 Sekunden geprüft.</span>{filtersActive ? <button type="button" className="amw-button" onClick={() => { setSearch(''); setEmployee(''); setSignal('all'); writeParams({ search: undefined, employee: undefined, signal: undefined }); }}>Filter zurücksetzen</button> : null}</div>
    <div className="amw-layout" data-selected="true">
      <section className="amw-results" aria-label="Tracking-Liste" aria-busy={busy}>{query.loading && !query.data ? <p className="amw-state" role="status">Tracking wird geladen …</p> : !query.data && error ? <Empty title="Tracking nicht verfügbar">Bitte laden Sie die Standortdaten erneut.</Empty> : !visible.length ? <Empty title={filtersActive ? 'Keine passenden Einsätze' : 'Keine laufenden Einsätze'}>{filtersActive ? 'Passen Sie Ihre Filter an.' : 'Freigegebene Standortdaten erscheinen, sobald Mitarbeitende einen Einsatz mit Tracking beginnen.'}</Empty> : <div className="amw-tracking-list">{visible.map(row => <button type="button" className="amw-tracking-row" key={row.id} aria-pressed={row.id === selectedId} onClick={() => select(row.id)}><div className="amw-card-top"><div><strong>{row.employeeName}</strong><span className="amw-cell-sub">{row.clientName ?? row.title}</span></div><Badge tone={row.trackingState === 'live' ? 'good' : row.trackingState === 'stale' || row.trackingState === 'invalid' ? 'warning' : 'muted'}>{row.trackingLabel}</Badge></div><span className="amw-cell-sub">{row.statusLabel} · Geplant {datetime(row.plannedStartAt)}</span><span className="amw-cell-sub">Letztes Signal: {row.lastSignalAt ? datetime(row.lastSignalAt) + ' · ' + age(row.lastSignalAt, now) : 'Nicht vorhanden'}</span></button>)}</div>}</section>
      <aside className="amw-detail" aria-label="Tracking-Details"><header className="amw-detail-header"><div><h2 ref={heading} tabIndex={-1}>{selected?.employeeName ?? 'Standorte'}</h2><p>{selected ? selected.clientName ?? selected.title : 'Wählen Sie einen Einsatz für Details.'}</p></div>{selectedId ? <button className="amw-button" type="button" aria-label="Tracking-Auswahl aufheben" onClick={() => { setSelectedId(''); writeParams({ tracking: undefined }); }}><Icon name="close" /></button> : null}</header>
        {selectedId && !selected && query.data ? <p className="amw-message" role="status">Der ausgewählte Einsatz ist in dieser Übersicht nicht mehr verfügbar.</p> : null}
        {selected ? <Badge tone={selected.trackingState === 'live' ? 'good' : 'warning'}>{selected.trackingLabel}</Badge> : null}
        {(selected ? selected.position : markers.length) ? <><div className="amw-map" style={{ marginTop: 13 }} onWheelCapture={event => event.stopPropagation()}><GoogleMapsLiveMap position={selected?.position ?? null} markers={selected?.position ? [{ ...selected.position, id: selected.id, label: selected.employeeName, subtitle: selected.clientName ?? selected.title }] : markers} selectedMarkerId={selected?.id} onMarkerSelect={select} tenantId={scope.tenantId} routeIdentity={scope.tenantId + ':' + (selected?.id ?? 'overview')} height={320} appearance="light" showMeta={false} showControls={false} /></div><p className="amw-map-hint">Karte ziehen oder mit + / − vergrößern. Das Mausrad scrollt die Seite.</p></> : <div className="amw-tracking-empty" style={{ marginTop: 13 }}><strong>{selected?.trackingLabel ?? 'Keine aktuellen Standorte'}</strong><p>{selected?.trackingState === 'consent_missing' ? 'Für diesen Einsatz liegt keine gültige Standortfreigabe vor.' : selected?.trackingState === 'stale' ? 'Der letzte Standort wird nicht als aktuelle Position auf der Karte dargestellt.' : 'Die Karte zeigt ausschließlich aktuelle, freigegebene GPS-Positionen.'}</p></div>}
        {selected ? <><p className="amw-signal">Letztes Signal: {selected.lastSignalAt ? datetime(selected.lastSignalAt) + ' · ' + age(selected.lastSignalAt, now) : 'Nicht vorhanden'}</p><dl><Field label="Geplanter Beginn">{datetime(selected.plannedStartAt)}</Field><Field label="Geplantes Ende">{datetime(selected.plannedEndAt)}</Field><Field label="Einsatzstatus">{selected.statusLabel}</Field><Field label="GPS-Genauigkeit">{selected.position?.accuracyMeters == null ? 'Nicht verfügbar' : '±' + Math.round(selected.position.accuracyMeters) + ' m'}</Field></dl>{scope.effectivePermissions.includes('assist.assignments.view') ? <button type="button" className="amw-button amw-button-primary" onClick={() => router.push(selected.detailHref as never)}>Einsatz öffnen</button> : null}</> : null}
      </aside>
    </div>
  </>;
}
