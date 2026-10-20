import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import type { CalendarEvent, CalendarViewMode } from '@/types/modules/calendarEvent';
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar';
import { CalendarEventGrid, startOfMonth } from '@/components/calendar/CalendarEventGrid';
import { CalendarAgendaList } from '@/components/calendar/CalendarAgendaList';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { employeePortalCalendarEventHref, employeePortalCalendarEventOverlaps, employeePortalCalendarPeriod } from '@/lib/portal/employeePortalCalendarNavigation';
import { careTypography } from '@/design/tokens/typography';
import { careSpacing } from '@/design/tokens/spacing';
import { portalPremium } from '@/design/tokens/portalPremium';
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
import { useDeviceClass } from '@/hooks/useDeviceClass';

type EmployeePortalCalendarScreenProps = {
  onEventPress?: (event: CalendarEvent) => void;
};

export function EmployeePortalCalendarScreen({ onEventPress }: EmployeePortalCalendarScreenProps) {
  const router = useRouter();
  const { isPhone } = useDeviceClass();
  const { tenantId, employeeId, actorId, roleKey } = usePortalActor();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('agenda');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  useEffect(() => setSelectedEvent(null), [tenantId, employeeId, actorId, roleKey]);

  const range = useMemo(() => {
    const { start, end } = employeePortalCalendarPeriod(anchor, viewMode);
    return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
  }, [anchor, viewMode]);

  const { events, loading, error, refresh, refreshError, refreshing, config } = useEmployeePortalCalendarEvents(
    range.rangeStart,
    range.rangeEnd,
  );

  const accent = config?.moduleColor ?? '#FFB020';
  const weekStartDay = 1 as const;

  const title = useMemo(() => {
    if (viewMode === 'day') return formatDayHeader(anchor);
    if (viewMode === 'week' || viewMode === 'agenda') return formatWeekRange(anchor, weekStartDay);
    if (viewMode === 'month' || viewMode === 'list') {
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
      const href = employeePortalCalendarEventHref(event, employeeId);
      if (href) router.push(href as never);
      else setSelectedEvent(event);
    },
    [onEventPress, router, employeeId],
  );

  const phoneEvents = useMemo(() => {
    const { start, end } = employeePortalCalendarPeriod(anchor, viewMode);
    return events.filter((event) => employeePortalCalendarEventOverlaps(event, start, end));
  }, [anchor, events, viewMode]);

  if (loading && events.length === 0) {
    return <LoadingState message="Kalender wird geladen…" />;
  }

  if (error) {
    return <ErrorState title="Kalender" message={error} onRetry={refresh} />;
  }

  const emptyMessage =
    config?.emptyStateMessage ??
    'Im gewählten Zeitraum sind keine Einträge sichtbar. Wechseln Sie die Ansicht oder den Zeitraum.';

  const needsWideCanvas = !isPhone && (viewMode === 'month' || viewMode === 'week' || viewMode === 'year');

  const calendarGrid = (
    <CalendarEventGrid
      viewMode={viewMode}
      anchor={anchor}
      events={phoneEvents}
      weekStartDay={weekStartDay}
      maxCollapsedEvents={3}
      dayViewStartHour={6}
      weekFullDay
      onEventPress={handleEventPress}
      onSelectMonth={handleSelectMonth}
    />
  );

  return (
    <View style={[styles.wrap, isPhone && styles.wrapPhone]} testID="employee-portal-calendar">
      <PremiumButton title="Kalender aktualisieren" variant="secondary" disabled={refreshing} onPress={() => void refresh()} />
      {refreshError ? <ErrorState title="Aktualisierung nicht möglich" message={refreshError} onRetry={refresh} /> : null}
      <CalendarToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        title={title}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={() => setAnchor(new Date())}
        accentColor={accent}
        compact={isPhone}
        includeYear={!isPhone}
      />

      {phoneEvents.length === 0 ? (
        <EmptyState title="Keine Ereignisse in diesem Zeitraum" message={emptyMessage} />
      ) : isPhone ? (
        <CalendarAgendaList events={phoneEvents} onEventPress={handleEventPress} />
      ) : needsWideCanvas && Platform.OS === 'web' ? (
        <View
          style={styles.horizontalViewport}
          testID="employee-calendar-horizontal-scroll"
        >
          <View style={styles.wideCanvas}>{calendarGrid}</View>
        </View>
      ) : needsWideCanvas ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.wideCanvas}
          style={styles.horizontalViewport}
          testID="employee-calendar-horizontal-scroll"
        >
          {calendarGrid}
        </ScrollView>
      ) : (
        calendarGrid
      )}
      <PlatformModal visible={selectedEvent != null} title={selectedEvent?.title ?? 'Kalendereintrag'}
        onClose={() => setSelectedEvent(null)} variant={isPhone ? 'bottomSheet' : 'center'} minWidth={0}
        footerActions={[{ title: 'Schließen', variant: 'secondary', onPress: () => setSelectedEvent(null) }]}>
        {selectedEvent ? <View style={{ gap: careSpacing.md }}>
          <Text style={careTypography.bodyStrong}>{new Date(selectedEvent.start).toLocaleString('de-DE')} – {new Date(selectedEvent.end).toLocaleString('de-DE')}</Text>
          {selectedEvent.employeeName ? <Text style={careTypography.body}>Mitarbeitende: {selectedEvent.employeeName}</Text> : null}
          {selectedEvent.clientName ? <Text style={careTypography.body}>Klient:in: {selectedEvent.clientName}</Text> : null}
          {selectedEvent.record?.address || selectedEvent.record?.locationName ? <Text style={careTypography.body}>{selectedEvent.record?.address || selectedEvent.record?.locationName}</Text> : null}
          {selectedEvent.record?.publicNote ? <Text style={careTypography.body}>{selectedEvent.record?.publicNote}</Text> : null}
          <Text style={careTypography.body}>Dieser Eintrag ist im Teamkalender sichtbar. Die Durchführung öffnen Sie bei Ihren eigenen Einsätzen.</Text>
        </View> : null}
      </PlatformModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%', minWidth: 0, gap: careSpacing.lg, padding: careSpacing.md, borderRadius: 22,
    borderWidth: 1, borderColor: portalPremium.border,
    backgroundColor: portalPremium.surface,
    ...(Platform.OS === 'web' ? ({ boxShadow: portalPremium.shadow.card } as unknown as ViewStyle) : null),
  },
  wrapPhone: {
    gap: careSpacing.md,
    padding: 0,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  horizontalViewport: {
    width: '100%',
    minWidth: 0,
    ...(Platform.OS === 'web'
      ? ({
          overflowX: 'auto',
          overflowY: 'visible',
          // The grid may scroll horizontally, but a vertical swipe must keep
          // moving the surrounding month page on touch devices.
          touchAction: 'pan-x pan-y',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
        } as unknown as ViewStyle)
      : null),
  },
  wideCanvas: {
    minWidth: 1040,
    flexGrow: 1,
  },
});
