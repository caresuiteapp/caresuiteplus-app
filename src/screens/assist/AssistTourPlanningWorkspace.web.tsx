import { WebActionIcon } from '@/components/icons/WebActionIcon.web';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { MobilityWorkspaceNav } from '@/components/assist/MobilityWorkspaceNav.web';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useLiveRefresh } from '@/hooks/core/useLiveRefresh';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { fetchAssistTourPlanning } from '@/lib/assist/assistTourPlanningService.web';
import { getAssistReplacementCandidates, type AssistTourPlanningSnapshot, type AssistTourVisit, type AssistTourIssue } from '@/lib/assist/assistTourPlanningModel.web';
import { addAssistDays, assistBerlinDate, validAssistDate } from '@/lib/assist/assistClientsWorkspaceModel.web';
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { assistTourPlanningCss } from './assistTourPlanningCss.web';

type View = 'planning' | 'replacement';
type Filter = 'all' | 'attention' | 'unassigned';
type Params = { tourDate?: string | string[]; tourEmployee?: string | string[]; tourSearch?: string | string[]; tourFilter?: string | string[]; tourVisit?: string | string[]; tourDetail?: string | string[] };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
const readFilter = (value: string): Filter => value === 'attention' || value === 'unassigned' ? value : 'all';
const readDate = (value: string) => validAssistDate(value) ? value : assistBerlinDate(new Date());
const formatDate = (date: string) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date + 'T12:00:00Z'));
const formatTime = (date: string) => Number.isFinite(Date.parse(date)) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(date)) : 'Zeit prüfen';
const minutesLabel = (minutes: number) => `${Math.floor(minutes / 60)} Std.${minutes % 60 ? ' ' + minutes % 60 + ' Min.' : ''}`;
const employeeLabel = (visit: AssistTourVisit) => visit.employeeName || (visit.employeeId ? 'Mitarbeitende zugeordnet' : 'Noch niemand zugewiesen');
const timeRange = (visit: AssistTourVisit) => `${formatTime(visit.scheduledStart)}–${formatTime(visit.scheduledEnd)}${assistBerlinDate(new Date(visit.scheduledStart)) !== assistBerlinDate(new Date(visit.scheduledEnd)) ? ' (' + new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' }).format(new Date(visit.scheduledEnd)) + ')' : ''}`;
const visitRoute = (id: string, edit = false) => '/assist/assignments/' + encodeURIComponent(id) + (edit ? '/edit' : '');

function Icon({ name, size = 20 }: { name: 'route' | 'refresh' | 'plus' | 'left' | 'right'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    route: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><path d="M6 7v5a4 4 0 0 0 8 0V9a4 4 0 0 1 4-4h1M18 17v-3" /></>,
    refresh: <path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M19 16a8 8 0 0 1-13 3l-2-3" />,
    plus: <path d="M12 5v14M5 12h14" />,
    left: <path d="m14 5-7 7 7 7" />,
    right: <path d="m10 5 7 7-7 7" />,
  };
  return <WebActionIcon size={size}>{paths[name]}</WebActionIcon>;
}

export function AssistTourPlanningWorkspace({ view = 'planning' }: { view?: View }) {
  const auth = useAuth();
  const tenantId = useServiceTenantId()?.trim() ?? '';
  const { roleKey, permissions, can } = usePermissions();
  const userId = auth.user?.id ?? '';
  const scope = JSON.stringify([tenantId, userId, roleKey, [...new Set(permissions)].sort()]);
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && userId && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('assist.access') && can('assist.assignments.view'));
  const title = view === 'planning' ? 'Tourenplanung' : 'Touren & Vertretung';
  return <ScreenShell title={title} contentOwnsHeader scroll={false}>
    <style>{assistTourPlanningCss}</style>
    {!auth.authReady ? <section className="atw atw-state" role="status"><h1>{title}</h1><p>Zugang wird geprüft …</p></section>
      : allowed && roleKey ? <TourPlanningContent key={scope + view} scope={scope} tenantId={tenantId} roleKey={roleKey} permissions={permissions} view={view} />
        : <section className="atw atw-state" role="status"><h1>{title}</h1><p>Für die Tourenplanung benötigen Sie einen Verwaltungszugang und die Freigabe für Assist und Einsätze.</p></section>}
  </ScreenShell>;
}

function TourPlanningContent({ scope, tenantId, roleKey, permissions, view }: { scope: string; tenantId: string; roleKey: RoleKey; permissions: readonly PermissionKey[]; view: View }) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const wasFocused = useRef(isFocused);
  const params = useLocalSearchParams<Params>();
  const parameterDate = readDate(first(params.tourDate));
  const parameterEmployee = first(params.tourEmployee);
  const parameterSearch = first(params.tourSearch).slice(0, 180);
  const parameterFilter = readFilter(first(params.tourFilter));
  const parameterVisit = first(params.tourVisit);
  const [date, setDate] = useState(parameterDate);
  const [employee, setEmployee] = useState(parameterEmployee);
  const [search, setSearch] = useState(parameterSearch);
  const [filter, setFilter] = useState<Filter>(parameterFilter);
  const [selectedId, setSelectedId] = useState(parameterVisit);
  const [detailOpen, setDetailOpen] = useState(Boolean(parameterVisit) && first(params.tourDetail) !== '0');
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const detailPane = useRef<HTMLElement>(null);
  const listPane = useRef<HTMLElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const canManage = permissions.includes('assist.assignments.manage');
  const query = useAsyncQuery<AssistTourPlanningSnapshot>(
    () => fetchAssistTourPlanning({ tenantId, roleKey, effectivePermissions: permissions, date }),
    [scope, date], { queryKey: 'assist-tours:' + scope + ':' + date },
  );
  useLiveRefresh({ enabled: isFocused, onRefresh: query.refresh, pollMs: 60000, refreshOnFocus: true });
  useEffect(() => {
    if (isFocused && !wasFocused.current) void query.refresh();
    wasFocused.current = isFocused;
  }, [isFocused, query.refresh]);
  useEffect(() => {
    if (isFocused && !validAssistDate(first(params.tourDate))) router.setParams({ tourDate: parameterDate });
  }, [isFocused, params.tourDate, parameterDate, router]);
  useEffect(() => { if (isFocused) setDate(parameterDate); }, [parameterDate, isFocused]);
  useEffect(() => { if (isFocused) setEmployee(parameterEmployee); }, [parameterEmployee, isFocused]);
  useEffect(() => { if (isFocused) setSearch(parameterSearch); }, [parameterSearch, isFocused]);
  useEffect(() => { if (isFocused) setFilter(parameterFilter); }, [parameterFilter, isFocused]);
  useEffect(() => { if (isFocused) setSelectedId(parameterVisit); }, [parameterVisit, isFocused]);
  useEffect(() => { if (isFocused) setDetailOpen(Boolean(parameterVisit) && first(params.tourDetail) !== '0'); }, [parameterVisit, params.tourDetail, isFocused]);

  const snapshot = query.data;
  const refreshing = query.loading || query.refreshing;
  const staleError = query.refreshError || query.error;
  const visits = snapshot?.visits ?? [];
  const selected = visits.find(visit => visit.id === selectedId) ?? null;
  const normalizedSearch = search.toLocaleLowerCase('de-DE').trim();
  const visibleTours = useMemo(() => (snapshot?.tours ?? []).filter(tour => !employee || (employee === 'unassigned' ? !tour.employeeId : tour.employeeId === employee)).map(tour => ({
    ...tour,
    allVisits: tour.visits,
    visits: tour.visits.filter(visit => (filter !== 'attention' || visit.issues.length > 0) && (filter !== 'unassigned' || !visit.employeeId)
      && (!normalizedSearch || [visit.clientName, visit.address, visit.title, visit.employeeName].filter(Boolean).join(' ').toLocaleLowerCase('de-DE').includes(normalizedSearch))),
  })).filter(tour => tour.visits.length > 0), [snapshot, employee, filter, normalizedSearch]);
  const visibleCount = visibleTours.reduce((total, tour) => total + tour.visits.length, 0);
  const selectedVisible = selected && visibleTours.some(tour => tour.visits.some(visit => visit.id === selected.id));
  const candidates = useMemo(() => snapshot && selected ? getAssistReplacementCandidates(snapshot, selected.id) : [], [snapshot, selected]);
  const employeeOptions = useMemo(() => {
    const options = new Map((snapshot?.employees ?? []).map(person => [person.id, person.name]));
    for (const tour of snapshot?.tours ?? []) if (tour.employeeId && !options.has(tour.employeeId)) options.set(tour.employeeId, tour.name);
    return [...options].sort((a, b) => a[1].localeCompare(b[1], 'de'));
  }, [snapshot]);
  const activeVisits = visits.filter(visit => !['cancelled', 'draft'].includes(visit.status));
  const unassigned = activeVisits.filter(visit => !visit.employeeId).length;
  const attention = visits.filter(visit => visit.issues.length > 0).length;
  const assignedTours = snapshot?.tours.filter(tour => tour.employeeId && tour.visits.some(visit => !['cancelled', 'draft'].includes(visit.status))).length ?? 0;

  function changeDate(next: string) {
    if (!isFocused || !validAssistDate(next)) return;
    setDate(next); setSelectedId(''); setDetailOpen(false);
    router.setParams({ tourDate: next, tourVisit: undefined, tourDetail: '0' });
  }
  function changeEmployee(next: string) {
    if (!isFocused) return;
    setEmployee(next); setDetailOpen(false);
    router.setParams({ tourEmployee: next || undefined, tourDetail: '0' });
  }
  function changeFilter(next: Filter) {
    if (!isFocused) return;
    setFilter(next); setDetailOpen(false);
    router.setParams({ tourFilter: next === 'all' ? undefined : next, tourDetail: '0' });
  }
  function resetFilters() {
    if (!isFocused) return;
    setEmployee(''); setSearch(''); setFilter('all'); setDetailOpen(false);
    router.setParams({ tourEmployee: undefined, tourSearch: undefined, tourFilter: undefined, tourDetail: '0' });
  }
  function selectVisit(id: string) {
    if (!isFocused) return;
    setSelectedId(id); setDetailOpen(true);
    router.setParams({ tourVisit: id, tourDetail: '1', tourDate: date });
    requestAnimationFrame(() => { if (detailPane.current) detailPane.current.scrollTop = 0; detailHeading.current?.focus({ preventScroll: true }); });
  }
  function backToList() {
    if (!isFocused) return;
    setDetailOpen(false); router.setParams({ tourDetail: '0' });
    requestAnimationFrame(() => { const row = rowRefs.current.get(selectedId); if (row) { row.focus({ preventScroll: true }); row.scrollIntoView?.({ block: 'nearest' }); } else listPane.current?.focus({ preventScroll: true }); });
  }
  const navigate = (path: string) => { if (isFocused) router.push(path as never); };
  const createRoute = '/assist/assignments?create=1&assignmentDate=' + date + (employee && employee !== 'unassigned' && snapshot?.employees.some(person => person.id === employee && person.active) ? '&employeeId=' + encodeURIComponent(employee) : '');
  const openReplacement = () => selected && navigate('/assist/touren-vertretung?tourDate=' + date + '&tourVisit=' + encodeURIComponent(selected.id) + '&tourDetail=1');

  return <section className="atw" data-assist-tour-planning="workspace-v1" data-tour-view={view} data-detail-open={Boolean(detailOpen && selected && selectedVisible)}>
    <header className="atw-heading">
      <div className="atw-heading-main"><span className="atw-symbol"><Icon name="route" size={24} /></span><div><span className="atw-eyebrow">ASSIST</span><h1>{view === 'planning' ? 'Tourenplanung' : 'Touren & Vertretung'}</h1><p>{view === 'planning' ? 'Gespeicherte Einsätze als Tagesfahrplan je Mitarbeitenden.' : 'Zuweisungen prüfen und passende Vertretungen vorbereiten.'}</p></div></div>
      <div className="atw-actions"><button type="button" className="atw-button" onClick={() => navigate('/assist/calendar')}>Kalender</button>{canManage ? <button type="button" className="atw-button atw-button-primary" onClick={() => navigate(createRoute)}><Icon name="plus" />Einsatz planen</button> : null}</div>
    </header>
    <MobilityWorkspaceNav active={view === 'planning' ? 'tours' : 'replacement'} />
    <div className="atw-summary" aria-label="Tagesübersicht">
      <Metric label="Einsätze" value={snapshot ? activeVisits.length : null} detail="Ohne Entwürfe und Absagen" />
      <Metric label="Tagestouren" value={snapshot ? assignedTours : null} detail="Mit zugewiesenen Einsätzen" />
      <Metric label="Ohne Zuweisung" value={snapshot ? unassigned : null} detail="Mitarbeitende auswählen" warning={unassigned > 0} />
      <Metric label="Zu prüfen" value={snapshot ? attention : null} detail="Konflikte oder offene Angaben" warning={attention > 0} />
    </div>
    <div className="atw-toolbar">
      <label className="atw-field atw-date-field">Datum<span className="atw-date-controls"><button className="atw-button" type="button" aria-label="Vorheriger Tag" onClick={() => changeDate(addAssistDays(date, -1))}><Icon name="left" /></button><input type="date" aria-label="Planungstag" value={date} onChange={event => changeDate(event.target.value)} /><button className="atw-button" type="button" aria-label="Nächster Tag" onClick={() => changeDate(addAssistDays(date, 1))}><Icon name="right" /></button></span></label>
      <label className="atw-field atw-employee-field">Mitarbeitende<select aria-label="Touren nach Mitarbeitenden filtern" value={employee} onChange={event => changeEmployee(event.target.value)}><option value="">Alle Mitarbeitenden</option><option value="unassigned">Ohne Zuweisung</option>{employee && employee !== 'unassigned' && !employeeOptions.some(([id]) => id === employee) ? <option value={employee}>Auswahl nicht verfügbar</option> : null}{employeeOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="atw-field atw-search-field">Einsätze durchsuchen<input type="search" value={search} maxLength={180} autoComplete="off" placeholder="Name, Adresse oder Leistung" onChange={event => { if (!isFocused) return; const value = event.target.value.slice(0, 180); setSearch(value); setDetailOpen(false); router.setParams({ tourSearch: value || undefined, tourDetail: '0' }); }} /></label>
      <div className="atw-actions"><button type="button" className="atw-button" onClick={() => changeDate(assistBerlinDate(new Date()))}>Heute</button><button type="button" className="atw-button" disabled={refreshing} aria-label="Tourenplanung aktualisieren" onClick={() => void query.refresh()}><Icon name="refresh" />{refreshing ? 'Lädt …' : 'Aktualisieren'}</button></div>
    </div>
    {staleError ? <div className="atw-message" data-tone="error" role="alert"><p>{snapshot ? 'Die Aktualisierung ist fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand.' : 'Die Tourenplanung konnte nicht geladen werden.'}</p><p>{staleError}</p><button type="button" className="atw-button" disabled={refreshing} onClick={() => void query.refresh()}>Erneut laden</button></div> : null}
    {snapshot?.warnings.length ? <div className="atw-message" data-tone="warning" role="status">{snapshot.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div> : null}
    {snapshot && selectedId && !selected ? <p className="atw-message" role="status">Der ausgewählte Einsatz ist an diesem Tag nicht mehr verfügbar. Wählen Sie einen Eintrag aus dem Tagesfahrplan.</p> : null}
    {selected && !selectedVisible ? <p className="atw-message" role="status">Der ausgewählte Einsatz wird durch die aktuellen Filter ausgeblendet. <button type="button" className="atw-button atw-button-small" onClick={resetFilters}>Filter zurücksetzen</button></p> : null}
    <div className="atw-body">
      <section className="atw-list" aria-label="Tagesfahrplan" tabIndex={-1} ref={listPane}>
        <div className="atw-list-meta"><div><h2>{formatDate(date)}</h2><span>{snapshot ? `${visibleCount} von ${visits.length} Einsätzen · Stand ${formatTime(snapshot.loadedAt)} Uhr` : 'Planungsdaten werden geladen'}</span></div><div className="atw-filters" aria-label="Einsätze filtern">{(['all', 'attention', 'unassigned'] as Filter[]).map(value => <button key={value} type="button" className="atw-filter" aria-pressed={filter === value} onClick={() => changeFilter(value)}>{value === 'all' ? 'Alle' : value === 'attention' ? 'Zu prüfen' : 'Ohne Zuweisung'}</button>)}</div></div>
        {!snapshot ? <div className="atw-empty" role="status"><h2>{query.loading ? 'Tagesfahrplan wird geladen …' : 'Keine Daten verfügbar'}</h2><p>{query.loading ? 'Einsätze, Zuweisungen und Planungsangaben werden abgeglichen.' : 'Bitte laden Sie die Übersicht erneut.'}</p></div>
          : visibleTours.length === 0 ? <div className="atw-empty" role="status"><h2>{visits.length ? 'Keine passenden Einsätze' : 'Für diesen Tag sind keine Einsätze hinterlegt'}</h2><p>{visits.length ? 'Passen Sie die Auswahl an, um andere Einsätze zu sehen.' : 'Wählen Sie einen anderen Tag oder planen Sie einen Einsatz.'}</p>{visits.length ? <button className="atw-button" type="button" onClick={resetFilters}>Filter zurücksetzen</button> : canManage ? <button className="atw-button" type="button" onClick={() => navigate(createRoute)}>Einsatz planen</button> : null}</div>
            : <div className="atw-tours">{visibleTours.map(tour => <article className="atw-tour" key={tour.employeeId ?? 'unassigned'}><header className="atw-tour-head"><div><h3>{tour.name}</h3><p>{tour.visits.length} {tour.visits.length === 1 ? 'Einsatz' : 'Einsätze'} angezeigt · {minutesLabel(tour.workMinutes)} Einsatzzeit am Tag</p></div>{tour.issues.some(issue => issue.code === 'long_day') ? <span className="atw-badge" data-tone="warning">Arbeitszeit prüfen</span> : null}</header><ol className="atw-stops">{tour.visits.map((visit, index) => <li key={visit.id}><button type="button" className="atw-stop" aria-pressed={selectedId === visit.id} aria-label={`${visit.clientName}, ${timeRange(visit)}`} onClick={() => selectVisit(visit.id)} ref={node => { if (node) rowRefs.current.set(visit.id, node); else rowRefs.current.delete(visit.id); }}><span className="atw-stop-number">{index + 1}</span><span className="atw-stop-copy"><span className="atw-stop-top"><span className="atw-stop-time">{timeRange(visit)}</span><span className="atw-badge" data-tone={visit.status === 'unknown' ? 'unknown' : undefined}>{visit.statusLabel}</span>{visit.isVirtual ? <span className="atw-badge">Serie</span> : null}</span><span className="atw-stop-name">{visit.clientName}</span><small>{visit.title} · {visit.durationMinutes} Min.</small><small>{visit.address || 'Einsatzadresse fehlt'}</small>{visit.issues.length ? <span className="atw-stop-warnings"><span className="atw-badge" data-tone={visit.issues.some(issue => issue.severity === 'error') ? 'error' : 'warning'}>{visit.issues.length} {visit.issues.length === 1 ? 'Prüfpunkt' : 'Prüfpunkte'}</span><small>{visit.issues[0].message}</small></span> : null}</span></button>{tour.employeeId && index < tour.visits.length - 1 && tour.allVisits.indexOf(tour.visits[index + 1]) === tour.allVisits.indexOf(visit) + 1 ? <Gap current={visit} next={tour.visits[index + 1]} /> : null}</li>)}</ol></article>)}</div>}
      </section>
      <section className="atw-detail-pane" aria-label="Einsatz und Vertretung" ref={detailPane}>
        {selected && selectedVisible ? <div className="atw-detail"><button className="atw-button atw-back" type="button" onClick={backToList}><Icon name="left" />Zum Tagesfahrplan</button><header><h2 tabIndex={-1} ref={detailHeading}>{selected.clientName}</h2><p className="atw-detail-subtitle">{selected.title}</p><div className="atw-detail-badges"><span className="atw-badge">{selected.statusLabel}</span>{selected.isVirtual ? <span className="atw-badge">Serientermin</span> : null}</div></header><dl className="atw-facts"><div><dt>Geplante Zeit</dt><dd>{timeRange(selected)}</dd></div><div><dt>Dauer</dt><dd>{selected.durationMinutes} Minuten</dd></div><div className="atw-fact-wide"><dt>Mitarbeitende</dt><dd>{employeeLabel(selected)}</dd></div><div className="atw-fact-wide"><dt>Einsatzadresse</dt><dd>{selected.address || 'Vollständige Adresse fehlt'}</dd></div></dl><div className="atw-detail-actions"><button type="button" className="atw-button" onClick={() => navigate(visitRoute(selected.id))}>Einsatz öffnen</button>{canManage && selected.canReassign ? <button type="button" className="atw-button atw-button-primary" onClick={() => navigate(visitRoute(selected.id, true))}>Zuweisung & Zeiten bearbeiten</button> : null}{view === 'planning' && selected.canReassign ? <button type="button" className="atw-button" onClick={openReplacement}>Vertretung prüfen</button> : null}</div>
          {selected.issues.length ? <section className="atw-section"><h3>Vor der Planung prüfen</h3><Issues issues={selected.issues} /></section> : null}
          {view === 'replacement' ? <section className="atw-section"><h3>Vertretung prüfen</h3>{!selected.canReassign ? <p className="atw-muted">Der Einsatz befindet sich nicht mehr in einem umplanbaren Status. Öffnen Sie die Einsatzdetails, um die Durchführung und Nacharbeit zu prüfen.</p> : <><p className="atw-muted">Zeitfenster, Abwesenheiten und Überschneidungen werden berücksichtigt. Prüfen Sie die fachliche Eignung sowie Fahrzeiten vor der Zuweisung.</p>{!canManage ? <p className="atw-message">Sie können die Planung ansehen. Zum Ändern benötigen Sie die Freigabe zur Einsatzplanung.</p> : null}{candidates.length ? <ul className="atw-candidates">{candidates.map(candidate => <li className="atw-candidate" key={candidate.employeeId}><div className="atw-candidate-top"><strong>{candidate.name}</strong><span className="atw-badge" data-tone={candidate.status}>{candidate.status === 'available' ? 'Zeitlich möglich' : candidate.status === 'blocked' ? 'Nicht passend' : 'Prüfung offen'}</span></div>{candidate.issues.length ? <Issues issues={candidate.issues} /> : <p>Keine zeitlichen Konflikte in den vorliegenden Planungsdaten erkannt.</p>}</li>)}</ul> : <p className="atw-message" data-tone="warning">{snapshot?.checks.employees === 'unknown' ? 'Mitarbeitende konnten nicht vollständig geprüft werden. Laden Sie die Übersicht erneut.' : 'Es sind keine weiteren Mitarbeitenden für die Vertretungsprüfung hinterlegt.'}</p>}<p className="atw-muted" style={{ marginTop: 12 }}>Die Auswahl wird im Einsatz unter „Personen“ gespeichert. Bei einem Serientermin können Sie dort festlegen, welche Termine geändert werden.</p></>}</section> : <section className="atw-section"><h3>Reihenfolge & Fahrzeiten</h3><p className="atw-muted">Der Tagesfahrplan folgt den gespeicherten Anfangszeiten. Zeitabstände zwischen Einsätzen sind keine berechneten Fahrzeiten. Änderungen an Zeiten oder Mitarbeitenden speichern Sie im Einsatz.</p></section>}
        </div> : <div className="atw-empty"><h2>Einsatz auswählen</h2><p>{view === 'replacement' ? 'Wählen Sie einen Einsatz, um Vertretungen und offene Prüfungen zu sehen.' : 'Wählen Sie einen Eintrag aus dem Tagesfahrplan, um Zeit, Adresse und Zuweisung zu prüfen.'}</p></div>}
      </section>
    </div>
  </section>;
}

function Metric({ label, detail, value, warning = false }: { label: string; detail: string; value: number | null; warning?: boolean }) {
  return <div className="atw-metric" data-warning={warning}><strong>{value ?? '—'}</strong><span><b>{label}</b><small>{detail}</small></span></div>;
}
function Issues({ issues }: { issues: AssistTourIssue[] }) {
  return <ul className="atw-issues">{issues.map((issue, index) => <li key={issue.code + index}>{issue.message}</li>)}</ul>;
}
function Gap({ current, next }: { current: AssistTourVisit; next: AssistTourVisit }) {
  if (['cancelled', 'draft'].includes(current.status) || ['cancelled', 'draft'].includes(next.status)) return null;
  const minutes = Math.round((Date.parse(next.scheduledStart) - Date.parse(current.scheduledEnd)) / 60000);
  if (!Number.isFinite(minutes)) return null;
  return <p className="atw-gap">{minutes < 0 ? `${Math.abs(minutes)} Min. Überschneidung` : minutes === 0 ? 'Kein Zeitabstand zwischen den Einsätzen' : `${minutes} Min. Zeitabstand · Fahrzeit offen`}</p>;
}
