import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { GlassCard } from '@/design/components/GlassCard';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import {
  addMonths,
  endOfMonth,
  eventOverlapsDay,
  MONTH_LABELS_DE,
  startOfMonth,
  startOfYear,
  toDateKey,
} from '@/lib/office/calendarDateUtils';

type OfficeCalendarYearViewProps = {
  anchor: Date;
  events: CalendarEvent[];
  onSelectMonth: (monthIndex: number) => void;
};

function countVacationDaysInMonth(events: CalendarEvent[], monthStart: Date): number {
  const monthEnd = endOfMonth(monthStart);
  let count = 0;
  for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    const hasVacation = events.some(
      (e) =>
        (e.type === 'urlaub' || e.type === 'krank' || e.type === 'abwesenheit') &&
        eventOverlapsDay(e.start, e.end, day),
    );
    if (hasVacation) count += 1;
  }
  return count;
}

function densityLevel(count: number, max: number): 'low' | 'mid' | 'high' | 'none' {
  if (count === 0) return 'none';
  const ratio = count / Math.max(max, 1);
  if (ratio > 0.6) return 'high';
  if (ratio > 0.3) return 'mid';
  return 'low';
}

const DENSITY_COLORS = {
  none: auroraGlass.chip,
  low: 'rgba(34,197,94,0.25)',
  mid: 'rgba(34,197,94,0.45)',
  high: 'rgba(34,197,94,0.7)',
};

export function OfficeCalendarYearView({ anchor, events, onSelectMonth }: OfficeCalendarYearViewProps) {
  const text = useAuroraAdaptiveText();
  const year = anchor.getFullYear();
  const yearStart = startOfYear(anchor);

  const monthStats = useMemo(() => {
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthStart = addMonths(yearStart, monthIndex);
      const vacationDays = countVacationDaysInMonth(events, monthStart);
      const totalEvents = events.filter((e) => {
        const start = new Date(e.start);
        return start.getFullYear() === year && start.getMonth() === monthIndex;
      }).length;
      return { monthIndex, vacationDays, totalEvents };
    });
  }, [events, year, yearStart]);

  const maxVacation = Math.max(...monthStats.map((m) => m.vacationDays), 1);

  return (
    <GlassCard style={styles.card}>
      <Text style={[styles.title, text.primary]}>Urlaubsplanung {year}</Text>
      <Text style={[styles.subtitle, text.muted]}>
        Heatmap zeigt Abwesenheitstage pro Monat — Monat antippen für Detailansicht
      </Text>
      <View style={styles.grid}>
        {monthStats.map(({ monthIndex, vacationDays, totalEvents }) => {
          const level = densityLevel(vacationDays, maxVacation);
          return (
            <Pressable
              key={monthIndex}
              onPress={() => onSelectMonth(monthIndex)}
              style={[styles.monthTile, { backgroundColor: DENSITY_COLORS[level] }]}
              accessibilityRole="button"
            >
              <Text style={[styles.monthLabel, text.primary]}>{MONTH_LABELS_DE[monthIndex]}</Text>
              <Text style={[styles.stat, text.secondary]}>{vacationDays} Abw.</Text>
              <Text style={[styles.stat, text.muted]}>{totalEvents} Ereign.</Text>
              <View style={styles.miniGrid}>
                {Array.from({ length: 28 }, (_, i) => {
                  const day = new Date(year, monthIndex, i + 1);
                  if (day.getMonth() !== monthIndex) return null;
                  const busy = events.some((e) => eventOverlapsDay(e.start, e.end, day));
                  return (
                    <View
                      key={toDateKey(day)}
                      style={[styles.miniDot, busy && { backgroundColor: auroraGlass.chipActive }]}
                    />
                  );
                })}
              </View>
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: careSpacing.md },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 4, marginBottom: careSpacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  monthTile: {
    width: '30%',
    minWidth: 140,
    flexGrow: 1,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: auroraGlass.border,
    padding: careSpacing.sm,
  },
  monthLabel: { fontSize: 14, fontWeight: '700' },
  stat: { fontSize: 11, marginTop: 2 },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    marginTop: careSpacing.sm,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: auroraGlass.innerBorder,
  },
});
