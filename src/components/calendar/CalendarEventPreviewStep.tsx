import { StyleSheet, Text, View } from 'react-native';
import type { CalendarEventTemplate } from '@/types/calendar';
import type { CalendarEventFormState } from '@/types/calendar/calendarEventForm';
import { CALENDAR_EVENT_TYPE_LABELS } from '@/types/modules/calendarEvent';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { careRadius } from '@/design/tokens/radius';
import { auroraGlass } from '@/design/tokens/auroraGlass';

type CalendarEventPreviewStepProps = {
  form: CalendarEventFormState;
  template: CalendarEventTemplate | null;
  moduleKey: string;
};

function PreviewRow({ label, value, muted }: { label: string; value: string; muted: string }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: muted }]}>{value}</Text>
    </View>
  );
}

export function CalendarEventPreviewStep({ form, template, moduleKey }: CalendarEventPreviewStepProps) {
  const text = useAuroraAdaptiveText();
  const startLabel = new Date(form.startAt).toLocaleString('de-DE');
  const endLabel = new Date(form.endAt).toLocaleString('de-DE');
  const typeLabel = CALENDAR_EVENT_TYPE_LABELS[form.eventType] ?? form.eventType;

  return (
    <View style={[styles.card, { borderColor: auroraGlass.border, backgroundColor: auroraGlass.card }]}>
      <Text style={[styles.title, { color: text.primary }]}>{form.title || '—'}</Text>
      <Text style={[styles.subtitle, { color: text.muted }]}>
        {template?.label ?? 'Ohne Vorlage'} · {moduleKey} · {typeLabel}
      </Text>

      <PreviewRow label="Zeitraum" value={`${startLabel} – ${endLabel}`} muted={text.muted} />
      {form.allDay ? <PreviewRow label="Ganztägig" value="Ja" muted={text.muted} /> : null}
      <PreviewRow label="Ort" value={form.locationName} muted={text.muted} />
      <PreviewRow label="Raum" value={form.room} muted={text.muted} />
      <PreviewRow label="Beschreibung" value={form.description} muted={text.muted} />
      <PreviewRow label="Klient" value={form.relatedClientId} muted={text.muted} />
      <PreviewRow label="Mitarbeiter" value={form.relatedEmployeeId} muted={text.muted} />
      <PreviewRow label="Wohnbereich" value={form.relatedWardId} muted={text.muted} />

      <Text style={[styles.section, { color: text.muted }]}>Sichtbarkeit</Text>
      <PreviewRow
        label="Office-Kalender"
        value={form.isOfficeVisible ? 'Sichtbar' : 'Ausgeblendet'}
        muted={text.muted}
      />
      <PreviewRow
        label="Modul-Kalender"
        value={form.isModuleVisible ? 'Sichtbar' : 'Ausgeblendet'}
        muted={text.muted}
      />
      <PreviewRow
        label="Klientenportal"
        value={form.isClientPortalVisible ? 'Sichtbar' : 'Ausgeblendet'}
        muted={text.muted}
      />
      <PreviewRow
        label="Mitarbeiterportal"
        value={form.isEmployeePortalVisible ? 'Sichtbar' : 'Ausgeblendet'}
        muted={text.muted}
      />

      {form.reminderMinutes != null ? (
        <PreviewRow label="Erinnerung" value={`${form.reminderMinutes} Min. vorher`} muted={text.muted} />
      ) : null}
      <PreviewRow label="Nachverfolgung" value={form.followUpNote} muted={text.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: careSpacing.lg,
    borderRadius: careRadius.md,
    borderWidth: 1,
    gap: careSpacing.xs,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: careSpacing.md },
  section: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: careSpacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: careSpacing.md, paddingVertical: 2 },
  rowLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  rowValue: { fontSize: 13, flex: 2, textAlign: 'right' },
});
