import { Pressable, ScrollView, Text, View, type ViewStyle } from 'react-native';
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
  /** Selected option key (preferred). */
  value?: T;
  /** Alias for `value` (recovery / SegmentedTabs-style callers). */
  selectedKey?: T;
  /** Called when the user picks a chip (preferred). */
  onChange?: (key: T) => void;
  /** Alias for `onChange`. */
  onSelect?: (key: T) => void;
  style?: ViewStyle;
  /** Stack chips onto multiple lines instead of a horizontal scroll row. */
  wrap?: boolean;
};

export function FilterChipGroup<T extends string>({
  options,
  value,
  selectedKey,
  onChange,
  onSelect,
  style,
  wrap = false,
}: FilterChipGroupProps<T>) {
  const styles = useAuroraGlassChipStyles();
  const selected = value ?? selectedKey;
  const handleChange = onChange ?? onSelect;

  const chips = options.map((opt) => (
    <FilterChip
      key={opt.key}
      label={opt.label}
      selected={selected === opt.key}
      onPress={handleChange ? () => handleChange(opt.key) : undefined}
    />
  ));

  if (wrap) {
    return <View style={[styles.row, { flexWrap: 'wrap' }, style]}>{chips}</View>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      {chips}
    </ScrollView>
  );
}
