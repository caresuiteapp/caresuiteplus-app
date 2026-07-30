import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarEventTemplatePicker } from '@/product-workflows/components/calendar/CalendarEventTemplatePicker';
import { ScreenShell } from '@/product-workflows/components/layout';
import { PremiumBadge, PremiumButton, SectionPanel } from '@/product-workflows/components/ui';
import { moduleColor } from '@/product-workflows/design/tokens/modules';
import type { CalendarEventTemplate } from '@/types/calendar';
import { spacing, typography } from '@/product-workflows/theme';

/** Echte Kalender-Vorlagenübersicht mit System- und Mandantenvorlagen. */
export default function CalendarTemplatesScreen() {
  const router = useRouter();
  const accent = moduleColor('office');
  const [selected, setSelected] = useState<CalendarEventTemplate | null>(null);

  return (
    <ScreenShell
      title="Kalender-Vorlagen"
      subtitle="System- und Mandantenvorlagen auswählen"
      rightSlot={
        <PremiumButton
          title="Zur Assist-Einsatzplanung"
          variant="secondary"
          onPress={() => router.push('/assist/kalender' as never)}
        />
      }
    >
      <SectionPanel
        title="Vorlagen"
        subtitle="Vorhandene Systemeinträge werden automatisch geladen; die Auswahl zeigt alle hinterlegten Vorgaben."
      >
        <CalendarEventTemplatePicker
          moduleKey="all"
          selectedId={selected?.id}
          onSelect={setSelected}
          accentColor={accent}
        />
      </SectionPanel>

      {selected ? (
        <SectionPanel title="Ausgewählte Vorlage" subtitle={selected.description ?? 'Keine Beschreibung hinterlegt'}>
          <View style={styles.summary}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{selected.label}</Text>
              <PremiumBadge label={selected.isSystem ? 'Systemvorlage' : 'Mandantenvorlage'} variant="muted" />
            </View>
            <Text style={styles.meta}>
              Modul: {selected.moduleKey} · Dauer: {selected.defaultDurationMinutes} Minuten · {selected.allDay ? 'Ganztägig' : 'Mit Uhrzeit'}
            </Text>
            <Text style={styles.meta}>{selected.fieldSchema.length} strukturierte Felder</Text>
          </View>
        </SectionPanel>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.h3, flex: 1 },
  meta: { ...typography.body },
});
