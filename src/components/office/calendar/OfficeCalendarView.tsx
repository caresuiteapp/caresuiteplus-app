import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CalendarViewMode } from '@/types/modules/calendarEvent';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { useOfficeCalendar } from '@/hooks/useOfficeCalendar';
import { useTenantCalendarSettings } from '@/hooks/useTenantCalendarSettings';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  formatDayHeader,
  formatMonthYear,
  formatWeekRange,
  startOfMonth,
} from '@/lib/office/calendarDateUtils';
import { OfficeCalendarDayView } from './OfficeCalendarDayView';
import { OfficeCalendarLegend } from './OfficeCalendarLegend';
import { OfficeCalendarMonthView } from './OfficeCalendarMonthView';
import { OfficeCalendarSettingsModal } from './OfficeCalendarSettingsModal';
import { OfficeCalendarToolbar } from './OfficeCalendarToolbar';
import { OfficeCalendarWeekView } from './OfficeCalendarWeekView';
import { OfficeCalendarYearView } from './OfficeCalendarYearView';

export function OfficeCalendarView() {
  const { settings, form, saving, save, loading: settingsLoading } = useTenantCalendarSettings();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (settings?.defaultView) setViewMode(settings.defaultView);
  }, [settings?.defaultView]);

  const range = useMemo(() => {
    const start = new Date(anchor);
    const end = new Date(anchor);
    if (viewMode === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'week') {
      start.setDate(start.getDate() - 7);
      end.setDate(end.getDate() + 7);
    } else if (viewMode === 'month') {
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

  const { events, loading, error, refresh } = useOfficeCalendar(range.rangeStart, range.rangeEnd);

  const weekStartDay = settings?.weekStartDay ?? 1;
  const maxCollapsed = settings?.maxCollapsedEvents ?? 3;
  const dayViewStartHour = settings?.dayViewStartHour ?? 6;
  const weekFullDay = settings?.weekFullDay ?? true;
  const visibleTypes = settings?.visibleTypes ?? form?.visibleTypes;

  const title = useMemo(() => {
    if (viewMode === 'day') return formatDayHeader(anchor);
    if (viewMode === 'week') return formatWeekRange(anchor, weekStartDay);
    if (viewMode === 'month') return formatMonthYear(anchor);
    return String(anchor.getFullYear());
  }, [anchor, viewMode, weekStartDay]);

  const navigate = useCallback(
    (delta: number) => {
      setAnchor((prev) => {
        if (viewMode === 'day') return addDays(prev, delta);
        if (viewMode === 'week') return addWeeks(prev, delta);
        if (viewMode === 'month') return addMonths(prev, delta);
        return addYears(prev, delta);
      });
    },
    [viewMode],
  );

  if ((loading || settingsLoading) && events.length === 0) {
    return <LoadingState message="Kalender wird geladen…" />;
  }

  if (error) {
    return <ErrorState title="Kalender" message={error} onRetry={refresh} />;
  }

  return (
    <View style={styles.wrap}>
      <OfficeCalendarToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        title={title}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={() => setAnchor(new Date())}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {visibleTypes ? (
        <View style={styles.legend}>
          <OfficeCalendarLegend visibleTypes={visibleTypes} />
        </View>
      ) : null}

      {events.length === 0 ? (
        <EmptyState
          title="Keine Ereignisse"
          message="Für diesen Zeitraum sind keine Kalendereinträge sichtbar."
        />
      ) : null}

      {viewMode === 'month' ? (
        <OfficeCalendarMonthView
          anchor={anchor}
          events={events}
          weekStartDay={weekStartDay}
          maxCollapsedEvents={maxCollapsed}
        />
      ) : null}

      {viewMode === 'week' ? (
        <OfficeCalendarWeekView
          anchor={anchor}
          events={events}
          weekStartDay={weekStartDay}
          weekFullDay={weekFullDay}
          dayViewStartHour={dayViewStartHour}
        />
      ) : null}

      {viewMode === 'day' ? (
        <OfficeCalendarDayView
          anchor={anchor}
          events={events}
          dayViewStartHour={dayViewStartHour}
        />
      ) : null}

      {viewMode === 'year' ? (
        <OfficeCalendarYearView
          anchor={anchor}
          events={events}
          onSelectMonth={(monthIndex) => {
            setAnchor(startOfMonth(new Date(anchor.getFullYear(), monthIndex, 1)));
            setViewMode('month');
          }}
        />
      ) : null}

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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  legend: { marginBottom: careSpacing.md },
});
