import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CalendarEvent, CalendarViewMode } from '@/types/modules/calendarEvent';
import type { CalendarViewConfig } from '@/types/calendar';
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

export type CalendarPageShellProps = {
  config: CalendarViewConfig;
  onEventPress?: (event: CalendarEvent) => void;
  showCreateAction?: boolean;
  showSettings?: boolean;
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
    return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
  }, [anchor, viewMode]);

  const { events, loading, error, refresh } = useCalendarEvents(
    range.rangeStart,
    range.rangeEnd,
    config,
  );

  const weekStartDay = (settings?.weekStartDay ?? 1) as import('@/types/modules/calendarEvent').WeekStartDay;
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

  return (
    <View style={styles.wrap}>
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

      {showCreateAction ? (
        <CalendarCreateAction onPress={() => setCreateOpen(true)} accentColor={accent} />
      ) : null}

      {visibleTypes ? (
        <View style={styles.legend}>
          <CalendarFilterBar visibleTypes={visibleTypes} />
        </View>
      ) : null}

      {events.length === 0 ? (
        <EmptyState title="Keine Ereignisse" message={emptyMessage} />
      ) : null}

      <CalendarEventGrid
        viewMode={viewMode}
        anchor={anchor}
        events={events}
        weekStartDay={weekStartDay}
        maxCollapsedEvents={maxCollapsed}
        dayViewStartHour={dayViewStartHour}
        weekFullDay={weekFullDay}
        onEventPress={onEventPress}
        onSelectMonth={handleSelectMonth}
      />

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
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  legend: { marginBottom: careSpacing.md },
});
