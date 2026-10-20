import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { AssignmentDetailGlassModal } from '@/components/assist/AssignmentDetailGlassModal.web';
import { AssistExecutionProblemInboxPanel } from '@/components/assist/AssistExecutionProblemInboxPanel.web';
import { AssistLiveStatusMapPanel } from '@/components/assist/AssistLiveStatusMapPanel.web';
import { AssistLiveFilterSelect } from '@/components/assist/AssistLiveFilterSelect.web';
import { AssistLiveStatusWorkspaceStyles, LiveStatusIcon } from '@/components/assist/AssistLiveStatusWorkspaceStyles.web';
import { useAssistLiveMonitoring } from '@/features/assistLive/useAssistLiveMonitoring.web';
import { isFreshLivePosition } from '@/features/assistLive/getAssistLiveMonitoringWorkspace';
import type { AssistLiveWorkspaceRow } from '@/features/assistLive/getAssistLiveMonitoringWorkspace';
import { getLiveMapSignal } from '@/features/assistLive/liveStatusMapPresentation.web';
import {
  emptyLiveWorkspaceState, formatLivePlannedTime, formatLiveTimer, isLiveRowActive, LIVE_FILTERS, LIVE_STATUS_LABELS,
  liveReadableName, liveSnapshotIsCurrent, liveTimerSeconds, liveWorkspaceStorageKey, matchesLiveStatus, normalizeLiveSearch,
  restoreLiveWorkspaceState, saveLiveWorkspaceState, type LiveWorkspaceState,
} from '@/features/assistLive/liveStatusWorkspacePresentation.web';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import { notifyCalendarWorkspaceChanged } from '@/lib/calendar/calendarWorkspaceRefresh.web';
import type { PermissionKey } from '@/types/permissions';

export function AssistLiveStatusScreen() {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const { can, roleKey, permissions, isReadOnly } = usePermissions();
  const windowId = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('csWindow') ?? '';
  const actor = JSON.stringify([user?.id, profile?.id, profile?.employeeId, roleKey, [...permissions].sort(), isReadOnly]);
  const scopeKey = JSON.stringify([tenantId, actor, windowId]);
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const isCurrentScope = useCallback(() => currentScope.current === scopeKey, [scopeKey]);
  return <LiveStatusWorkspace key={scopeKey} tenantId={tenantId} storageKey={liveWorkspaceStorageKey(tenantId, actor, windowId)} canView={can('assist.assignments.view')} permissions={permissions} isReadOnly={isReadOnly} isCurrentScope={isCurrentScope} />;
}

type WorkspaceProps = { tenantId: string | null; storageKey: string; canView: boolean; permissions: readonly PermissionKey[]; isReadOnly: boolean; isCurrentScope: () => boolean };
function LiveStatusWorkspace({ tenantId, storageKey, canView, permissions, isReadOnly, isCurrentScope }: WorkspaceProps) {
  const router = useFlowRouter();
  const monitor = useAssistLiveMonitoring({ enabled: canView, effectivePermissions: permissions, isReadOnly });
  const [state, setState] = useState(() => restoreLiveWorkspaceState(storageKey));
  const [nowMs, setNowMs] = useState(Date.now);
  const [limit, setLimit] = useState(20);
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [inboxRefreshToken, setInboxRefreshToken] = useState(0);
  const [detail, setDetail] = useState<{ id: string; title: string } | null>(null);
  const mounted = useRef(true), deleted = useRef(false);
  const sectionId = useId();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const active = useCallback(() => mounted.current && isCurrentScope() && canView, [isCurrentScope, canView]);
  useEffect(() => { if (canView && isCurrentScope()) saveLiveWorkspaceState(storageKey, state); }, [storageKey, state, canView, isCurrentScope]);
  useEffect(() => {
    if (!canView) return;
    const tick = () => { if (document.visibilityState !== 'hidden') setNowMs(Date.now()); };
    const interval = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [canView]);
  const patchState = useCallback((patch: Partial<LiveWorkspaceState>) => {
    if (active()) setState(previous => ({ ...previous, ...patch }));
  }, [active]);
  const selectEmployee = useCallback((employeeId: string) => patchState({ employeeId, selectedId: null }), [patchState]);
  const selectStatus = useCallback((status: string) => patchState({ status: status as LiveWorkspaceState['status'], selectedId: null }), [patchState]);
  const refresh = useCallback(() => {
    if (!active()) return;
    void monitor.refresh();
    setInboxRefreshToken(value => value + 1);
  }, [active, monitor.refresh]);
  const sourceChanged = useCallback(() => {
    if (!active()) return;
    refresh();
    if (tenantId) notifyCalendarWorkspaceChanged(tenantId);
  }, [active, refresh, tenantId]);
  const countChanged = useCallback((count: number | null) => { if (active()) setInboxCount(count); }, [active]);

  const rows = monitor.overview?.rows ?? [];
  const employeeOptions = useMemo(() => {
    const employees = new Map<string, string>();
    rows.forEach(row => { if (row.employeeId) employees.set(row.employeeId, liveReadableName(row.employeeName, 'Name nicht hinterlegt')); });
    return [{ value: '', label: 'Alle Mitarbeitenden' }, ...[...employees].sort((a, b) => a[1].localeCompare(b[1], 'de-DE')).map(([value, label]) => ({ value, label }))];
  }, [rows]);
  const filteredRows = useMemo(() => {
    const query = normalizeLiveSearch(state.query);
    return rows.filter(row => (!state.employeeId || row.employeeId === state.employeeId) &&
      matchesLiveStatus(row, state.status, isFreshLivePosition(row, nowMs)) &&
      (!query || normalizeLiveSearch([row.clientName, row.employeeName, row.title].filter(Boolean).join(' ')).includes(query)));
  }, [rows, state.employeeId, state.status, state.query, nowMs]);
  useEffect(() => { setLimit(20); }, [state.query, state.employeeId, state.status]);
  useEffect(() => {
    if (monitor.overview && !monitor.error && !monitor.refreshError && state.selectedId && !rows.some(row => row.assignmentId === state.selectedId)) patchState({ selectedId: null });
  }, [monitor.overview, monitor.error, monitor.refreshError, state.selectedId, rows, patchState]);
  const selectedRow = state.selectedId ? filteredRows.find(row => row.assignmentId === state.selectedId) ?? null :
    filteredRows.find(row => isFreshLivePosition(row, nowMs)) ?? filteredRows.find(isLiveRowActive) ?? filteredRows[0] ?? null;
  const filteredIds = useMemo(() => new Set(filteredRows.map(row => row.assignmentId)), [filteredRows]);
  const markers = useMemo(() => (monitor.overview?.mapMarkers ?? []).filter(marker => filteredIds.has(marker.id)), [monitor.overview?.mapMarkers, filteredIds]);
  const openAssignment = useCallback((id: string) => {
    if (!active()) return;
    const row = rows.find(item => item.assignmentId === id || item.visitId === id);
    deleted.current = false;
    setDetail({ id: row?.visitId || id, title: liveReadableName(row?.clientName, row?.title || 'Einsatz') });
  }, [active, rows]);
  const closeDetail = useCallback(() => {
    if (!active()) return;
    setDetail(null);
    // The existing detail's status/task controls do not emit onChanged.
    if (!deleted.current) sourceChanged();
  }, [active, sourceChanged]);
  const deleteDetail = useCallback(() => { if (active()) { deleted.current = true; setDetail(null); sourceChanged(); } }, [active, sourceChanged]);
  const hasFilter = Boolean(state.query || state.employeeId || state.status !== 'all');
  const generatedAt = monitor.overview?.generatedAt;
  const snapshotCurrent = liveSnapshotIsCurrent(generatedAt, nowMs);
  const isCurrent = snapshotCurrent && !monitor.error && !monitor.refreshError && !monitor.partialData;
  const freshGpsCount = rows.filter(row => isFreshLivePosition(row, nowMs)).length;
  const runningCount = rows.filter(isLiveRowActive).length;
  const showMetric = (value: number) => monitor.overview ? value.toLocaleString('de-DE') : '—';
  const selectMetric = (status: LiveWorkspaceState['status']) => patchState({ view: 'live', status, query: '', employeeId: '', selectedId: null });
  const date = new Date(nowMs).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' });
  const timeLabel = generatedAt && Number.isFinite(Date.parse(generatedAt)) ? new Date(generatedAt).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;

  return <ScreenShell title="Live-Status" contentOwnsHeader showBack={false} showBreadcrumbs={false}>
    <div className="ls-workspace" data-cs-live-status="web-workspace-r3">
      <AssistLiveStatusWorkspaceStyles />
      <header className="ls-heading">
        <button type="button" className="ls-button ls-button--quiet ls-button--icon" aria-label="Zurück" onClick={() => { if (router.canGoBack()) router.back(); else router.replace('/Desktop'); }}><LiveStatusIcon name="back" /></button>
        <div className="ls-heading-copy"><h1>Live-Status</h1><p>{date} · Einsätze und offene Vorgänge</p></div>
        {canView ? <div className="ls-heading-actions">
          <button type="button" className="ls-button" onClick={() => router.push('/assist/assignments')}><LiveStatusIcon name="calendar" />Einsatzplanung</button>
          <button type="button" className="ls-button ls-button--primary" aria-label="Live-Status aktualisieren" disabled={monitor.refreshing || monitor.loading} onClick={refresh}><span className={monitor.refreshing || monitor.loading ? 'ls-spin' : undefined}><LiveStatusIcon name="refresh" /></span>{monitor.refreshing ? 'Aktualisieren …' : 'Aktualisieren'}</button>
        </div> : null}
      </header>
      {!canView ? <div className="ls-empty" role="alert"><LiveStatusIcon name="lock" size={30} /><h3>Kein Zugriff auf Live-Status</h3><p>Für diese Ansicht wird die Berechtigung zum Anzeigen von Einsätzen benötigt.</p></div> : <>
        <div className="ls-summary" aria-label="Übersicht">
          <button type="button" className="ls-metric" aria-pressed={state.view === 'live' && state.status === 'all' && !hasFilter} onClick={() => selectMetric('all')}><span className="ls-metric-label">Einsätze heute</span><strong className="ls-metric-value">{showMetric(monitor.overview?.todayCount ?? 0)}</strong><span className="ls-metric-icon"><LiveStatusIcon name="calendar" size={22} /></span><span className="ls-metric-note">Heute beginnende Einsätze</span></button>
          <button type="button" className="ls-metric" aria-pressed={state.view === 'live' && state.status === 'active'} onClick={() => selectMetric('active')}><span className="ls-metric-label">Aktuell aktiv</span><strong className="ls-metric-value">{showMetric(runningCount)}</strong><span className="ls-metric-icon"><LiveStatusIcon name="activity" size={22} /></span><span className="ls-metric-note">Anfahrt, Einsatz und Pause</span></button>
          <button type="button" className="ls-metric" aria-pressed={state.view === 'live' && state.status === 'gps'} onClick={() => selectMetric('gps')}><span className="ls-metric-label">GPS live</span><strong className="ls-metric-value">{showMetric(freshGpsCount)}</strong><span className="ls-metric-icon"><LiveStatusIcon name="pin" size={22} /></span><span className="ls-metric-note">Position jünger als 45 Sekunden</span></button>
          <button type="button" className="ls-metric" data-tone={inboxCount ? 'warning' : 'quiet'} aria-pressed={state.view === 'problems'} onClick={() => patchState({ view: 'problems' })}><span className="ls-metric-label">Offene Probleme</span><strong className="ls-metric-value">{inboxCount === null ? '—' : inboxCount.toLocaleString('de-DE')}</strong><span className="ls-metric-icon"><LiveStatusIcon name="inbox" size={22} /></span><span className="ls-metric-note">Einsatzübergreifend prüfen</span></button>
        </div>
        <div className="ls-toolbar">
          <nav className="ls-tabs" aria-label="Live-Status Ansichten">
            <button type="button" aria-label="Tagesübersicht" aria-pressed={state.view === 'live'} aria-controls={`${sectionId}-live`} onClick={() => patchState({ view: 'live' })}><LiveStatusIcon name="activity" />Tagesübersicht</button>
            <button type="button" aria-label="Problem-Inbox" aria-pressed={state.view === 'problems'} aria-controls={`${sectionId}-problems`} onClick={() => patchState({ view: 'problems' })}><LiveStatusIcon name="inbox" />Problem-Inbox{inboxCount !== null ? <span className="ls-tab-count">{inboxCount}</span> : null}</button>
          </nav>
          <div className="ls-sync"><span className="ls-sync-label" data-current={isCurrent}>{monitor.loading ? 'Wird geladen' : monitor.partialData ? 'Teilweise geladen' : isCurrent ? 'Aktuell' : 'Datenstand prüfen'}</span><span>{timeLabel ? `Stand ${timeLabel} Uhr` : 'Noch kein bestätigter Datenstand'} · {monitor.isRealtimeConnected ? 'Automatisch verbunden' : 'Automatische Abfrage'}</span></div>
        </div>
        {monitor.error || monitor.refreshError ? <div className="ls-notice" data-tone="error" role="alert"><p>{monitor.error || monitor.refreshError}</p>{monitor.overview ? <p>Der letzte Datenstand bleibt sichtbar. Laufende Zeiten werden bis zur nächsten erfolgreichen Abfrage nicht weitergezählt.</p> : null}</div> : monitor.partialData ? <div className="ls-notice" role="status"><p>Nicht alle Angaben sind vollständig bestätigt. Beachten Sie die Hinweise bei den betroffenen Einsätzen und Strecken.</p></div> : !monitor.loading && monitor.overview && !snapshotCurrent ? <div className="ls-notice" role="status">Der Datenstand ist nicht mehr aktuell. Die Zeiten zeigen den zuletzt bestätigten Stand. Bitte aktualisieren.</div> : null}
        <section className="ls-section" id={`${sectionId}-live`} hidden={state.view !== 'live'} aria-label="Tagesübersicht">
          <div className="ls-filters">
            <label className="ls-field ls-field--search"><span>Suchen</span><input type="search" aria-label="Live-Status durchsuchen" placeholder="Klient:in, Mitarbeitende oder Einsatz" maxLength={200} value={state.query} onChange={event => patchState({ query: event.currentTarget.value, selectedId: null })} /></label>
            <AssistLiveFilterSelect className="ls-field" label="Mitarbeitende" ariaLabel="Mitarbeitende filtern" value={state.employeeId} options={employeeOptions} onChange={selectEmployee} />
            <AssistLiveFilterSelect className="ls-field" label="Einsatzstatus" ariaLabel="Einsatzstatus filtern" value={state.status} options={LIVE_FILTERS} onChange={selectStatus} />
            {hasFilter ? <button type="button" className="ls-button ls-button--quiet" onClick={() => patchState({ ...emptyLiveWorkspaceState(), view: state.view })}>Filter zurücksetzen</button> : null}
          </div>
          <div className="ls-grid">
            <div className="ls-list">
              <div className="ls-list-heading"><h2>Einsätze im Blick</h2><p>{filteredRows.length} von {rows.length} Einsätzen{rows.length > (monitor.overview?.todayCount ?? rows.length) ? ' · inkl. laufender Vortagseinsätze' : ''}</p></div>
              {monitor.loading && !monitor.overview ? <div className="ls-empty" role="status"><span className="ls-spin"><LiveStatusIcon name="refresh" size={28} /></span><h3>Einsätze werden geladen</h3><p>Status, Zeiten und Standorte werden abgefragt.</p></div> : !filteredRows.length ? <div className="ls-empty"><LiveStatusIcon name="calendar" size={34} /><h3>{monitor.error && !monitor.overview ? 'Einsätze konnten nicht geladen werden' : hasFilter ? 'Keine passenden Einsätze' : 'Heute sind keine Einsätze vorhanden'}</h3><p>{monitor.error && !monitor.overview ? 'Bitte starten Sie die Abfrage erneut.' : hasFilter ? 'Ändern Sie die Suche oder setzen Sie die Filter zurück.' : 'Geplante Einsätze und laufende Anfahrten erscheinen hier automatisch.'}</p><button type="button" className="ls-button" onClick={() => { if (hasFilter) patchState({ ...emptyLiveWorkspaceState(), view: 'live' }); else if (monitor.error) refresh(); else router.push('/assist/assignments'); }}>{hasFilter ? 'Filter zurücksetzen' : monitor.error ? 'Erneut laden' : 'Einsatzplanung öffnen'}<LiveStatusIcon name="arrow" /></button></div> : <div className="ls-cards">{filteredRows.slice(0, limit).map(row => <LiveAssignmentCard key={row.assignmentId} row={row} selected={selectedRow?.assignmentId === row.assignmentId} nowMs={nowMs} generatedAt={generatedAt} allowTick={snapshotCurrent && !monitor.error && !monitor.refreshError && !row.trackingError} onSelect={() => patchState({ selectedId: row.assignmentId })} onOpen={() => openAssignment(row.visitId || row.assignmentId)} />)}</div>}
              {filteredRows.length > limit ? <button type="button" className="ls-button ls-more" onClick={() => setLimit(value => value + 20)}>Weitere Einsätze anzeigen</button> : null}
            </div>
            <div className="ls-map-column"><AssistLiveStatusMapPanel row={selectedRow} markers={markers} selectedAssignmentId={selectedRow?.assignmentId} onMarkerSelect={id => { if (filteredIds.has(id)) patchState({ selectedId: id }); }} tenantId={tenantId} nowMs={nowMs} onOpenAssignment={openAssignment} loading={monitor.loading} /></div>
          </div>
          <p className="ls-footer-note">Standorte stammen aus dem Mitarbeiterportal und setzen eine Standortfreigabe voraus. Abgeschlossene Einsätze zeigen nur den zuletzt übermittelten Stand.</p>
        </section>
        <section className="ls-section" id={`${sectionId}-problems`} hidden={state.view !== 'problems'} aria-label="Problem-Inbox"><AssistExecutionProblemInboxPanel refreshToken={inboxRefreshToken} onChanged={sourceChanged} onCountChange={countChanged} onOpenAssignment={openAssignment} /></section>
        <AssignmentDetailGlassModal visible={!!detail} assignmentId={detail?.id ?? null} title={detail?.title ?? 'Einsatz'} onClose={closeDetail} onChanged={sourceChanged} onDeleted={deleteDetail} />
      </>}
    </div>
  </ScreenShell>;
}

function LiveAssignmentCard({ row, selected, nowMs, generatedAt, allowTick, onSelect, onOpen }: { row: AssistLiveWorkspaceRow; selected: boolean; nowMs: number; generatedAt?: string; allowTick: boolean; onSelect: () => void; onOpen: () => void }) {
  const client = liveReadableName(row.clientName, 'Klient:in nicht hinterlegt');
  const employee = liveReadableName(row.employeeName, 'Mitarbeitende nicht zugeordnet');
  const signal = getLiveMapSignal(row, nowMs);
  const timers = row.tracking?.timers;
  const hasTimers = timers && (isLiveRowActive(row) || (timers.driveSeconds ?? 0) + (timers.serviceSeconds ?? 0) + (timers.pauseSeconds ?? 0) > 0);
  const statusTone = isLiveRowActive(row) ? 'active' : row.status === 'abgeschlossen' ? 'done' : ['doku_fehlt', 'signatur_fehlt', 'kritisch'].includes(row.displayStatus) ? 'warning' : 'quiet';
  const flags = [row.delayMinutes && row.delayMinutes > 0 ? `${row.delayMinutes} Min. nach geplantem Beginn` : null,
    row.overrunMinutes && row.overrunMinutes > 0 ? `${row.overrunMinutes} Min. über Plan` : null,
    row.docStatus === 'missing' ? 'Dokumentation fehlt' : null, row.signatureStatus === 'missing' ? 'Unterschrift fehlt' : null,
    row.problemStatus === 'emergency' ? 'Notfall gemeldet' : row.problemStatus === 'reported' ? 'Klärung nötig' : null,
    row.cancelRequest ? 'Absage angefragt' : null, row.rescheduleRequest ? 'Verschiebung angefragt' : null,
    row.trackingError ? 'Trackingdaten nicht verfügbar' : null].filter(Boolean);
  return <article className="ls-card" data-selected={selected}>
    <header className="ls-card-head"><div className="ls-card-name"><h3>{client}</h3><p className="ls-card-service">{row.title}</p></div><span className="ls-status" data-tone={statusTone}>{LIVE_STATUS_LABELS[row.displayStatus] ?? 'Status prüfen'}</span></header>
    <div className="ls-card-meta"><span><LiveStatusIcon name="person" size={15} />{employee}</span><span><LiveStatusIcon name="clock" size={15} />{formatLivePlannedTime(row.plannedStartAt, row.plannedEndAt)}</span></div>
    {hasTimers && timers ? <dl className="ls-timers">{([{ key: 'drive', label: 'Anfahrt', value: timers.driveSeconds }, { key: 'service', label: 'Einsatzzeit', value: timers.serviceSeconds }, { key: 'pause', label: 'Pause', value: timers.pauseSeconds }] as const).map(timer => <div key={timer.key} data-active={allowTick && timers.activeTimer === timer.key}><dt>{timer.label}{!allowTick && timers.activeTimer === timer.key ? ' · letzter Stand' : ''}</dt><dd>{timer.value == null ? '—' : formatLiveTimer(liveTimerSeconds(timer.value, timers.activeTimer, timer.key, generatedAt, nowMs, allowTick && isLiveRowActive(row)))}</dd></div>)}</dl> : null}
    {flags.length ? <div className="ls-flags">{flags.map(flag => <span key={flag}>{flag}</span>)}</div> : null}
    <footer className="ls-card-footer"><span className="ls-signal" data-tone={signal.tone}>{signal.label}</span><div className="ls-card-actions"><button type="button" className="ls-button ls-button--quiet" aria-label={`Auf Karte auswählen: ${client}`} aria-pressed={selected} onClick={onSelect}><LiveStatusIcon name="pin" size={15} />{selected ? 'Ausgewählt' : 'Karte'}</button><button type="button" className="ls-button" aria-label={`Einsatzdetails öffnen: ${client}`} onClick={onOpen}>Details<LiveStatusIcon name="arrow" size={15} /></button></div></footer>
  </article>;
}
