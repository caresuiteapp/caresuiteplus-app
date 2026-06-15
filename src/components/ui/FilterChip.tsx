import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type FilterChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function FilterChip({ label, selected = false, onPress, style }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
        style,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

type FilterChipGroupProps<T extends string> = {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  style?: ViewStyle;
};

export function FilterChipGroup<T extends string>({
  options,
  value,
  onChange,
  style,
}: FilterChipGroupProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      {options.map((opt) => (
        <FilterChip
          key={opt.key}
          label={opt.label}
          selected={value === opt.key}
          onPress={() => onChange(opt.key)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.capsule,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgSurface,
  },
  chipSelected: {
    borderColor: colors.orange,
    backgroundColor: 'rgba(255,149,0,0.14)',
  },
  chipPressed: {
    opacity: 0.85,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.orange,
  },
});
