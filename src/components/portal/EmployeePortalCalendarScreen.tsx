import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { CalendarEvent, CalendarViewMode } from '@/types/modules/calendarEvent';
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar';
import { CalendarEventGrid, startOfMonth } from '@/components/calendar/CalendarEventGrid';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { spatialCare } from '@/design/tokens/spatialCareSuite';
import { useEmployeePortalCalendarEvents } from '@/hooks/useEmployeePortalCalendarEvents';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  formatDayHeader,
  formatMonthYear,
  formatWeekRange,
} from '@/lib/office/calendarDateUtils';

type EmployeePortalCalendarScreenProps = {
  onEventPress?: (event: CalendarEvent) => void;
};

export function EmployeePortalCalendarScreen({ onEventPress }: EmployeePortalCalendarScreenProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('agenda');
  const [anchor, setAnchor] = useState(() => new Date());

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

  const { events, loading, error, refresh, config } = useEmployeePortalCalendarEvents(
    range.rangeStart,
    range.rangeEnd,
  );

  const accent = config?.moduleColor ?? '#FFB020';
  const weekStartDay = 1 as const;

  const title = useMemo(() => {
    if (viewMode === 'day') return formatDayHeader(anchor);
    if (viewMode === 'week') return formatWeekRange(anchor, weekStartDay);
    if (viewMode === 'month' || viewMode === 'agenda' || viewMode === 'list') {
      return formatMonthYear(anchor);
    }
    return String(anchor.getFullYear());
  }, [anchor, viewMode]);

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

  const handleEventPress = useCallback(
    (event: CalendarEvent) => {
      if (onEventPress) {
        onEventPress(event);
        return;
      }
      if (event.href) {
        router.push(event.href as never);
      }
    },
    [onEventPress, router],
  );

  if (loading && events.length === 0) {
    return <LoadingState message="Kalender wird geladen…" />;
  }

  if (error) {
    return <ErrorState title="Kalender" message={error} onRetry={refresh} />;
  }

  const emptyMessage =
    config?.emptyStateMessage ??
    'Im gewählten Zeitraum sind keine Einträge sichtbar. Wechseln Sie die Ansicht oder den Zeitraum.';

  return (
    <View style={styles.wrap} testID="employee-portal-calendar">
      <CalendarToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        title={title}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={() => setAnchor(new Date())}
        accentColor={accent}
      />

      {events.length === 0 ? (
        <EmptyState title="Keine Ereignisse in diesem Zeitraum" message={emptyMessage} />
      ) : (
        <CalendarEventGrid
          viewMode={viewMode}
          anchor={anchor}
          events={events}
          weekStartDay={weekStartDay}
          maxCollapsedEvents={3}
          dayViewStartHour={6}
          weekFullDay
          onEventPress={handleEventPress}
          onSelectMonth={handleSelectMonth}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1, gap: careSpacing.lg, padding: careSpacing.md, borderRadius: 22,
    borderWidth: 1, borderColor: spatialCare.border,
    backgroundColor: spatialCare.stageStrong,
  },
});
