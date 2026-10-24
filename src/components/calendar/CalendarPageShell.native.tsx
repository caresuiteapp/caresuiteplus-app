// Generated native presentation from src/components/calendar/CalendarPageShell.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeLabel,NativeSpan,NativeInput,NativeSelect,NativeOption,NativeButton,NativeP,NativeH3} from '@/components/layout/NativeWorkspaceElements.native';
import { useGlobalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarEvent, CalendarViewMode } from '@/types/modules/calendarEvent';
import type { CalendarViewConfig } from '@/types/calendar';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useEmployeeMonthPlanning } from "../../hooks/useEmployeeMonthPlanning.native.ts";
import { useCalendarEvents } from "../../hooks/useCalendarEvents.native.ts";
import { useTenantCalendarSettings } from "../../hooks/useTenantCalendarSettings.native.ts";
import { EmployeeMonthPlanningModal } from "./EmployeeMonthPlanningModal.native.tsx";
import { EmployeePlanabilityBadge } from './EmployeePlanabilityBadge';
import { dayPlanability, datesInMonth, monthKey, filterEmployeeEvents, planningAbsenceEvents } from '@/lib/calendar/employeeMonthPlanning';
import { addDays, addWeeks, formatDayHeader, formatMonthYear, formatWeekRange, startOfWeek, toDateKey, getMonthGridDays } from '@/lib/office/calendarDateUtils';
import { addCalendarMonthsClamped, addCalendarYearsClamped } from '@/lib/calendar/calendarWebViewModel';
import { calendarAnchor, calendarWorkspaceKey, readCalendarWorkspace, saveCalendarWorkspace, type CalendarWorkspaceState } from "../../lib/calendar/calendarWorkspaceState.native.ts";
import { ASSIGNMENT_CALENDAR_VISUALS, resolveAssignmentCalendarVisual } from "../../lib/calendar/assignmentCalendarPresentation.native.ts";
import { ASSIGNMENT_CALENDAR_COLORS, calendarEventColorVariables } from "../../lib/calendar/calendarEventColors.native.ts";
import { resolveCalendarFormWritePermission } from '@/lib/calendar/calendarEventSaveService';
import { OfficeCalendarSettingsModal } from "../office/calendar/OfficeCalendarSettingsModal.native.tsx";
import { CalendarToolbar } from "./CalendarToolbar.native.tsx";
import { CalendarEventGrid } from "./CalendarEventGrid.native.tsx";
import { CalendarEventCreateModal } from "./CalendarEventCreateModal.native.tsx";
import { CalendarWorkspaceIcon, CalendarWorkspaceStyles } from "./CalendarWorkspaceStyles.native.tsx";
import { OfficeAssignmentProfileCalendarPlanner, type AssignmentProfileDropHandler } from "./OfficeAssignmentProfileCalendarPlanner.native.tsx";
export type CalendarPageShellProps = {
    config: CalendarViewConfig;
    onEventPress?: (event: CalendarEvent) => void;
    showCreateAction?: boolean;
    showSettings?: boolean;
};
export function CalendarPageShell(props: CalendarPageShellProps) {
    const tenantId = useServiceTenantId();
    const { profile, user } = useAuth();
    const nativeParams = useGlobalSearchParams();
    const windowId = typeof nativeParams.csWindow === 'string' ? nativeParams.csWindow : '';
    const storageKey = calendarWorkspaceKey(tenantId ?? '', user?.id ?? profile?.id ?? '', props.config.moduleKey, windowId);
    return <CalendarWorkspace key={`${storageKey}:${profile?.roleKey ?? ''}`} {...props} storageKey={storageKey}/>;
}
function CalendarWorkspace({ config, onEventPress, showCreateAction = true, showSettings = true, storageKey }: CalendarPageShellProps & {
    storageKey: string;
}) {
    const tenantId = useServiceTenantId();
    const { can, isReadOnly } = usePermissions();
    const planningScope = ['all', 'office', 'assist'].includes(config.moduleKey);
    const canManagePlanning = !isReadOnly && (can('assist.assignments.manage') || can('office.employees.absences.manage'));
    const canViewPlanning = planningScope && (canManagePlanning || can('office.employees.absences.view'));
    const canSettings = showSettings && !isReadOnly && can('business.tenant.manage');
    const writePermission = resolveCalendarFormWritePermission({ sourceContext: 'calendar', moduleKey: config.moduleKey, sourceType: 'custom_event' });
    const canCreate = showCreateAction && !isReadOnly && !!writePermission && can(writePermission);
    const settingsHook = useTenantCalendarSettings(config.moduleKey === 'assist' ? 'assist' : 'office');
    const { settings, form } = settingsHook;
    const [initial] = useState(() => readCalendarWorkspace(storageKey, typeof window !== 'undefined' && window.innerWidth < 600 && (!config.defaultView || config.defaultView === 'month') ? 'agenda' : config.defaultView ?? 'month'));
    const [state, setState] = useState(initial.state);
    const interacted = useRef(false);
    const defaultApplied = useRef(initial.restored);
    const patch = useCallback((next: Partial<CalendarWorkspaceState>) => { interacted.current = true; setState((previous) => ({ ...previous, ...next })); }, []);
    useEffect(() => { saveCalendarWorkspace(storageKey, state); }, [storageKey, state]);
    useEffect(() => {
        if (settingsHook.loading || defaultApplied.current || !settings)
            return;
        defaultApplied.current = true;
        if (!interacted.current)
            setState((previous) => ({ ...previous,
                view: typeof window !== 'undefined' && window.innerWidth < 600 && settings.defaultView === 'month' ? 'agenda' : settings.defaultView }));
    }, [settingsHook.loading, settings]);
    const anchor = useMemo(() => calendarAnchor(state.anchor) ?? new Date(), [state.anchor]);
    const viewMode = state.view;
    const employeeId = canViewPlanning ? state.employeeId : '';
    const [planningOpen, setPlanningOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const weekStartDay = settings?.weekStartDay ?? 1;
    const visibleRange = useMemo(() => {
        let start: Date;
        let end: Date;
        if (viewMode === 'day') {
            start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
            end = addDays(start, 1);
        }
        else if (viewMode === 'week' || viewMode === 'agenda') {
            start = startOfWeek(anchor, weekStartDay);
            end = addDays(start, 7);
        }
        else if (viewMode === 'year') {
            start = new Date(anchor.getFullYear(), 0, 1);
            end = new Date(anchor.getFullYear() + 1, 0, 1);
        }
        else if (viewMode === 'month') {
            const days = getMonthGridDays(anchor, weekStartDay);
            start = days[0].date;
            end = addDays(days[days.length - 1].date, 1);
        }
        else {
            start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
            end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
        }
        return { start, end };
    }, [anchor, viewMode, weekStartDay]);
    const fetchRange = useMemo(() => ({
        start: new Date(Math.min(+visibleRange.start, +new Date(anchor.getFullYear(), anchor.getMonth(), 1))),
        end: new Date(Math.max(+visibleRange.end, +new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)) - 1),
    }), [visibleRange, anchor]);
    const calendar = useCalendarEvents(fetchRange.start.toISOString(), fetchRange.end.toISOString(), config);
    const { events, allEvents, calendarReady, loading, refreshing, error, refreshError, refresh, refreshWithResult } = calendar;
    const selectedMonth = monthKey(anchor);
    const planning = useEmployeeMonthPlanning(tenantId, employeeId, monthKey(fetchRange.start), monthKey(fetchRange.end), canViewPlanning);
    const employeeName = planning.employees.find((employee) => employee.id === employeeId)?.name ?? '';
    const selectedPlan = planning.plans.find((plan) => plan.employee_id === employeeId && plan.month === `${selectedMonth}-01`);
    const monthSlots = planning.plans.filter((plan) => plan.employee_id === employeeId).flatMap((plan) => plan.slots);
    const planningEvents = [...filterEmployeeEvents(allEvents, employeeId), ...planning.absences];
    const planabilityByDay = canViewPlanning && employeeId && planning.ready && calendarReady
        ? Object.fromEntries([...new Set(planning.plans.filter((plan) => plan.employee_id === employeeId).flatMap((plan) => datesInMonth(plan.month.slice(0, 7))).concat(datesInMonth(selectedMonth)))].map((date) => [date, dayPlanability(date, monthSlots, planningEvents)]))
        : undefined;
    const displayEvents = useMemo(() => {
        const blocked = canViewPlanning ? planning.plans.flatMap((plan) => planningAbsenceEvents(plan, planning.employees.find((employee) => employee.id === plan.employee_id)?.name ?? 'Mitarbeitende')) : [];
        const combined = filterEmployeeEvents([...events, ...blocked.filter((event) => !settings || settings.visibleTypes[event.type])], employeeId);
        const query = state.query.trim().toLocaleLowerCase('de-DE');
        const startKey = toDateKey(visibleRange.start), lastKey = toDateKey(addDays(visibleRange.end, -1));
        return [...new Map(combined.map((event) => [event.id, event])).values()].filter((event) => {
            const starts = +new Date(event.start), ends = +new Date(event.end);
            const within = event.allDay ? event.start.slice(0, 10) <= lastKey && event.end.slice(0, 10) >= startKey
                : starts < +visibleRange.end && (ends > +visibleRange.start || ends === starts && starts >= +visibleRange.start);
            if (!within)
                return false;
            if (state.status !== 'all' && resolveAssignmentCalendarVisual(event)?.state !== state.status)
                return false;
            return !query || [event.title, event.clientName, event.employeeName, event.serviceTitle].filter(Boolean).join(' ').toLocaleLowerCase('de-DE').includes(query);
        });
    }, [events, planning.plans, planning.employees, employeeId, canViewPlanning, state.query, state.status, visibleRange, settings]);
    const title = viewMode === 'day' ? formatDayHeader(anchor) : viewMode === 'week' || viewMode === 'agenda' ? formatWeekRange(anchor, weekStartDay)
        : viewMode === 'year' ? String(anchor.getFullYear()) : formatMonthYear(anchor);
    const navigate = (amount: number) => {
        const next = viewMode === 'day' ? addDays(anchor, amount) : viewMode === 'week' || viewMode === 'agenda' ? addWeeks(anchor, amount)
            : viewMode === 'year' ? addCalendarYearsClamped(anchor, amount) : addCalendarMonthsClamped(anchor, amount);
        if (calendarAnchor(toDateKey(next)))
            patch({ anchor: toDateKey(next) });
    };
    const reload = () => { planning.refresh(); void refresh(); };
    const handleEventPress = (event: CalendarEvent) => {
        if (event.sourceType === 'employee_month_plan' && canManagePlanning && event.employeeId) {
            patch({ employeeId: event.employeeId, anchor: `${(event.sourceId ?? event.start).slice(0, 7)}-15` });
            setPlanningOpen(true);
        }
        else
            onEventPress?.(event);
    };
    const filtered = Boolean(employeeId || state.query || state.status !== 'all');
    const visiblePlanningDates = viewMode === 'day' ? [toDateKey(anchor)] : viewMode === 'week' || viewMode === 'agenda'
        ? Array.from({ length: 7 }, (_, index) => toDateKey(addDays(visibleRange.start, index))) : [];
    const renderCalendar = ({ selectedProfileId, onProfileDrop }: {
        selectedProfileId: string | null;
        onProfileDrop?: AssignmentProfileDropHandler;
    }) => <NativeDiv className="cw-workspace">
    <CalendarWorkspaceStyles />
    <CalendarToolbar viewMode={viewMode} onViewModeChange={(view) => patch({ view })} title={title} onPrev={() => navigate(-1)} onNext={() => navigate(1)} onToday={() => patch({ anchor: toDateKey(new Date()) })} anchor={state.anchor} onAnchorChange={(value) => { if (calendarAnchor(value))
        patch({ anchor: value }); }} onOpenSettings={canSettings ? () => setSettingsOpen(true) : undefined} onCreate={canCreate ? () => setCreateOpen(true) : undefined}/>
    <NativeDiv className="cw-controls">
      <NativeLabel className="cw-field cw-search"><NativeSpan>Suche</NativeSpan><NativeInput type="search" aria-label="Kalender durchsuchen" placeholder="Termin, Klient oder Mitarbeitende suchen" value={state.query} maxLength={200} onChange={(event) => patch({ query: event.target.value })}/></NativeLabel>
      {canViewPlanning ? <NativeLabel className="cw-field"><NativeSpan>Mitarbeitende</NativeSpan><NativeSelect aria-label="Kalender für Mitarbeitende" value={employeeId} onChange={(event) => { patch({ employeeId: event.target.value }); setPlanningOpen(false); }}>
        <NativeOption value="">Alle Mitarbeitenden</NativeOption>{employeeId && !planning.employees.some((employee) => employee.id === employeeId) ? <NativeOption value={employeeId}>Ausgewählte Person {planning.loading ? 'wird geladen…' : '(nicht verfügbar)'}</NativeOption> : null}
        {planning.employees.map((employee) => <NativeOption key={employee.id} value={employee.id}>{employee.name}</NativeOption>)}
      </NativeSelect></NativeLabel> : null}
      {planningScope ? <NativeLabel className="cw-field"><NativeSpan>Einsatzstatus</NativeSpan><NativeSelect aria-label="Einsatzstatus filtern" value={state.status} onChange={(event) => patch({ status: event.target.value as CalendarWorkspaceState['status'] })}>
        <NativeOption value="all">Alle Ereignisse</NativeOption>{Object.values(ASSIGNMENT_CALENDAR_VISUALS).map((visual) => <NativeOption key={visual.state} value={visual.state}>{visual.legendLabel}</NativeOption>)}
      </NativeSelect></NativeLabel> : null}
      <NativeDiv className="cw-controls-actions">
        {canManagePlanning && canViewPlanning && employeeId ? <NativeButton type="button" className="cw-button" disabled={!planning.ready || !calendarReady || planning.loading || !employeeName} onClick={() => setPlanningOpen(true)}><CalendarWorkspaceIcon name="people"/>Verfügbarkeit</NativeButton> : null}
        <NativeButton type="button" className="cw-button" disabled={loading || refreshing || planning.loading} onClick={reload}><NativeSpan className={loading || refreshing ? 'cw-spin' : undefined}><CalendarWorkspaceIcon name="refresh"/></NativeSpan>Aktualisieren</NativeButton>
      </NativeDiv>
    </NativeDiv>
    <NativeDiv className="cw-filter-footer"><NativeP role="status"><NativeSpan className="cw-count">{displayEvents.length}</NativeSpan> {displayEvents.length === 1 ? 'Eintrag' : 'Einträge'} im Zeitraum{employeeName ? ` · ${employeeName}` : ''}{refreshing ? ' · Wird aktualisiert…' : ''}</NativeP>
      {filtered ? <NativeButton type="button" className="cw-button cw-button--quiet" onClick={() => patch({ employeeId: '', query: '', status: 'all' })}>Filter zurücksetzen</NativeButton> : null}
    </NativeDiv>
    {error || refreshError ? <NativeDiv className="cw-notice" data-tone="error" role="alert"><NativeP>{error ?? refreshError}</NativeP><NativeButton type="button" className="cw-button" onClick={reload}>Erneut laden</NativeButton></NativeDiv> : null}
    {settingsHook.error && !settingsOpen ? <NativeDiv className="cw-notice" data-tone="warning" role="alert"><NativeP>{settingsHook.error}</NativeP><NativeButton type="button" className="cw-button" onClick={() => void settingsHook.refresh()}>Einstellungen erneut laden</NativeButton></NativeDiv> : null}
    {canViewPlanning && (planning.error || planning.employeeError) ? <NativeDiv className="cw-notice" data-tone="warning" role="alert"><NativeP>{planning.error ?? planning.employeeError}</NativeP><NativeButton type="button" className="cw-button" onClick={planning.refresh}>Planung erneut laden</NativeButton></NativeDiv> : null}
    {employeeId && (!calendarReady || !planning.ready) ? <NativeDiv className="cw-notice"><NativeP>Verfügbarkeiten werden erst nach dem vollständigen Laden aller Termine und Abwesenheiten angezeigt.</NativeP></NativeDiv> : null}
    {planabilityByDay && visiblePlanningDates.length ? <NativeDiv className="cw-availability" aria-label="Verfügbarkeiten im Zeitraum">{visiblePlanningDates.map((date) => <NativeDiv className="cw-availability-day" key={date}><NativeSpan>{date.slice(8)}.{date.slice(5, 7)}.</NativeSpan><EmployeePlanabilityBadge value={planabilityByDay[date] ?? dayPlanability(date, monthSlots, planningEvents)}/></NativeDiv>)}</NativeDiv> : null}
    {planningScope ? <NativeDiv className="cw-legend" aria-label="Einsatzstatus-Legende">{Object.values(ASSIGNMENT_CALENDAR_VISUALS).map((visual) => <NativeSpan key={visual.state} className="cw-legend-item" style={calendarEventColorVariables(ASSIGNMENT_CALENDAR_COLORS[visual.state])}><NativeSpan className="cw-legend-symbol" aria-hidden="true">{visual.symbol}</NativeSpan>{visual.legendLabel}</NativeSpan>)}</NativeDiv> : null}
    <NativeDiv className="cw-board" aria-busy={loading || refreshing}>
      {refreshError ? <NativeDiv className="cw-stale">Die angezeigten Daten sind möglicherweise unvollständig. Verfügbarkeit und Planung erst nach erfolgreichem Aktualisieren verwenden.</NativeDiv> : null}
      {loading && !events.length ? <NativeDiv className="cw-loading" role="status">Kalender wird geladen…</NativeDiv> : <>
        {!displayEvents.length && !error && !['agenda', 'list'].includes(viewMode) ? <NativeDiv className="cw-empty"><NativeH3>{filtered ? 'Keine passenden Einträge' : 'Noch keine Einträge'}</NativeH3><NativeP>{filtered ? 'Passe die Suche oder die Filter an.' : config.emptyStateMessage ?? 'Für diesen Zeitraum sind keine Kalendereinträge vorhanden.'}</NativeP></NativeDiv> : null}
        <NativeDiv className="cw-board-content"><CalendarEventGrid viewMode={viewMode} anchor={anchor} events={displayEvents} rangeStart={visibleRange.start} rangeEnd={visibleRange.end} planabilityByDay={planabilityByDay} weekStartDay={weekStartDay} maxCollapsedEvents={settings?.maxCollapsedEvents ?? 3} dayViewStartHour={settings?.dayViewStartHour ?? 6} weekFullDay={settings?.weekFullDay ?? true} onEventPress={handleEventPress} onSelectMonth={(month) => patch({ anchor: toDateKey(new Date(anchor.getFullYear(), month, 1)), view: 'month' })} onSelectDate={(date) => patch({ anchor: toDateKey(date), view: 'day' })} selectedAssignmentProfileId={selectedProfileId} onAssignmentProfileDrop={onProfileDrop}/></NativeDiv>
      </>}
    </NativeDiv>
  </NativeDiv>;
    return <>
    {planningScope ? <OfficeAssignmentProfileCalendarPlanner employeeIdFilter={employeeId} readOnly={isReadOnly || !can('assist.assignments.manage')} dataReady={calendarReady && (!canViewPlanning || planning.ready)} onScheduled={() => { planning.refresh(); return refreshWithResult(); }}>{renderCalendar}</OfficeAssignmentProfileCalendarPlanner> : renderCalendar({ selectedProfileId: null })}
    {planningOpen && employeeId && tenantId && planning.ready && calendarReady && canManagePlanning && canViewPlanning ? <EmployeeMonthPlanningModal key={`${tenantId}:${employeeId}:${selectedMonth}`} tenantId={tenantId} employeeId={employeeId} employeeName={employeeName} month={selectedMonth} initial={selectedPlan} events={planningEvents} onClose={() => setPlanningOpen(false)} onSaved={() => setPlanningOpen(false)}/> : null}
    {canSettings ? <OfficeCalendarSettingsModal visible={settingsOpen} initial={form} saving={settingsHook.saving} error={settingsHook.error} disabled={settingsHook.loading} onClose={() => setSettingsOpen(false)} onSave={async (next) => { const result = await settingsHook.save(next); if (!result.ok)
        throw new Error(result.error); patch({ view: next.defaultView }); setSettingsOpen(false); }}/> : null}
    {canCreate ? <CalendarEventCreateModal visible={createOpen} sourceContext="calendar" calendarScope={config.calendarScope} moduleKey={config.moduleKey} accentColor="#1675d8" onClose={() => setCreateOpen(false)} onCreated={() => setCreateOpen(false)}/> : null}
  </>;
}
