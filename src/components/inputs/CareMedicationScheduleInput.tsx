import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSystemCatalog } from '@/hooks/useSystemCatalog';
import { formatIntakeSchemaShort } from '@/lib/formatters/unitFormatters';
import { colors, spacing, typography } from '@/theme';

type Schedule = { morning: number; noon: number; evening: number; night: number };

type Props = {
  label?: string;
  value: Schedule;
  onChange: (value: Schedule) => void;
  schemaKey?: string;
  onSchemaKeyChange?: (key: string) => void;
};

const DEFAULT: Schedule = { morning: 0, noon: 0, evening: 0, night: 0 };

export function CareMedicationScheduleInput({
  label,
  value = DEFAULT,
  onChange,
  schemaKey,
  onSchemaKeyChange,
}: Props) {
  const { options } = useSystemCatalog('intake_schedule');

  const applySchema = (key: string) => {
    const parts = key.split('-').map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      onChange({ morning: parts[0], noon: parts[1], evening: parts[2], night: parts[3] });
      onSchemaKeyChange?.(key);
    } else if (key === 'bedarf' || key === 'individuell') {
      onSchemaKeyChange?.(key);
    }
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Text style={styles.schema}>
        Schema: {formatIntakeSchemaShort(value.morning, value.noon, value.evening, value.night)}
      </Text>
      <View style={styles.row}>
        {(['morgens', 'mittags', 'abends', 'nachts'] as const).map((slot, i) => {
          const keys = ['morning', 'noon', 'evening', 'night'] as const;
          const k = keys[i];
          return (
            <View key={slot} style={styles.slot}>
              <Text style={styles.slotLabel}>{slot}</Text>
              <Pressable
                style={styles.counter}
                onPress={() => onChange({ ...value, [k]: Math.max(0, value[k] - 1) })}
              >
                <Text>−</Text>
              </Pressable>
              <Text style={styles.count}>{value[k]}</Text>
              <Pressable
                style={styles.counter}
                onPress={() => onChange({ ...value, [k]: value[k] + 1 })}
              >
                <Text>+</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={styles.grid}>
        {options.slice(0, 8).map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.chip, schemaKey === opt.value && styles.chipSelected]}
            onPress={() => applySchema(opt.value)}
          >
            <Text style={styles.chipText}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.label, marginBottom: spacing.xs },
  schema: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  slot: { alignItems: 'center', flex: 1 },
  slotLabel: { ...typography.caption, marginBottom: spacing.xs },
  counter: {
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  count: { ...typography.body, marginVertical: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipSelected: { borderColor: colors.orange, backgroundColor: colors.borderOrange },
  chipText: { ...typography.caption },
});
