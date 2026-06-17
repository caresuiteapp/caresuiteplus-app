import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ErrorState,
  FilterChip,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  fetchClientSchedulingWishes,
  saveClientSchedulingWishes,
} from '@/lib/clients/clientSchedulingWishesService';
import type {
  ClientSchedulingWishesInput,
  PreferredEmployeeGender,
  PreferredTimeSlot,
  PreferredWeekday,
} from '@/types/modules/client';
import {
  PREFERRED_EMPLOYEE_GENDER_LABELS,
  PREFERRED_TIME_SLOT_LABELS,
  PREFERRED_WEEKDAY_LABELS,
  PREFERRED_WEEKDAY_ORDER,
} from '@/types/modules/client';
import { colors, spacing, typography } from '@/theme';

type ClientSchedulingWishesPanelProps = {
  clientId: string;
  onRecordRefresh?: () => void;
};

type WishesFormState = ClientSchedulingWishesInput;

const EMPTY_WISHES: WishesFormState = {
  preferredDays: [],
  preferredTimeSlots: [],
  timeFrom: null,
  timeTo: null,
  preferredEmployeeGender: null,
  hoursPerAssignment: null,
  assignmentsPerWeek: null,
  assignmentsPerMonth: null,
};

const TIME_SLOT_OPTIONS = (Object.keys(PREFERRED_TIME_SLOT_LABELS) as PreferredTimeSlot[]).map((key) => ({
  key,
  label: PREFERRED_TIME_SLOT_LABELS[key],
}));

const GENDER_OPTIONS = (Object.keys(PREFERRED_EMPLOYEE_GENDER_LABELS) as PreferredEmployeeGender[]).map((key) => ({
  key,
  label: PREFERRED_EMPLOYEE_GENDER_LABELS[key],
}));

function toFormState(
  wishes: ClientSchedulingWishesInput | null | undefined,
): WishesFormState {
  if (!wishes) return { ...EMPTY_WISHES };
  return {
    preferredDays: [...wishes.preferredDays],
    preferredTimeSlots: [...wishes.preferredTimeSlots],
    timeFrom: wishes.timeFrom,
    timeTo: wishes.timeTo,
    preferredEmployeeGender: wishes.preferredEmployeeGender,
    hoursPerAssignment: wishes.hoursPerAssignment,
    assignmentsPerWeek: wishes.assignmentsPerWeek,
    assignmentsPerMonth: wishes.assignmentsPerMonth,
  };
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalHours(value: string): number | null {
  const trimmed = value.replace(',', '.').trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatWishesSummary(form: WishesFormState): string | null {
  const parts: string[] = [];
  if (form.preferredDays.length > 0) {
    parts.push(form.preferredDays.map((day) => PREFERRED_WEEKDAY_LABELS[day]).join(', '));
  }
  if (form.preferredTimeSlots.length > 0) {
    parts.push(form.preferredTimeSlots.map((slot) => PREFERRED_TIME_SLOT_LABELS[slot]).join(', '));
  }
  if (form.timeFrom || form.timeTo) {
    parts.push(`${form.timeFrom ?? '—'} – ${form.timeTo ?? '—'}`);
  }
  if (form.preferredEmployeeGender) {
    parts.push(PREFERRED_EMPLOYEE_GENDER_LABELS[form.preferredEmployeeGender]);
  }
  if (form.hoursPerAssignment != null) {
    parts.push(`${form.hoursPerAssignment} Std./Einsatz`);
  }
  if (form.assignmentsPerWeek != null) {
    parts.push(`${form.assignmentsPerWeek}×/Woche`);
  }
  if (form.assignmentsPerMonth != null) {
    parts.push(`${form.assignmentsPerMonth}×/Monat`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function ClientSchedulingWishesPanel({
  clientId,
  onRecordRefresh,
}: ClientSchedulingWishesPanelProps) {
  const { isReadOnly } = usePermissions();
  const tenantId = useServiceTenantId();
  const [form, setForm] = useState<WishesFormState>(EMPTY_WISHES);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientSchedulingWishes(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: Boolean(tenantId && clientId) },
  );

  useEffect(() => {
    setForm(toFormState(query.data));
    setSaveError(null);
    setSavedMessage(null);
  }, [query.data, clientId]);

  const summary = useMemo(() => formatWishesSummary(form), [form]);

  const toggleDay = useCallback((day: PreferredWeekday) => {
    setForm((current) => {
      const selected = current.preferredDays.includes(day);
      return {
        ...current,
        preferredDays: selected
          ? current.preferredDays.filter((value) => value !== day)
          : [...current.preferredDays, day],
      };
    });
    setSavedMessage(null);
  }, []);

  const toggleTimeSlot = useCallback((slot: PreferredTimeSlot) => {
    setForm((current) => {
      const selected = current.preferredTimeSlots.includes(slot);
      return {
        ...current,
        preferredTimeSlots: selected
          ? current.preferredTimeSlots.filter((value) => value !== slot)
          : [...current.preferredTimeSlots, slot],
      };
    });
    setSavedMessage(null);
  }, []);

  async function handleSave() {
    if (!tenantId || isReadOnly) return;
    setSaving(true);
    setSaveError(null);
    setSavedMessage(null);

    const result = await saveClientSchedulingWishes(tenantId, clientId, form);
    setSaving(false);

    if (!result.ok) {
      setSaveError(result.error);
      return;
    }

    setForm(toFormState(result.data));
    setSavedMessage('Wünsche gespeichert.');
    await query.refresh();
    onRecordRefresh?.();
  }

  if (query.loading && query.data === undefined) {
    return <LoadingState message="Wünsche werden geladen…" />;
  }

  if (query.error && query.data === undefined) {
    return <ErrorState message={query.error} onRetry={query.refresh} />;
  }

  return (
    <SectionPanel
      title="Wünsche"
      subtitle={summary ?? 'Termin- und Einsatzpräferenzen für die Planung'}
    >
      <Text style={styles.hint}>
        Allgemeine Planungswünsche — getrennt von einzelnen Assist-Aufgaben.
      </Text>

      <Text style={styles.fieldLabel}>Wunschtage</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {PREFERRED_WEEKDAY_ORDER.map((day) => (
          <FilterChip
            key={day}
            label={PREFERRED_WEEKDAY_LABELS[day]}
            selected={form.preferredDays.includes(day)}
            onPress={() => !isReadOnly && toggleDay(day)}
          />
        ))}
      </ScrollView>

      <Text style={styles.fieldLabel}>Wunschzeiten</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {TIME_SLOT_OPTIONS.map((option) => (
          <FilterChip
            key={option.key}
            label={option.label}
            selected={form.preferredTimeSlots.includes(option.key)}
            onPress={() => !isReadOnly && toggleTimeSlot(option.key)}
          />
        ))}
      </ScrollView>

      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <PremiumInput
            label="Von (optional)"
            value={form.timeFrom ?? ''}
            onChangeText={(value) => {
              setForm((current) => ({ ...current, timeFrom: value || null }));
              setSavedMessage(null);
            }}
            placeholder="08:00"
            editable={!isReadOnly}
          />
        </View>
        <View style={styles.timeField}>
          <PremiumInput
            label="Bis (optional)"
            value={form.timeTo ?? ''}
            onChangeText={(value) => {
              setForm((current) => ({ ...current, timeTo: value || null }));
              setSavedMessage(null);
            }}
            placeholder="12:00"
            editable={!isReadOnly}
          />
        </View>
      </View>

      <Text style={styles.fieldLabel}>Wunsch-Mitarbeiter Geschlecht</Text>
      <FilterChipGroup
        options={GENDER_OPTIONS}
        value={form.preferredEmployeeGender ?? 'egal'}
        onChange={(value) => {
          if (isReadOnly) return;
          setForm((current) => ({ ...current, preferredEmployeeGender: value }));
          setSavedMessage(null);
        }}
      />

      <View style={styles.numericRow}>
        <View style={styles.numericField}>
          <PremiumInput
            label="Std. pro Einsatz"
            value={form.hoursPerAssignment != null ? String(form.hoursPerAssignment) : ''}
            onChangeText={(value) => {
              setForm((current) => ({ ...current, hoursPerAssignment: parseOptionalHours(value) }));
              setSavedMessage(null);
            }}
            keyboardType="decimal-pad"
            editable={!isReadOnly}
          />
        </View>
        <View style={styles.numericField}>
          <PremiumInput
            label="Einsätze / Woche"
            value={form.assignmentsPerWeek != null ? String(form.assignmentsPerWeek) : ''}
            onChangeText={(value) => {
              setForm((current) => ({ ...current, assignmentsPerWeek: parseOptionalInt(value) }));
              setSavedMessage(null);
            }}
            keyboardType="number-pad"
            editable={!isReadOnly}
          />
        </View>
        <View style={styles.numericField}>
          <PremiumInput
            label="Einsätze / Monat"
            value={form.assignmentsPerMonth != null ? String(form.assignmentsPerMonth) : ''}
            onChangeText={(value) => {
              setForm((current) => ({ ...current, assignmentsPerMonth: parseOptionalInt(value) }));
              setSavedMessage(null);
            }}
            keyboardType="number-pad"
            editable={!isReadOnly}
          />
        </View>
      </View>

      {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
      {savedMessage ? <Text style={styles.success}>{savedMessage}</Text> : null}

      {!isReadOnly ? (
        <PremiumButton
          title="Wünsche speichern"
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
        />
      ) : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  fieldLabel: { ...typography.label, marginBottom: spacing.xs, marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeField: { flex: 1 },
  numericRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  numericField: { flexGrow: 1, minWidth: 140, flexBasis: '30%' },
  saveButton: { marginTop: spacing.md },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
  success: { ...typography.caption, color: colors.success, marginTop: spacing.sm },
});
