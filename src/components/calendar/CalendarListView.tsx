import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { CALENDAR_EVENT_TYPE_LABELS } from '@/types/modules/calendarEvent';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { formatTime } from '@/lib/office/calendarDateUtils';
import { CalendarEventLabel } from '@/components/calendar/CalendarEventLabel';

type CalendarListViewProps = {
  events: CalendarEvent[];
  onEventPress?: (event: CalendarEvent) => void;
};

export function CalendarListView({ events, onEventPress }: CalendarListViewProps) {
  const text = useAuroraAdaptiveText();
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <ScrollView style={styles.scroll} nestedScrollEnabled>
      <GlassCard style={styles.table}>
        <View style={[styles.headerRow, { borderBottomColor: auroraGlass.border }]}>
          <Text style={[styles.headerCell, styles.colDate, { color: text.muted }]}>Datum</Text>
          <Text style={[styles.headerCell, styles.colTime, { color: text.muted }]}>Zeit</Text>
          <Text style={[styles.headerCell, styles.colTitle, { color: text.muted }]}>Titel</Text>
          <Text style={[styles.headerCell, styles.colType, { color: text.muted }]}>Typ</Text>
          <Text style={[styles.headerCell, styles.colModule, { color: text.muted }]}>Modul</Text>
        </View>
        {sorted.map((event) => {
          const dateLabel = new Date(event.start).toLocaleDateString('de-DE', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
          });
          const typeLabel = CALENDAR_EVENT_TYPE_LABELS[event.type] ?? event.type;
          return (
            <Pressable
              key={event.id}
              onPress={() => onEventPress?.(event)}
              style={[styles.dataRow, { borderBottomColor: auroraGlass.border }]}
              accessibilityRole="button"
            >
              <Text style={[styles.cell, styles.colDate, { color: text.secondary }]}>{dateLabel}</Text>
              <Text style={[styles.cell, styles.colTime, { color: text.secondary }]}>
                {event.allDay ? '—' : `${formatTime(event.start)} – ${formatTime(event.end)}`}
              </Text>
              <View style={styles.colTitle}>
                <View style={[styles.accent, { backgroundColor: event.color }]} />
                <CalendarEventLabel event={event} variant="inline" showTime={false} numberOfLines={2} />
              </View>
              <Text style={[styles.cell, styles.colType, { color: text.muted }]}>{typeLabel}</Text>
              <Text style={[styles.cell, styles.colModule, { color: text.muted }]}>
                {event.moduleKey ?? '—'}
              </Text>
            </Pressable>
          );
        })}
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  table: { padding: 0, overflow: 'hidden', borderRadius: careRadius.md },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    borderBottomWidth: 1,
    backgroundColor: auroraGlass.chip,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCell: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  cell: { fontSize: 13 },
  colDate: { width: 72 },
  colTime: { width: 96 },
  colTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  colType: { width: 88 },
  colModule: { width: 72 },
  accent: { width: 3, height: 16, borderRadius: 2 },
});
