import { useMemo, useRef, useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { portalPremium, usePortalPremiumTheme } from '@/design/tokens/portalPremium';
import {
  eventsForDay,
  formatDayHeader,
  isSameDay,
  toDateKey,
} from '@/lib/office/calendarDateUtils';
import { CalendarEventLabel } from '@/components/calendar/CalendarEventLabel';
import {
  assignmentProfileClickCount,
  useAssignmentProfileDateSelection,
} from '@/components/calendar/AssignmentProfileDateSelection';
import { OfficeCalendarEventChip } from './OfficeCalendarEventChip';
import {
  buildAssignmentProfileDropTargetProps,
  type AssignmentProfileDropHandler,
} from '@/components/calendar/OfficeAssignmentProfileCalendarPlanner';
import { resolveAssignmentCalendarVisual } from '@/lib/calendar/assignmentCalendarStatus';

type OfficeCalendarDayViewProps = {
  anchor: Date;
  events: CalendarEvent[];
  dayViewStartHour: number;
  onEventPress?: (event: CalendarEvent) => void;
  selectedAssignmentProfileId?: string | null;
  onAssignmentProfileDrop?: AssignmentProfileDropHandler;
};

const HOUR_HEIGHT = 56;

export function OfficeCalendarDayView({
  anchor,
  events,
  dayViewStartHour,
  onEventPress,
  selectedAssignmentProfileId,
  onAssignmentProfileDrop,
}: OfficeCalendarDayViewProps) {
  const text = useAuroraAdaptiveText();
  const portal = usePortalPremiumTheme();
  const dateSelection = useAssignmentProfileDateSelection();
  const selected = dateSelection?.selectedDateKeys.includes(toDateKey(anchor)) ?? false;
  const scrollRef = useRef<ScrollView>(null);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const dayEvents = useMemo(() => eventsForDay(events, anchor), [events, anchor]);
  const allDay = dayEvents.filter((e) => e.allDay);
  const timed = dayEvents.filter((e) => !e.allDay);

  useEffect(() => {
    const y = dayViewStartHour * HOUR_HEIGHT;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, dayViewStartHour]);

  return (
    <GlassCard style={styles.card}>
      {dateSelection ? (
        <Pressable
          style={[styles.selectableTitle, selected && styles.selectedTitle]}
          disabled={dateSelection.disabled}
          onPress={(event) => {
            if (!dateSelection.disabled) dateSelection.selectDate(anchor, assignmentProfileClickCount(event));
          }}
          accessibilityRole="button"
          accessibilityLabel={`${formatDayHeader(anchor)}, ${selected ? 'für das Einsatzprofil ausgewählt' : 'für das Einsatzprofil auswählen'}`}
          accessibilityState={{ selected, disabled: dateSelection.disabled }}
          accessibilityHint="Ein Klick ändert die Auswahl. Ein Doppelklick wählt nur diesen Tag."
        >
          <Text style={[styles.selectableTitleText, { color: text.primary }]}>{formatDayHeader(anchor)}</Text>
          <View pointerEvents="none" style={!selected && styles.selectionMarkHidden}>
            <Text accessible={false} style={styles.selectionMark}>✓</Text>
          </View>
        </Pressable>
      ) : (
        <Text style={[styles.title, { color: text.primary }]}>{formatDayHeader(anchor)}</Text>
      )}

      {allDay.length > 0 ? (
        <View style={[styles.allDay, portal.active && styles.portalSoftSurface]}>
          <Text style={[styles.allDayLabel, { color: text.muted }]}>Ganztägig</Text>
          {allDay.map((event) => (
            <OfficeCalendarEventChip key={event.id} event={event} onEventPress={onEventPress} />
          ))}
        </View>
      ) : null}

      <ScrollView ref={scrollRef} style={styles.scroll} nestedScrollEnabled>
        <View style={styles.grid}>
          {hours.map((h) => {
            const slotEvents = timed.filter((event) => {
              const start = new Date(event.start);
              return isSameDay(start, anchor) && start.getHours() === h;
            });
            return (
              <Pressable
                key={h}
                onPress={
                  dateSelection
                    ? (event) => {
                        if (!dateSelection.disabled) {
                          dateSelection.selectDate(anchor, assignmentProfileClickCount(event), `${String(h).padStart(2, '0')}:00`);
                        }
                      }
                    : selectedAssignmentProfileId && onAssignmentProfileDrop
                    ? () =>
                        onAssignmentProfileDrop(
                          selectedAssignmentProfileId,
                          anchor,
                          `${String(h).padStart(2, '0')}:00`,
                        )
                    : undefined
                }
                disabled={dateSelection?.disabled}
                accessibilityRole={dateSelection ? 'button' : undefined}
                accessibilityLabel={dateSelection ? `${formatDayHeader(anchor)}, ${selected ? 'für das Einsatzprofil ausgewählt' : 'für das Einsatzprofil auswählen'}, Zeitvorschlag ${String(h).padStart(2, '0')}:00 Uhr` : undefined}
                accessibilityState={dateSelection ? { selected, disabled: dateSelection.disabled } : undefined}
                {...buildAssignmentProfileDropTargetProps(
                  anchor,
                  onAssignmentProfileDrop,
                  `${String(h).padStart(2, '0')}:00`,
                )}
                style={[styles.row, portal.active && styles.portalRow, selected && styles.selectedRow, { minHeight: HOUR_HEIGHT }]}
              >
                <Text style={[styles.hour, { color: text.muted }]}>{String(h).padStart(2, '0')}:00</Text>
                <View style={styles.slot}>
                  {slotEvents.map((event) => {
                    const assignmentVisual = resolveAssignmentCalendarVisual(event);
                    const blockStyle = [
                      styles.eventBlock,
                      portal.active && styles.portalSoftSurface,
                      {
                        backgroundColor: assignmentVisual?.tint ?? auroraGlass.chip,
                        borderColor: assignmentVisual?.outline ?? 'transparent',
                        borderLeftColor: assignmentVisual?.color ?? event.color,
                      },
                    ];
                    const inner = (
                      <CalendarEventLabel event={event} variant="stacked" showService />
                    );
                    if (onEventPress) {
                      return (
                        <Pressable
                          key={event.id}
                          onPress={(pressEvent) => {
                            if (Platform.OS === 'web') pressEvent.stopPropagation();
                            onEventPress(event);
                          }}
                          style={blockStyle}
                        >
                          {inner}
                        </Pressable>
                      );
                    }
                    return (
                      <View key={event.id} style={blockStyle}>
                        {inner}
                      </View>
                    );
                  })}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: careSpacing.md },
  title: { fontSize: 16, fontWeight: '700', marginBottom: careSpacing.md },
  selectableTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 8,
    padding: careSpacing.xs,
    marginBottom: careSpacing.md,
  },
  selectableTitleText: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '700' },
  selectedTitle: {
    backgroundColor: 'rgba(35, 136, 255, 0.18)',
    borderColor: '#0866C2',
  },
  selectionMark: {
    width: 20,
    height: 20,
    lineHeight: 20,
    borderRadius: 10,
    textAlign: 'center',
    color: '#FFFFFF',
    backgroundColor: '#0866C2',
    fontSize: 13,
    fontWeight: '800',
  },
  selectionMarkHidden: { opacity: 0 },
  selectedRow: {
    backgroundColor: 'rgba(35, 136, 255, 0.12)',
    borderColor: 'rgba(8, 102, 194, 0.36)',
  },
  allDay: {
    marginBottom: careSpacing.md,
    padding: careSpacing.sm,
    borderRadius: 8,
    backgroundColor: auroraGlass.chip,
    gap: careSpacing.xs,
  },
  allDayLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  scroll: { maxHeight: 560 },
  grid: { gap: 0 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: auroraGlass.innerBorder,
  },
  hour: {
    width: 52,
    paddingTop: 4,
    fontSize: 11,
  },
  slot: {
    flex: 1,
    paddingVertical: 4,
    paddingRight: careSpacing.sm,
    gap: 4,
  },
  eventBlock: {
    borderWidth: 1,
    borderLeftWidth: 4,
    backgroundColor: auroraGlass.chip,
    borderRadius: 6,
    padding: careSpacing.sm,
  },
  portalRow: { borderColor: portalPremium.borderSoft },
  portalSoftSurface: { backgroundColor: portalPremium.surfaceSoft },
});
