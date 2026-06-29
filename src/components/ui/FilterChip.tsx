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

type FilterChipOption<T extends string> = { label: string; key?: T; value?: T };

type FilterChipGroupProps<T extends string> = {
  options: FilterChipOption<T>[];
  /** Selected option key (single-select) or keys (multi-select). */
  value?: T | T[];
  /** Alias for `value` (single-select). */
  selectedKey?: T;
  /** Called when the user picks a chip (single) or toggles chips (multi). */
  onChange?: (key: T | T[]) => void;
  /** Alias for `onChange` (single-select). */
  onSelect?: (key: T) => void;
  style?: ViewStyle;
  /** Stack chips onto multiple lines instead of a horizontal scroll row. */
  wrap?: boolean;
  /** Allow multiple chips to be selected at once (toggle on tap). */
  multiple?: boolean;
  /** Minimum selections when `multiple` is true (default 1). */
  minSelected?: number;
};

function resolveFilterChipKey<T extends string>(opt: FilterChipOption<T>, index: number): T {
  const key = opt.key ?? opt.value;
  if (key == null) {
    throw new Error(`FilterChipGroup option at index ${index} requires key or value`);
  }
  return key;
}

export function FilterChipGroup<T extends string>({
  options,
  value,
  selectedKey,
  onChange,
  onSelect,
  style,
  wrap = false,
  multiple = false,
  minSelected = 1,
}: FilterChipGroupProps<T>) {
  const styles = useAuroraGlassChipStyles();
  const selected = value ?? selectedKey;
  const handleChange = onChange ?? onSelect;

  const chips = options.map((opt, index) => {
    const optKey = resolveFilterChipKey(opt, index);
    const isSelected = multiple
      ? Array.isArray(selected) && selected.includes(optKey)
      : selected === optKey;

    return (
      <FilterChip
        key={optKey}
        label={opt.label}
        selected={isSelected}
        onPress={
          handleChange
            ? () => {
                if (multiple) {
                  const current = Array.isArray(selected) ? selected : [];
                  const has = current.includes(optKey);
                  if (has && current.length <= minSelected) return;
                  const next = has
                    ? current.filter((key) => key !== optKey)
                    : [...current, optKey];
                  onChange?.(next);
                  return;
                }
                if (onChange) {
                  onChange(optKey);
                  return;
                }
                onSelect?.(optKey);
              }
            : undefined
        }
      />
    );
  });

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
