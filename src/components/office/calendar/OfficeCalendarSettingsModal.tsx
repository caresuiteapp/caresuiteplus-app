import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { PremiumButton } from '@/components/ui';
import type {
  CalendarEventType,
  CalendarViewMode,
  TenantCalendarSettingsForm,
  WeekStartDay,
} from '@/types/modules/calendarEvent';
import {
  buildDefaultTenantCalendarSettings,
  CALENDAR_EVENT_TYPE_LABELS,
} from '@/types/modules/calendarEvent';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { OfficeCalendarLegend } from './OfficeCalendarLegend';

type OfficeCalendarSettingsModalProps = {
  visible: boolean;
  initial: TenantCalendarSettingsForm | null;
  saving: boolean;
  onClose: () => void;
  onSave: (form: TenantCalendarSettingsForm) => void;
};

const VIEW_OPTIONS: { key: CalendarViewMode; label: string }[] = [
  { key: 'day', label: 'Tag' },
  { key: 'week', label: 'Woche' },
  { key: 'month', label: 'Monat' },
  { key: 'year', label: 'Jahr' },
];

export function OfficeCalendarSettingsModal({
  visible,
  initial,
  saving,
  onClose,
  onSave,
}: OfficeCalendarSettingsModalProps) {
  const text = useAuroraAdaptiveText();
  const defaults = buildDefaultTenantCalendarSettings('local');
  const [form, setForm] = useState<TenantCalendarSettingsForm>(
    initial ?? {
      defaultView: defaults.defaultView,
      weekStartDay: defaults.weekStartDay,
      dayViewStartHour: defaults.dayViewStartHour,
      weekFullDay: defaults.weekFullDay,
      maxCollapsedEvents: defaults.maxCollapsedEvents,
      visibleTypes: { ...defaults.visibleTypes },
    },
  );

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial, visible]);

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
      title="Mandant Kalender Einstellungen"
      bodyStyle={styles.modalBody}
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, text.primary]}>Standardansicht</Text>
        <View style={styles.rowWrap}>
          {VIEW_OPTIONS.map((opt) => (
            <PremiumButton
              key={opt.key}
              title={opt.label}
              variant={form.defaultView === opt.key ? 'primary' : 'secondary'}
              onPress={() => setForm((prev) => ({ ...prev, defaultView: opt.key }))}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, text.primary]}>Wochenstart</Text>
        <View style={styles.rowWrap}>
          <PremiumButton
            title="Montag"
            variant={form.weekStartDay === 1 ? 'primary' : 'secondary'}
            onPress={() => setForm((prev) => ({ ...prev, weekStartDay: 1 as WeekStartDay }))}
          />
          <PremiumButton
            title="Sonntag"
            variant={form.weekStartDay === 0 ? 'primary' : 'secondary'}
            onPress={() => setForm((prev) => ({ ...prev, weekStartDay: 0 as WeekStartDay }))}
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, text.secondary]}>Tagesansicht Start (Stunde)</Text>
        <TextInput
          value={String(form.dayViewStartHour)}
          onChangeText={(v) => {
            const n = Number.parseInt(v, 10);
            if (!Number.isNaN(n)) {
              setForm((prev) => ({ ...prev, dayViewStartHour: Math.min(23, Math.max(0, n)) }));
            }
          }}
          keyboardType="number-pad"
          style={[styles.input, text.primary]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, text.secondary]}>Max. eingeklappte Ereignisse pro Tag</Text>
        <TextInput
          value={String(form.maxCollapsedEvents)}
          onChangeText={(v) => {
            const n = Number.parseInt(v, 10);
            if (!Number.isNaN(n)) {
              setForm((prev) => ({ ...prev, maxCollapsedEvents: Math.min(20, Math.max(1, n)) }));
            }
          }}
          keyboardType="number-pad"
          style={[styles.input, text.primary]}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={[styles.label, text.secondary]}>Wochenansicht 24/7</Text>
        <Switch
          value={form.weekFullDay}
          onValueChange={(weekFullDay) => setForm((prev) => ({ ...prev, weekFullDay }))}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, text.primary]}>Ereignistypen</Text>
        <OfficeCalendarLegend visibleTypes={form.visibleTypes} onToggleType={toggleType} />
        <Text style={[styles.hint, text.muted]}>
          Typen antippen zum Ein-/Ausblenden. Labels:{' '}
          {Object.values(CALENDAR_EVENT_TYPE_LABELS).join(', ')}
        </Text>
      </View>

      <View style={styles.actions}>
        <PremiumButton title="Abbrechen" variant="secondary" onPress={onClose} />
        <PremiumButton title="Speichern" onPress={() => onSave(form)} loading={saving} />
      </View>
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  modalBody: { gap: careSpacing.md },
  section: { gap: careSpacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
  field: { gap: 4 },
  label: { fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.input,
    borderRadius: careRadius.md,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: careSpacing.xs,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hint: { fontSize: 11, marginTop: careSpacing.xs },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: careSpacing.sm,
    marginTop: careSpacing.sm,
  },
});
