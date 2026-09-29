import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent, CalendarViewMode } from '@/types/modules/calendarEvent';
import type { CalendarViewConfig } from '@/types/calendar';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useEmployeeMonthPlanning } from '@/hooks/useEmployeeMonthPlanning';
import { CareEntitySelect } from '@/components/inputs/CareEntitySelect';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { EmployeeMonthPlanningModal } from './EmployeeMonthPlanningModal';
import { EmployeePlanabilityBadge } from './EmployeePlanabilityBadge';
import { dayPlanability, datesInMonth, monthKey, filterEmployeeEvents, planningAbsenceEvents } from '@/lib/calendar/employeeMonthPlanning';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useTenantCalendarSettings } from '@/hooks/useTenantCalendarSettings';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  formatDayHeader,
  formatMonthYear,
  formatWeekRange,
} from '@/lib/office/calendarDateUtils';
import { OfficeCalendarSettingsModal } from '@/components/office/calendar/OfficeCalendarSettingsModal';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarFilterBar } from './CalendarFilterBar';
import { CalendarCreateAction } from './CalendarCreateAction';
import { CalendarEventGrid, startOfMonth } from './CalendarEventGrid';
import { CalendarCreateModal } from './CalendarCreateModal';
import { CalendarAssignmentStatusLegend } from './CalendarAssignmentStatusLegend';
import {
  OfficeAssignmentProfileCalendarPlanner,
  type AssignmentProfileDropHandler,
} from './OfficeAssignmentProfileCalendarPlanner';

export type CalendarPageShellProps = {
  config: CalendarViewConfig;
  onEventPress?: (event: CalendarEvent) => void;
  showCreateAction?: boolean;
  showSettings?: boolean;
};

type CalendarGridContentProps = {
  selectedProfileId: string | null;
  onProfileDrop?: AssignmentProfileDropHandler;
};

function resolveSettingsScope(config: CalendarViewConfig): 'office' | 'assist' {
  if (config.moduleKey === 'assist') return 'assist';
  return 'office';
}

export function CalendarPageShell({
  config,
  onEventPress,
  showCreateAction = true,
  showSettings = true,
}: CalendarPageShellProps) {
  const accent = config.moduleColor ?? '#62F3FF';
  const tenantId = useServiceTenantId();
  const { can } = usePermissions();
  const planningScope = ['all', 'office', 'assist'].includes(config.moduleKey);
  const canManagePlanning = can('assist.assignments.manage') || can('office.employees.absences.manage');
  const canViewPlanning = planningScope && (canManagePlanning || can('office.employees.absences.view'));
  const [employeeId, setEmployeeId] = useState('');
  const [planningOpen, setPlanningOpen] = useState(false);
  useEffect(() => { setEmployeeId(''); setPlanningOpen(false); }, [tenantId]);
  const settingsScope = resolveSettingsScope(config);
  const { settings, form, saving, save, loading: settingsLoading } = useTenantCalendarSettings(settingsScope);
  const [viewMode, setViewMode] = useState<CalendarViewMode>(config.defaultView ?? 'month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (settings?.defaultView) setViewMode(settings.defaultView);
  }, [settings?.defaultView]);

  const range = useMemo(() => {
    const start = new Date(anchor);
    const end = new Date(anchor);
    if (viewMode === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'week' || viewMode === 'agenda') {
      start.setDate(start.getDate() - 14);
      end.setDate(end.getDate() + 14);
    } else if (viewMode === 'month' || viewMode === 'list') {
      start.setMonth(start.getMonth() - 1);
      end.setMonth(end.getMonth() + 2);
    } else {
      start.setMonth(0, 1);
      start.setFullYear(start.getFullYear() - 1);
      end.setMonth(11, 31);
      end.setFullYear(end.getFullYear() + 1);
    }
    // The month editor also needs bookings outside the currently visible day/week.
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
    return { rangeStart: new Date(Math.min(+start, +monthStart)).toISOString(), rangeEnd: new Date(Math.max(+end, +monthEnd)).toISOString() };
  }, [anchor, viewMode]);

  const { events, allEvents, calendarReady, loading, error, refresh } = useCalendarEvents(
    range.rangeStart,
    range.rangeEnd,
    config,
  );

  const selectedMonth = monthKey(anchor);
  const planning = useEmployeeMonthPlanning(tenantId, employeeId, monthKey(new Date(range.rangeStart)), monthKey(new Date(range.rangeEnd)), canViewPlanning);
  const employeeName = planning.employees.find((e) => e.id === employeeId)?.name ?? '';
  const selectedPlan = planning.plans.find((p) => p.employee_id === employeeId && p.month === `${selectedMonth}-01`);
  const monthSlots = planning.plans.filter((p) => p.employee_id === employeeId).flatMap((p) => p.slots);
  const employeeEvents = filterEmployeeEvents(allEvents, employeeId);
  const planningEvents = [...employeeEvents, ...planning.absences];
  const planabilityByDay = canViewPlanning && employeeId && planning.ready && calendarReady
    ? Object.fromEntries(planning.plans.filter((p) => p.employee_id === employeeId).flatMap((p) => datesInMonth(p.month.slice(0, 7)))
      .concat(datesInMonth(selectedMonth)).map((date) => [date, dayPlanability(date, monthSlots, planningEvents)]))
    : undefined;
  const blockedPlanEvents = planning.plans.flatMap((plan) => planningAbsenceEvents(plan, planning.employees.find((e) => e.id === plan.employee_id)?.name ?? 'Mitarbeitende'));
  const displayEvents = [...filterEmployeeEvents(events, employeeId), ...blockedPlanEvents];
  const handleEventPress = (event: CalendarEvent) => {
    if (event.sourceType === 'employee_month_plan' && canManagePlanning && event.employeeId) {
      setEmployeeId(event.employeeId);
      setAnchor(new Date(`${(event.sourceId ?? event.start).slice(0, 7)}-15T12:00:00`));
      setPlanningOpen(true);
    } else onEventPress?.(event);
  };

  const weekStartDay = (settings?.weekStartDay ?? 1) as import('@/types/modules/calendarEvent').WeekStartDay;
  const visiblePlanningDates = viewMode === 'day' ? [datesInMonth(selectedMonth)[anchor.getDate() - 1]]
    : viewMode === 'week' || viewMode === 'agenda' ? Array.from({ length: 7 }, (_, i) => {
      const day = new Date(anchor);
      day.setDate(day.getDate() - ((day.getDay() - weekStartDay + 7) % 7) + i);
      return `${monthKey(day)}-${String(day.getDate()).padStart(2, '0')}`;
    }) : datesInMonth(selectedMonth);
  const maxCollapsed = settings?.maxCollapsedEvents ?? 3;
  const dayViewStartHour = settings?.dayViewStartHour ?? 6;
  const weekFullDay = settings?.weekFullDay ?? true;
  const visibleTypes = settings?.visibleTypes ?? form?.visibleTypes;

  const title = useMemo(() => {
    if (viewMode === 'day') return formatDayHeader(anchor);
    if (viewMode === 'week') return formatWeekRange(anchor, weekStartDay);
    if (viewMode === 'month' || viewMode === 'agenda' || viewMode === 'list') {
      return formatMonthYear(anchor);
    }
    return String(anchor.getFullYear());
  }, [anchor, viewMode, weekStartDay]);

  const navigate = useCallback(
    (delta: number) => {
      setAnchor((prev) => {
        if (viewMode === 'day') return addDays(prev, delta);
        if (viewMode === 'week' || viewMode === 'agenda') return addWeeks(prev, delta);
        if (viewMode === 'month' || viewMode === 'list') return addMonths(prev, delta);
        return addYears(prev, delta);
      });
    },
    [viewMode],
  );

  const handleSelectMonth = useCallback((monthIndex: number) => {
    setAnchor(startOfMonth(new Date(anchor.getFullYear(), monthIndex, 1)));
    setViewMode('month');
  }, [anchor]);

  if ((loading || settingsLoading) && events.length === 0) {
    return <LoadingState message="Kalender wird geladen…" />;
  }

  if (error) {
    return <ErrorState title="Kalender" message={error} onRetry={refresh} />;
  }

  const emptyMessage = config.emptyStateMessage ?? 'Für diesen Zeitraum sind keine Kalendereinträge sichtbar.';

  const renderCalendar = ({ selectedProfileId, onProfileDrop }: CalendarGridContentProps) => (
    <View
      style={styles.wrap}
      {...(Platform.OS === 'web'
        ? ({ dataSet: { healthosCalendarRevision: 'r6' } } as object)
        : {})}
    >
      <CalendarToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        title={title}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={() => setAnchor(new Date())}
        onOpenSettings={showSettings ? () => setSettingsOpen(true) : undefined}
        accentColor={accent}
      />

      {canViewPlanning ? <View style={styles.planningBar}>
        <View style={styles.employeeSelect}><CareEntitySelect label="Kalender für Mitarbeitende" value={employeeId}
          options={[{ value: '', label: 'Alle Mitarbeitenden' }, ...planning.employees.map((e) => ({ value: e.id, label: e.name }))]}
          onChange={setEmployeeId} placeholder="Alle Mitarbeitenden" error={planning.employeeError} /></View>
        {canManagePlanning ? <PremiumButton title="Verfügbarkeiten & Abwesenheiten" disabled={!employeeId || !planning.ready || !calendarReady || planning.loading}
          onPress={() => setPlanningOpen(true)} /> : null}
        <Text style={styles.planningHint}>{employeeId ? `${employeeName} · ${selectedMonth}. Planbar = gemeldete Zeiten abzüglich Terminen und Abwesenheiten. Nicht gemeldete Tage bleiben offen.` : 'Person auswählen, um nur deren Kalender und planbare Zeitfenster zu sehen.'}</Text>
        {employeeId && !calendarReady ? <Text style={styles.planningHint}>Planbarkeit wartet auf aktuelle Kalendertermine.</Text> : null}
        {planning.loading ? <Text style={styles.planningHint}>Planbarkeit wird geprüft…</Text> : null}
        <PremiumButton title="Aktualisieren" size="sm" variant="ghost" onPress={() => { planning.refresh(); void refresh(); }} />
        {planning.error ? <><Text style={styles.planningError}>{planning.error}</Text><PremiumButton title="Erneut laden" variant="secondary" onPress={planning.refresh} /></> : null}
        {viewMode !== 'month' && viewMode !== 'year' && planabilityByDay ? <View style={styles.availabilityList}>
          {visiblePlanningDates.map((date) =>
            <View key={date} style={styles.availabilityDay}><Text style={styles.planningHint}>{date.slice(8)}.{date.slice(5, 7)}.</Text><EmployeePlanabilityBadge value={planabilityByDay[date] ?? dayPlanability(date, monthSlots, planningEvents)} /></View>)}
        </View> : null}
      </View> : null}

      {showCreateAction || visibleTypes ? (
        <View style={styles.commandBar}>
          {showCreateAction ? (
            <CalendarCreateAction onPress={() => setCreateOpen(true)} accentColor={accent} />
          ) : null}
          {visibleTypes ? (
            <View style={styles.legend}>
              <Text style={styles.legendTitle}>SICHTBARE EREIGNISSE</Text>
              <CalendarFilterBar visibleTypes={visibleTypes} />
            </View>
          ) : null}
          {config.moduleKey === 'all' || config.moduleKey === 'assist' ? (
            <CalendarAssignmentStatusLegend />
          ) : null}
        </View>
      ) : null}

      {displayEvents.length === 0 && !employeeId ? (
        <EmptyState title="Keine Ereignisse" message={emptyMessage} />
      ) : null}

      <CalendarEventGrid
        viewMode={viewMode}
        anchor={anchor}
        events={displayEvents}
        planabilityByDay={planabilityByDay}
        weekStartDay={weekStartDay}
        maxCollapsedEvents={maxCollapsed}
        dayViewStartHour={dayViewStartHour}
        weekFullDay={weekFullDay}
        onEventPress={handleEventPress}
        onSelectMonth={handleSelectMonth}
        selectedAssignmentProfileId={selectedProfileId}
        onAssignmentProfileDrop={onProfileDrop}
      />

      {planningOpen && employeeId && tenantId && planning.ready && canManagePlanning ? <EmployeeMonthPlanningModal
        key={`${tenantId}:${employeeId}:${selectedMonth}`} tenantId={tenantId} employeeId={employeeId} employeeName={employeeName}
        month={selectedMonth} initial={selectedPlan} events={planningEvents}
        onClose={() => setPlanningOpen(false)} onSaved={() => { setPlanningOpen(false); planning.refresh(); void refresh(); }} /> : null}

      {showSettings ? (
        <OfficeCalendarSettingsModal
          visible={settingsOpen}
          initial={form}
          saving={saving}
          onClose={() => setSettingsOpen(false)}
          onSave={async (next) => {
            const result = await save(next);
            if (result.ok) {
              setViewMode(next.defaultView);
              setSettingsOpen(false);
            }
          }}
        />
      ) : null}

      <CalendarCreateModal
        visible={createOpen}
        sourceContext="calendar"
        calendarScope={config.calendarScope}
        moduleKey={config.moduleKey}
        accentColor={accent}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          void refresh();
        }}
      />
    </View>
  );

  if (
    config.moduleKey === 'all'
    || config.moduleKey === 'office'
    || config.moduleKey === 'assist'
  ) {
    return (
      <OfficeAssignmentProfileCalendarPlanner employeeIdFilter={employeeId} onScheduled={() => { planning.refresh(); return refresh(); }}>
        {({ selectedProfileId, onProfileDrop }) =>
          renderCalendar({ selectedProfileId, onProfileDrop })
        }
      </OfficeAssignmentProfileCalendarPlanner>
    );
  }

  return renderCalendar({ selectedProfileId: null });
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, minHeight: 0, minWidth: 0 },
  planningBar: { backgroundColor: '#F4F8FE', padding: 16, marginBottom: 16, borderRadius: 20, borderWidth: 1, borderColor: '#B4CDEB', gap: 12 },
  employeeSelect: { maxWidth: 520 },
  planningHint: { color: '#426180', fontSize: 13, lineHeight: 19 },
  planningError: { color: '#B31F3B', fontSize: 13 },
  availabilityList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  availabilityDay: { minWidth: 135, maxWidth: 240, flexGrow: 1 },
  commandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: careSpacing.md,
    marginBottom: careSpacing.md,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(118,211,255,0.24)',
    backgroundColor: 'rgba(4,25,50,0.72)',
  },
  legend: { flex: 1, minWidth: 280, gap: 8 },
  legendTitle: { color: '#7FDFFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
});
