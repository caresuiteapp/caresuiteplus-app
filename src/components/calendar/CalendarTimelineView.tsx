import { StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';

type CalendarTimelineViewProps = {
  events: CalendarEvent[];
  anchor: Date;
  onEventPress?: (event: CalendarEvent) => void;
};

/** Timeline-Ansicht — Stub für zukünftige Gantt-/Ressourcenplanung */
export function CalendarTimelineView({ events, anchor }: CalendarTimelineViewProps) {
  const text = useAuroraAdaptiveText();

  return (
    <GlassCard style={styles.card}>
      <Text style={[styles.title, { color: text.primary }]}>Timeline</Text>
      <Text style={[styles.hint, { color: text.muted }]}>
        Ressourcen-Timeline für {anchor.toLocaleDateString('de-DE')} — {events.length} Ereignisse.
        Vollständige Timeline-Planung folgt in einer späteren Version.
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: careSpacing.lg, flex: 1 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: careSpacing.sm },
  hint: { fontSize: 13, lineHeight: 20 },
});
