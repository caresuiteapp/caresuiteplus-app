import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import type {
  CalendarEventType,
  CalendarViewMode,
  TenantCalendarSettingsForm,
  WeekStartDay,
} from '@/types/modules/calendarEvent';
import { buildDefaultTenantCalendarSettings } from '@/types/modules/calendarEvent';
import { OfficeCalendarLegend } from './OfficeCalendarLegend';

type OfficeCalendarSettingsModalProps = {
  visible: boolean;
  initial: TenantCalendarSettingsForm | null;
  saving: boolean;
  onClose: () => void;
  onSave: (form: TenantCalendarSettingsForm) => void;
};

const VIEW_OPTIONS: { key: CalendarViewMode; label: string; description: string }[] = [
  { key: 'day', label: 'Tag', description: 'Stundenplan eines Tages' },
  { key: 'week', label: 'Woche', description: 'Teamübersicht für sieben Tage' },
  { key: 'month', label: 'Monat', description: 'Planung und Auslastung im Überblick' },
  { key: 'year', label: 'Jahr', description: 'Langfristige Orientierung' },
];

function ChoiceCard({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.choiceIndicator, selected && styles.choiceIndicatorSelected]}>
        {selected ? <Text style={styles.choiceCheck}>✓</Text> : null}
      </View>
      <Text style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}>{title}</Text>
      {description ? <Text style={styles.choiceDescription}>{description}</Text> : null}
    </Pressable>
  );
}

function NumberStepper({
  label,
  description,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <View style={styles.stepperCopy}>
        <Text style={styles.fieldTitle}>{label}</Text>
        <Text style={styles.fieldDescription}>{description}</Text>
      </View>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={({ pressed }) => [styles.stepperButton, value <= min && styles.disabled, pressed && styles.pressed]}
        ><Text style={styles.stepperButtonText}>−</Text></Pressable>
        <View style={styles.stepperValueWrap}>
          <Text style={styles.stepperValue}>{value}</Text>
          {suffix ? <Text style={styles.stepperSuffix}>{suffix}</Text> : null}
        </View>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={({ pressed }) => [styles.stepperButton, value >= max && styles.disabled, pressed && styles.pressed]}
        ><Text style={styles.stepperButtonText}>＋</Text></Pressable>
      </View>
    </View>
  );
}

export function OfficeCalendarSettingsModal({
  visible,
  initial,
  saving,
  onClose,
  onSave,
}: OfficeCalendarSettingsModalProps) {
  const { width } = useWindowDimensions();
  const compact = width < 860;
  const defaults = useMemo(() => buildDefaultTenantCalendarSettings('local'), []);
  const defaultForm = useMemo<TenantCalendarSettingsForm>(() => ({
    defaultView: defaults.defaultView,
    weekStartDay: defaults.weekStartDay,
    dayViewStartHour: defaults.dayViewStartHour,
    weekFullDay: defaults.weekFullDay,
    maxCollapsedEvents: defaults.maxCollapsedEvents,
    visibleTypes: { ...defaults.visibleTypes },
  }), [defaults]);
  const [form, setForm] = useState<TenantCalendarSettingsForm>(initial ?? defaultForm);

  useEffect(() => {
    if (visible) setForm(initial ?? defaultForm);
  }, [defaultForm, initial, visible]);

  const toggleType = (type: CalendarEventType) => {
    setForm((prev) => ({
      ...prev,
      visibleTypes: { ...prev.visibleTypes, [type]: !prev.visibleTypes[type] },
    }));
  };

  return (
    <PlatformModal
      visible={visible}
      onClose={onClose}
      title="Kalender konfigurieren"
      subtitle="Ansicht, Arbeitszeitraum und sichtbare Ereignisse für den Mandanten festlegen"
      maxWidth={980}
      minWidth={320}
      maxHeightRatio={0.92}
      glowColor="#41CFFF"
      surfaceScope="personal"
      bodyStyle={styles.modalBody}
      footerActions={[
        { title: 'Standards wiederherstellen', variant: 'secondary', onPress: () => setForm(defaultForm) },
        { title: 'Abbrechen', variant: 'secondary', onPress: onClose },
        { title: 'Einstellungen speichern', loading: saving, onPress: () => onSave(form) },
      ]}
    >
      <View style={styles.intro}>
        <View style={styles.introIcon}><Text style={styles.introIconText}>⚙</Text></View>
        <View style={styles.introCopy}>
          <Text style={styles.introTitle}>Persönliche Kalenderdarstellung</Text>
          <Text style={styles.introText}>Die Einstellungen ändern die Darstellung, nicht die gespeicherten Termine oder Einsätze.</Text>
        </View>
      </View>

      <View style={[styles.sectionGrid, compact && styles.sectionGridCompact]}>
        <View style={[styles.sectionCard, styles.sectionCardWide]}>
          <Text style={styles.sectionEyebrow}>01 · STARTANSICHT</Text>
          <Text style={styles.sectionTitle}>Welche Ansicht soll zuerst geöffnet werden?</Text>
          <View style={[styles.choiceGrid, compact && styles.choiceGridCompact]}>
            {VIEW_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.key}
                title={option.label}
                description={option.description}
                selected={form.defaultView === option.key}
                onPress={() => setForm((prev) => ({ ...prev, defaultView: option.key }))}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>02 · WOCHENLOGIK</Text>
          <Text style={styles.sectionTitle}>Wochenstart</Text>
          <View style={styles.weekChoices}>
            <ChoiceCard
              title="Montag"
              description="Deutscher Geschäftsstandard"
              selected={form.weekStartDay === 1}
              onPress={() => setForm((prev) => ({ ...prev, weekStartDay: 1 as WeekStartDay }))}
            />
            <ChoiceCard
              title="Sonntag"
              description="Internationale Darstellung"
              selected={form.weekStartDay === 0}
              onPress={() => setForm((prev) => ({ ...prev, weekStartDay: 0 as WeekStartDay }))}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.stepperCopy}>
              <Text style={styles.fieldTitle}>Wochenansicht 24/7</Text>
              <Text style={styles.fieldDescription}>Auch Nachtstunden vollständig anzeigen</Text>
            </View>
            <Switch
              value={form.weekFullDay}
              onValueChange={(weekFullDay) => setForm((prev) => ({ ...prev, weekFullDay }))}
              trackColor={{ false: '#B6C7D7', true: '#24A8E8' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>03 · DICHTE</Text>
          <Text style={styles.sectionTitle}>Zeit und Ereignismenge</Text>
          <NumberStepper
            label="Start der Tagesansicht"
            description="Erste sichtbare Stunde im Tageskalender"
            value={form.dayViewStartHour}
            min={0}
            max={23}
            suffix="Uhr"
            onChange={(dayViewStartHour) => setForm((prev) => ({ ...prev, dayViewStartHour }))}
          />
          <NumberStepper
            label="Ereignisse pro Tag"
            description="Anzahl vor der Zusammenfassung „mehr“"
            value={form.maxCollapsedEvents}
            min={1}
            max={20}
            onChange={(maxCollapsedEvents) => setForm((prev) => ({ ...prev, maxCollapsedEvents }))}
          />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.legendHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>04 · EREIGNISFILTER</Text>
            <Text style={styles.sectionTitle}>Sichtbare Ereignistypen</Text>
          </View>
          <Text style={styles.legendHint}>Antippen zum Ein- oder Ausblenden</Text>
        </View>
        <OfficeCalendarLegend visibleTypes={form.visibleTypes} onToggleType={toggleType} />
      </View>
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  modalBody: { gap: 16, backgroundColor: '#F4F8FC' },
  intro: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C5E6F8',
    backgroundColor: '#EAF7FF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  introIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#0C7DDA', alignItems: 'center', justifyContent: 'center' },
  introIconText: { color: '#FFFFFF', fontSize: 22 },
  introCopy: { flex: 1, minWidth: 0 },
  introTitle: { color: '#0A2342', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  introText: { color: '#4E6880', fontSize: 12, lineHeight: 17, marginTop: 3 },
  sectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  sectionGridCompact: { flexDirection: 'column' },
  sectionCard: {
    flex: 1,
    minWidth: 310,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D3E2EF',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 13,
    shadowColor: '#0B416D',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  sectionCardWide: { flexBasis: '100%' },
  sectionEyebrow: { color: '#0877CC', fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 1.3 },
  sectionTitle: { color: '#0B223D', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  choiceGrid: { flexDirection: 'row', gap: 10 },
  choiceGridCompact: { flexWrap: 'wrap' },
  weekChoices: { gap: 9 },
  choice: {
    flex: 1,
    minWidth: 150,
    minHeight: 82,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D5E3EF',
    backgroundColor: '#F7FAFD',
    padding: 12,
    justifyContent: 'center',
  },
  choiceSelected: { borderColor: '#168FE4', backgroundColor: '#E9F6FF' },
  choiceIndicator: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#B9CDDC', alignItems: 'center', justifyContent: 'center' },
  choiceIndicatorSelected: { borderColor: '#168FE4', backgroundColor: '#168FE4' },
  choiceCheck: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  choiceTitle: { color: '#193650', fontSize: 14, fontWeight: '900', paddingRight: 26 },
  choiceTitleSelected: { color: '#0669B5' },
  choiceDescription: { color: '#607990', fontSize: 10, lineHeight: 14, marginTop: 5, paddingRight: 10 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  switchRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E4EDF4' },
  stepperRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E4EDF4' },
  stepperCopy: { flex: 1, minWidth: 0 },
  fieldTitle: { color: '#18344E', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  fieldDescription: { color: '#637D93', fontSize: 10, lineHeight: 14, marginTop: 3 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#C6DAE9', backgroundColor: '#F7FAFD', overflow: 'hidden' },
  stepperButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F5FD' },
  stepperButtonText: { color: '#0877CC', fontSize: 21, lineHeight: 23, fontWeight: '900' },
  stepperValueWrap: { minWidth: 70, height: 40, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { color: '#0B223D', fontSize: 16, lineHeight: 18, fontWeight: '900' },
  stepperSuffix: { color: '#607990', fontSize: 8, lineHeight: 10, marginTop: 1 },
  disabled: { opacity: 0.35 },
  legendHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  legendHint: { color: '#607990', fontSize: 10, fontWeight: '700' },
});
