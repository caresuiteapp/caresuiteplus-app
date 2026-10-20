import { useEffect, useMemo, useRef, useState } from 'react';
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
import { CareEntitySelect, type CareEntityOption } from '@/components/inputs/CareEntitySelect';
import { CareDateInput } from '@/components/inputs/CareDateInput';
import { CareTimeInput } from '@/components/inputs/CareTimeInput';
import { berlinTimestamp } from '@/lib/calendar/employeeMonthPlanning';

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
  clients?: CareEntityOption[]; employees?: CareEntityOption[]; peopleLoading?: boolean; disabled?: boolean;
};

const INK = '#0B1F3A';
const MUTED = '#526987';
const BORDER = '#B7D7FA';
const SURFACE = '#FFFFFF';
const SOFT = '#EDF6FF';
const BLUE = '#0878F9';

function createFormStyles(compact: boolean) {
  return StyleSheet.create({
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
  });
}


function StepHeader({ title, description, styles, step }: { title: string; description: string; styles: ReturnType<typeof createFormStyles>; step: CalendarFormStep }) { return (
    <View style={styles.stepHeader}>
      <Text style={styles.stepHint}>{CALENDAR_FORM_STEP_LABELS[step].toUpperCase()}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDescription}>{description}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, full = false, multiline = false, keyboardType, helper, styles, disabled }: {
    styles: ReturnType<typeof createFormStyles>; disabled?: boolean;
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
    full?: boolean;
    multiline?: boolean;
    keyboardType?: 'default' | 'numeric';
    helper?: string;
  }) { return (
    <View style={[styles.field, full && styles.fieldFull]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        accessibilityLabel={label}
        editable={!disabled}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7B8EA8"
        multiline={multiline}
        keyboardType={keyboardType}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

function VisibilitySwitch({ title, description, value, onValueChange, styles, disabled }: {
    styles: ReturnType<typeof createFormStyles>; disabled?: boolean;
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) { return (
    <View style={styles.switchCard}>
      <View style={styles.switchCopy}>
        <Text style={styles.switchTitle}>{title}</Text>
        <Text style={styles.switchDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        accessibilityLabel={title}
        onValueChange={onValueChange}
        trackColor={{ false: '#C8D8EA', true: '#77BAFF' }}
        thumbColor={value ? BLUE : '#FFFFFF'}
      />
    </View>
  );
}


function dateTimeParts(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return { date: '', time: '' };
  return {
    date: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(parsed),
    time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(parsed),
  };
}

function CalendarDateTimeField({ value, label, onChange, styles, disabled }: { value: string; label: string; onChange: (value: string) => void; styles: ReturnType<typeof createFormStyles>; disabled?: boolean }) {
  const [parts, setParts] = useState(() => dateTimeParts(value));
  const [error, setError] = useState<string | undefined>();
  const emitted = useRef(value);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value; setParts(dateTimeParts(value)); setError(undefined);
  }, [value]);
  const change = (patch: Partial<typeof parts>) => {
    if (disabled) return;
    const next = { ...parts, ...patch }; setParts(next);
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(next.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(next.time)) throw new Error('Bitte Datum und Uhrzeit vollständig eingeben.');
      const timestamp = berlinTimestamp(next.date, next.time);
      emitted.current = timestamp; setError(undefined); onChange(timestamp);
    } catch (cause) {
      emitted.current = ''; onChange(''); setError(cause instanceof Error ? cause.message : 'Datum und Uhrzeit prüfen.');
    }
  };
  return <View style={styles.field}>
    <CareDateInput label={`${label}: Datum`} value={parts.date} onChange={(date) => change({ date })} viewContext="form" />
    <CareTimeInput label={`${label}: Uhrzeit`} value={parts.time} onChange={(time) => change({ time })} viewContext="form" onLightSurface error={error} />
  </View>;
}

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
  clients = [], employees = [], peopleLoading = false, disabled = false,
}: CalendarEventFormProps) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const styles = useMemo(() => createFormStyles(compact), [compact]);

  if (step === 'type' && moduleKey === 'assist') {
    return (
      <View style={styles.wrap}>
        <StepHeader styles={styles} step={step}
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
        <StepHeader styles={styles} step={step}
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
        <StepHeader styles={styles} step={step} title="Grunddaten und Zuordnung" description="Erfassen Sie Anlass und ordnen Sie den Eintrag bei Bedarf direkt zu." />
        <View style={styles.grid}>
          <Field styles={styles} disabled={disabled} label="Titel *" value={form.title} onChangeText={(title) => onChange({ title })} placeholder="z. B. Teamgespräch" full />
          <Field styles={styles} disabled={disabled} label="Beschreibung" value={form.description} onChangeText={(description) => onChange({ description })} placeholder="Was ist geplant?" multiline full />
          <View style={styles.field}><CareEntitySelect label="Klient:in / Bewohner:in" value={form.relatedClientId} options={[{ value: "", label: "Keine Zuordnung" }, ...clients]} loading={peopleLoading} onChange={(relatedClientId) => { if (!disabled) onChange({ relatedClientId }); }} /></View>
          <View style={styles.field}><CareEntitySelect label="Mitarbeitende" value={form.relatedEmployeeId} options={[{ value: "", label: "Keine Zuordnung" }, ...employees]} loading={peopleLoading} onChange={(relatedEmployeeId) => { if (!disabled) onChange({ relatedEmployeeId }); }} /></View>
          {moduleKey === "beratung" ? <Field styles={styles} disabled={disabled} label="Fall / Akte" value={form.relatedCaseId} onChangeText={(relatedCaseId) => onChange({ relatedCaseId })} placeholder="ID einer vorhandenen Akte" /> : null}
          {moduleKey === "stationaer" ? <Field styles={styles} disabled={disabled} label="Wohnbereich" value={form.relatedWardId} onChangeText={(relatedWardId) => onChange({ relatedWardId })} placeholder="ID eines vorhandenen Wohnbereichs" /> : null}
        </View>
      </View>
    );
  }

  if (step === 'datetime') {
    return (
      <View style={styles.wrap}>
        <StepHeader styles={styles} step={step} title="Zeit und Ort" description="Legen Sie den vollständigen Zeitraum und den Treffpunkt fest." />
        <View style={styles.grid}>
          <CalendarDateTimeField styles={styles} disabled={disabled} label="Beginn" value={form.startAt} onChange={(startAt) => onChange({ startAt })} />
          <CalendarDateTimeField styles={styles} disabled={disabled} label="Ende" value={form.endAt} onChange={(endAt) => onChange({ endAt })} />
          <View style={[styles.field, styles.fieldFull]}>
            <VisibilitySwitch styles={styles} disabled={disabled} title="Ganztägiger Eintrag" description="Uhrzeiten im Kalender ausblenden." value={form.allDay} onValueChange={(allDay) => onChange({ allDay })} />
          </View>
          <Field styles={styles} disabled={disabled} label="Ort" value={form.locationName} onChangeText={(locationName) => onChange({ locationName })} placeholder="Einrichtung oder Treffpunkt" />
          <Field styles={styles} disabled={disabled} label="Raum" value={form.room} onChangeText={(room) => onChange({ room })} placeholder="Raum / Etage" />
          <Field styles={styles} disabled={disabled} label="Adresse" value={form.address} onChangeText={(address) => onChange({ address })} placeholder="Straße, PLZ Ort" full />
        </View>
      </View>
    );
  }

  if (step === 'visibility') {
    return (
      <View style={styles.wrap}>
        <StepHeader styles={styles} step={step} title="Sichtbarkeit und Hinweise" description="Bestimmen Sie bewusst, wo der Eintrag erscheint, und ergänzen Sie optionale Hinweise." />
        <View style={styles.grid}>
          <View style={styles.field}><VisibilitySwitch styles={styles} disabled={disabled} title="Zentraler Kalender" description="In der zentralen Planung anzeigen." value={form.isOfficeVisible} onValueChange={(isOfficeVisible) => onChange({ isOfficeVisible })} /></View>
          <View style={styles.field}><VisibilitySwitch styles={styles} disabled={disabled} title="Modul-Kalender" description="Im zugehörigen Fachmodul anzeigen." value={form.isModuleVisible} onValueChange={(isModuleVisible) => onChange({ isModuleVisible })} /></View>
          <View style={styles.field}><VisibilitySwitch styles={styles} disabled={disabled} title="Klientenportal" description="Für zugeordnete Klient:innen sichtbar." value={form.isClientPortalVisible} onValueChange={(isClientPortalVisible) => onChange({ isClientPortalVisible })} /></View>
          <View style={styles.field}><VisibilitySwitch styles={styles} disabled={disabled} title="Mitarbeiterportal" description="Für zugeordnete Mitarbeitende sichtbar." value={form.isEmployeePortalVisible} onValueChange={(isEmployeePortalVisible) => onChange({ isEmployeePortalVisible })} /></View>
        </View>
        <View style={styles.divider} />
        <View style={styles.grid}>
          <Field styles={styles} disabled={disabled} label="Interne Notiz" value={form.internalNote} onChangeText={(internalNote) => onChange({ internalNote })} placeholder="Nur intern sichtbar" multiline />
          <Field styles={styles} disabled={disabled} label="Portal-Notiz" value={form.publicNote} onChangeText={(publicNote) => onChange({ publicNote })} placeholder="Für freigegebene Portale" multiline />
        </View>
      </View>
    );
  }

  if (step === 'preview') {
    return (
      <View style={styles.wrap}>
        <StepHeader styles={styles} step={step} title="Prüfen und speichern" description="Kontrollieren Sie die wichtigsten Angaben vor dem Speichern." />
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Zusammenfassung</Text>
          <CalendarEventPreviewStep form={form} template={template} moduleKey={moduleKey}
            clientLabel={clients.find(person => person.value === form.relatedClientId)?.label}
            employeeLabel={employees.find(person => person.value === form.relatedEmployeeId)?.label} />
        </View>
      </View>
    );
  }

  return null;
}
