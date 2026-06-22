import { useMemo } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { CalendarEventTemplate, CalendarModuleKey } from '@/types/calendar';
import type { CalendarEventFormState, CalendarFormStep } from '@/types/calendar/calendarEventForm';
import { CALENDAR_FORM_STEP_LABELS } from '@/types/calendar/calendarEventForm';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careRadius } from '@/design/tokens/radius';
import { spacing } from '@/theme';
import { PremiumButton } from '@/components/ui';
import { CalendarEventTemplatePicker } from './CalendarEventTemplatePicker';
import { CalendarEventPreviewStep } from './CalendarEventPreviewStep';

type CalendarEventFormProps = {
  step: CalendarFormStep;
  moduleKey: CalendarModuleKey;
  form: CalendarEventFormState;
  template: CalendarEventTemplate | null;
  accentColor?: string;
  onChange: (patch: Partial<CalendarEventFormState>) => void;
  onSelectTemplate: (template: CalendarEventTemplate) => void;
  onContinueWithoutTemplate: () => void;
  onAssistEinsatzLink?: () => void;
};

export function CalendarEventForm({
  step,
  moduleKey,
  form,
  template,
  accentColor = '#62F3FF',
  onChange,
  onSelectTemplate,
  onContinueWithoutTemplate,
  onAssistEinsatzLink,
}: CalendarEventFormProps) {
  const { c } = useCareLightPalette();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: spacing.md },
        label: { color: c.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
        input: {
          color: c.text,
          fontSize: 15,
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.25)',
          borderRadius: careRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: 'rgba(15,23,42,0.45)',
        },
        multiline: { minHeight: 80, textAlignVertical: 'top' },
        row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        stepHint: { color: c.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
        typeCard: {
          padding: spacing.md,
          borderRadius: careRadius.md,
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.25)',
          backgroundColor: 'rgba(15,23,42,0.35)',
          gap: spacing.sm,
        },
        typeTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
        typeDesc: { color: c.muted, fontSize: 13, lineHeight: 18 },
      }),
    [c.muted, c.text],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.stepHint}>{CALENDAR_FORM_STEP_LABELS[step]}</Text>

      {step === 'type' && moduleKey === 'assist' ? (
        <>
          <View style={styles.typeCard}>
            <Text style={styles.typeTitle}>Termin / Kalendereintrag</Text>
            <Text style={styles.typeDesc}>
              Planen Sie Besprechungen, Abwesenheiten oder andere Kalendereinträge im Assist-Modul.
            </Text>
          </View>
          <View style={styles.typeCard}>
            <Text style={styles.typeTitle}>Assist-Einsatz</Text>
            <Text style={styles.typeDesc}>
              Einsätze werden separat im Einsatz-Wizard angelegt — nicht über Termin-Vorlagen.
            </Text>
            {onAssistEinsatzLink ? (
              <PremiumButton title="Einsatz-Wizard öffnen" variant="secondary" onPress={onAssistEinsatzLink} />
            ) : null}
          </View>
        </>
      ) : null}

      {step === 'template' ? (
        <CalendarEventTemplatePicker
          moduleKey={moduleKey}
          selectedId={template?.id}
          accentColor={accentColor}
          onSelect={onSelectTemplate}
          onContinueWithoutTemplate={onContinueWithoutTemplate}
        />
      ) : null}

      {step === 'basics' ? (
        <>
          <Text style={styles.label}>Titel *</Text>
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={(title) => onChange({ title })}
            placeholder="Titel eingeben"
            placeholderTextColor={c.muted}
          />
          <Text style={styles.label}>Beschreibung</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={form.description}
            onChangeText={(description) => onChange({ description })}
            placeholder="Optionale Beschreibung"
            placeholderTextColor={c.muted}
            multiline
          />
        </>
      ) : null}

      {step === 'relations' ? (
        <>
          <Text style={styles.label}>Klient / Bewohner</Text>
          <TextInput
            style={styles.input}
            value={form.relatedClientId}
            onChangeText={(relatedClientId) => onChange({ relatedClientId })}
            placeholder="Klient-ID oder Name"
            placeholderTextColor={c.muted}
          />
          <Text style={styles.label}>Fall / Akte</Text>
          <TextInput
            style={styles.input}
            value={form.relatedCaseId}
            onChangeText={(relatedCaseId) => onChange({ relatedCaseId })}
            placeholder="Fall-ID"
            placeholderTextColor={c.muted}
          />
          <Text style={styles.label}>Wohnbereich</Text>
          <TextInput
            style={styles.input}
            value={form.relatedWardId}
            onChangeText={(relatedWardId) => onChange({ relatedWardId })}
            placeholder="Wohnbereich"
            placeholderTextColor={c.muted}
          />
        </>
      ) : null}

      {step === 'datetime' ? (
        <>
          <Text style={styles.label}>Beginn (ISO)</Text>
          <TextInput
            style={styles.input}
            value={form.startAt}
            onChangeText={(startAt) => onChange({ startAt })}
            placeholder="2026-06-20T10:00:00.000Z"
            placeholderTextColor={c.muted}
          />
          <Text style={styles.label}>Ende (ISO)</Text>
          <TextInput
            style={styles.input}
            value={form.endAt}
            onChangeText={(endAt) => onChange({ endAt })}
            placeholder="2026-06-20T11:00:00.000Z"
            placeholderTextColor={c.muted}
          />
          <View style={styles.row}>
            <Text style={styles.label}>Ganztägig</Text>
            <Switch value={form.allDay} onValueChange={(allDay) => onChange({ allDay })} />
          </View>
        </>
      ) : null}

      {step === 'location' ? (
        <>
          <Text style={styles.label}>Ort</Text>
          <TextInput
            style={styles.input}
            value={form.locationName}
            onChangeText={(locationName) => onChange({ locationName })}
            placeholder="Ort oder Adresse"
            placeholderTextColor={c.muted}
          />
          <Text style={styles.label}>Raum</Text>
          <TextInput
            style={styles.input}
            value={form.room}
            onChangeText={(room) => onChange({ room })}
            placeholder="Raum / Etage"
            placeholderTextColor={c.muted}
          />
          <Text style={styles.label}>Adresse</Text>
          <TextInput
            style={styles.input}
            value={form.address}
            onChangeText={(address) => onChange({ address })}
            placeholder="Straße, PLZ Ort"
            placeholderTextColor={c.muted}
          />
        </>
      ) : null}

      {step === 'participants' ? (
        <>
          <Text style={styles.label}>Mitarbeiter</Text>
          <TextInput
            style={styles.input}
            value={form.relatedEmployeeId}
            onChangeText={(relatedEmployeeId) => onChange({ relatedEmployeeId })}
            placeholder="Mitarbeiter-ID oder Name"
            placeholderTextColor={c.muted}
          />
          <Text style={styles.label}>Teilnehmer-Notiz</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={form.participantNote}
            onChangeText={(participantNote) => onChange({ participantNote })}
            placeholder="Weitere Beteiligte"
            placeholderTextColor={c.muted}
            multiline
          />
        </>
      ) : null}

      {step === 'visibility' ? (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>Office-Kalender</Text>
            <Switch
              value={form.isOfficeVisible}
              onValueChange={(isOfficeVisible) => onChange({ isOfficeVisible })}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Modul-Kalender</Text>
            <Switch
              value={form.isModuleVisible}
              onValueChange={(isModuleVisible) => onChange({ isModuleVisible })}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Klientenportal</Text>
            <Switch
              value={form.isClientPortalVisible}
              onValueChange={(isClientPortalVisible) => onChange({ isClientPortalVisible })}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Mitarbeiterportal</Text>
            <Switch
              value={form.isEmployeePortalVisible}
              onValueChange={(isEmployeePortalVisible) => onChange({ isEmployeePortalVisible })}
            />
          </View>
          <Text style={styles.label}>Interne Notiz</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={form.internalNote}
            onChangeText={(internalNote) => onChange({ internalNote })}
            placeholder="Nur intern sichtbar"
            placeholderTextColor={c.muted}
            multiline
          />
          <Text style={styles.label}>Öffentliche Notiz</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={form.publicNote}
            onChangeText={(publicNote) => onChange({ publicNote })}
            placeholder="Für Portale sichtbar"
            placeholderTextColor={c.muted}
            multiline
          />
        </>
      ) : null}

      {step === 'reminders' ? (
        <>
          <Text style={styles.label}>Erinnerung (Minuten vorher)</Text>
          <TextInput
            style={styles.input}
            value={form.reminderMinutes != null ? String(form.reminderMinutes) : ''}
            onChangeText={(v) => onChange({ reminderMinutes: v ? Number(v) : null })}
            placeholder="30"
            placeholderTextColor={c.muted}
            keyboardType="numeric"
          />
          <Text style={[styles.typeDesc, { color: c.muted }]}>
            Erinnerungen werden bei der Speicherung vorbereitet; Versand folgt in einem späteren Sprint.
          </Text>
        </>
      ) : null}

      {step === 'followup' ? (
        <>
          <Text style={styles.label}>Nachverfolgung / Wiedervorlage</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={form.followUpNote}
            onChangeText={(followUpNote) => onChange({ followUpNote })}
            placeholder="Optional: Rückruf, Wiedervorlage oder Folgetermin"
            placeholderTextColor={c.muted}
            multiline
          />
        </>
      ) : null}

      {step === 'preview' ? (
        <CalendarEventPreviewStep form={form} template={template} moduleKey={moduleKey} />
      ) : null}
    </View>
  );
}
