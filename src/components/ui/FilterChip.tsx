import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useAuroraGlassChipStyles } from '@/design/tokens/auroraGlass';

type FilterChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function FilterChip({ label, selected = false, onPress, style }: FilterChipProps) {
  const styles = useAuroraGlassChipStyles();

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
  const styles = useAuroraGlassChipStyles();

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
