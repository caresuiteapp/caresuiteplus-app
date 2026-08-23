import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import type { CalendarEventTemplate, CalendarModuleKey } from '@/types/calendar';
import type { CalendarEventFormState, CalendarFormStep } from '@/types/calendar/calendarEventForm';
import { CALENDAR_FORM_STEP_LABELS } from '@/types/calendar/calendarEventForm';
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
  onChooseCalendarEntry?: () => void;
  onAssistEinsatzLink?: () => void;
};

const INK = '#0B1F3A';
const MUTED = '#526987';
const BORDER = '#B7D7FA';
const SURFACE = '#FFFFFF';
const SOFT = '#EDF6FF';
const BLUE = '#0878F9';

export function CalendarEventForm({
  step,
  moduleKey,
  form,
  template,
  accentColor = BLUE,
  onChange,
  onSelectTemplate,
  onContinueWithoutTemplate,
  onChooseCalendarEntry,
  onAssistEinsatzLink,
}: CalendarEventFormProps) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const styles = useMemo(() => StyleSheet.create({
    wrap: { gap: 16 },
    stepHeader: { gap: 4, marginBottom: 2 },
    stepHint: { color: BLUE, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
    stepTitle: { color: INK, fontSize: 22, fontWeight: '900' },
    stepDescription: { color: MUTED, fontSize: 14, lineHeight: 20 },
    grid: { flexDirection: compact ? 'column' : 'row', flexWrap: 'wrap', gap: 14 },
    field: { flexGrow: 1, flexBasis: compact ? '100%' : '46%', gap: 6 },
    fieldFull: { flexBasis: '100%' },
    label: { color: INK, fontSize: 13, fontWeight: '800' },
    helper: { color: MUTED, fontSize: 11, lineHeight: 16 },
    input: {
      color: INK,
      fontSize: 15,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: 14,
      paddingHorizontal: 15,
      paddingVertical: 13,
      backgroundColor: SURFACE,
      minHeight: 48,
    },
    multiline: { minHeight: 88, textAlignVertical: 'top' },
    divider: { height: 1, backgroundColor: '#DCEBFA', marginVertical: 2 },
    switchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: 14,
      backgroundColor: SURFACE,
    },
    switchCopy: { flex: 1, gap: 2 },
    switchTitle: { color: INK, fontSize: 14, fontWeight: '800' },
    switchDescription: { color: MUTED, fontSize: 12, lineHeight: 17 },
    typeGrid: { flexDirection: compact ? 'column' : 'row', gap: 14 },
    typeCard: {
      flex: 1,
      minHeight: 154,
      padding: 20,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: SURFACE,
      gap: 9,
      justifyContent: 'space-between',
    },
    typeCardPrimary: { borderColor: BLUE, backgroundColor: SOFT },
    typeIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#DCEEFF',
    },
    typeIconText: { color: BLUE, fontSize: 20, fontWeight: '900' },
    typeTitle: { color: INK, fontSize: 18, fontWeight: '900' },
    typeDesc: { color: MUTED, fontSize: 13, lineHeight: 19 },
    typeAction: { color: BLUE, fontSize: 13, fontWeight: '900' },
    sectionCard: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: SOFT,
      gap: 12,
    },
    sectionTitle: { color: INK, fontSize: 15, fontWeight: '900' },
  }), [compact]);

  const StepHeader = ({ title, description }: { title: string; description: string }) => (
    <View style={styles.stepHeader}>
      <Text style={styles.stepHint}>{CALENDAR_FORM_STEP_LABELS[step].toUpperCase()}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDescription}>{description}</Text>
    </View>
  );

  const Field = ({ label, value, onChangeText, placeholder, full = false, multiline = false, keyboardType, helper }: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
    full?: boolean;
    multiline?: boolean;
    keyboardType?: 'default' | 'numeric';
    helper?: string;
  }) => (
    <View style={[styles.field, full && styles.fieldFull]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7B8EA8"
        multiline={multiline}
        keyboardType={keyboardType}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );

  const VisibilitySwitch = ({ title, description, value, onValueChange }: {
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={styles.switchCard}>
      <View style={styles.switchCopy}>
        <Text style={styles.switchTitle}>{title}</Text>
        <Text style={styles.switchDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#C8D8EA', true: '#77BAFF' }}
        thumbColor={value ? BLUE : '#FFFFFF'}
      />
    </View>
  );

  if (step === 'type' && moduleKey === 'assist') {
    return (
      <View style={styles.wrap}>
        <StepHeader
          title="Was möchten Sie planen?"
          description="Wählen Sie den passenden Ablauf. Ihre Auswahl öffnet direkt den nächsten sinnvollen Schritt."
        />
        <View style={styles.typeGrid}>
          <Pressable
            onPress={onChooseCalendarEntry}
            style={({ pressed }) => [styles.typeCard, styles.typeCardPrimary, pressed && { opacity: 0.82 }]}
            accessibilityRole="button"
          >
            <View style={styles.typeIcon}><Text style={styles.typeIconText}>+</Text></View>
            <View style={{ gap: 5 }}>
              <Text style={styles.typeTitle}>Termin oder Abwesenheit</Text>
              <Text style={styles.typeDesc}>Besprechung, Geburtstag, Urlaub, Erinnerung oder eigener Kalendereintrag.</Text>
            </View>
            <Text style={styles.typeAction}>Kalendereintrag anlegen →</Text>
          </Pressable>
          <Pressable
            onPress={onAssistEinsatzLink}
            style={({ pressed }) => [styles.typeCard, pressed && { opacity: 0.82 }]}
            accessibilityRole="button"
          >
            <View style={styles.typeIcon}><Text style={styles.typeIconText}>↗</Text></View>
            <View style={{ gap: 5 }}>
              <Text style={styles.typeTitle}>Assist-Einsatz</Text>
              <Text style={styles.typeDesc}>Klient:in, Mitarbeitende, Leistung, Zeit und Aufgaben vollständig zuordnen.</Text>
            </View>
            <Text style={styles.typeAction}>Einsatz-Wizard öffnen →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === 'template') {
    return (
      <View style={styles.wrap}>
        <StepHeader
          title="Schnell mit einer Vorlage starten"
          description="Eine Vorlage übernimmt Art und Dauer. Sie können jederzeit ohne Vorlage fortfahren."
        />
        <CalendarEventTemplatePicker
          moduleKey={moduleKey}
          selectedId={template?.id}
          accentColor={accentColor}
          onSelect={onSelectTemplate}
          onContinueWithoutTemplate={onContinueWithoutTemplate}
        />
      </View>
    );
  }

  if (step === 'basics') {
    return (
      <View style={styles.wrap}>
        <StepHeader title="Grunddaten und Zuordnung" description="Erfassen Sie Anlass und ordnen Sie den Eintrag bei Bedarf direkt zu." />
        <View style={styles.grid}>
          <Field label="Titel *" value={form.title} onChangeText={(title) => onChange({ title })} placeholder="z. B. Teamgespräch" full />
          <Field label="Beschreibung" value={form.description} onChangeText={(description) => onChange({ description })} placeholder="Was ist geplant?" multiline full />
          <Field label="Klient:in / Bewohner:in" value={form.relatedClientId} onChangeText={(relatedClientId) => onChange({ relatedClientId })} placeholder="Name oder ID" />
          <Field label="Mitarbeitende" value={form.relatedEmployeeId} onChangeText={(relatedEmployeeId) => onChange({ relatedEmployeeId })} placeholder="Name oder ID" />
          <Field label="Fall / Akte" value={form.relatedCaseId} onChangeText={(relatedCaseId) => onChange({ relatedCaseId })} placeholder="Fall-ID" />
          <Field label="Wohnbereich" value={form.relatedWardId} onChangeText={(relatedWardId) => onChange({ relatedWardId })} placeholder="Wohnbereich" />
          <Field label="Weitere Beteiligte" value={form.participantNote} onChangeText={(participantNote) => onChange({ participantNote })} placeholder="Namen oder Hinweis" full />
        </View>
      </View>
    );
  }

  if (step === 'datetime') {
    return (
      <View style={styles.wrap}>
        <StepHeader title="Zeit und Ort" description="Legen Sie den vollständigen Zeitraum und den Treffpunkt fest." />
        <View style={styles.grid}>
          <Field label="Beginn" value={form.startAt} onChangeText={(startAt) => onChange({ startAt })} placeholder="Datum und Uhrzeit" helper="ISO-Zeit wird automatisch gespeichert." />
          <Field label="Ende" value={form.endAt} onChangeText={(endAt) => onChange({ endAt })} placeholder="Datum und Uhrzeit" />
          <View style={[styles.field, styles.fieldFull]}>
            <VisibilitySwitch title="Ganztägiger Eintrag" description="Uhrzeiten im Kalender ausblenden." value={form.allDay} onValueChange={(allDay) => onChange({ allDay })} />
          </View>
          <Field label="Ort" value={form.locationName} onChangeText={(locationName) => onChange({ locationName })} placeholder="Einrichtung oder Treffpunkt" />
          <Field label="Raum" value={form.room} onChangeText={(room) => onChange({ room })} placeholder="Raum / Etage" />
          <Field label="Adresse" value={form.address} onChangeText={(address) => onChange({ address })} placeholder="Straße, PLZ Ort" full />
        </View>
      </View>
    );
  }

  if (step === 'visibility') {
    return (
      <View style={styles.wrap}>
        <StepHeader title="Sichtbarkeit und Hinweise" description="Bestimmen Sie bewusst, wo der Eintrag erscheint, und ergänzen Sie optionale Hinweise." />
        <View style={styles.grid}>
          <View style={styles.field}><VisibilitySwitch title="Assist-Kalender" description="In der zentralen Planung anzeigen." value={form.isOfficeVisible} onValueChange={(isOfficeVisible) => onChange({ isOfficeVisible })} /></View>
          <View style={styles.field}><VisibilitySwitch title="Modul-Kalender" description="Im zugehörigen Fachmodul anzeigen." value={form.isModuleVisible} onValueChange={(isModuleVisible) => onChange({ isModuleVisible })} /></View>
          <View style={styles.field}><VisibilitySwitch title="Klientenportal" description="Für zugeordnete Klient:innen sichtbar." value={form.isClientPortalVisible} onValueChange={(isClientPortalVisible) => onChange({ isClientPortalVisible })} /></View>
          <View style={styles.field}><VisibilitySwitch title="Mitarbeiterportal" description="Für zugeordnete Mitarbeitende sichtbar." value={form.isEmployeePortalVisible} onValueChange={(isEmployeePortalVisible) => onChange({ isEmployeePortalVisible })} /></View>
        </View>
        <View style={styles.divider} />
        <View style={styles.grid}>
          <Field label="Interne Notiz" value={form.internalNote} onChangeText={(internalNote) => onChange({ internalNote })} placeholder="Nur intern sichtbar" multiline />
          <Field label="Portal-Notiz" value={form.publicNote} onChangeText={(publicNote) => onChange({ publicNote })} placeholder="Für freigegebene Portale" multiline />
          <Field label="Erinnerung" value={form.reminderMinutes != null ? String(form.reminderMinutes) : ''} onChangeText={(value) => onChange({ reminderMinutes: value ? Number(value) : null })} placeholder="30" keyboardType="numeric" helper="Minuten vor Beginn" />
          <Field label="Wiedervorlage" value={form.followUpNote} onChangeText={(followUpNote) => onChange({ followUpNote })} placeholder="Optionaler Folgehinweis" />
        </View>
      </View>
    );
  }

  if (step === 'preview') {
    return (
      <View style={styles.wrap}>
        <StepHeader title="Prüfen und speichern" description="Kontrollieren Sie die wichtigsten Angaben vor dem Speichern." />
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Zusammenfassung</Text>
          <CalendarEventPreviewStep form={form} template={template} moduleKey={moduleKey} />
        </View>
      </View>
    );
  }

  return null;
}
