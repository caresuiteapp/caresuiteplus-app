import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

type FilterChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  onLightSurface?: boolean;
};

export function FilterChip({
  label,
  selected = false,
  onPress,
  style,
}: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      {...(Platform.OS === 'web'
        ? ({ dataSet: { csHealthosComponent: 'filter-chip' } } as object)
        : {})}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

type FilterChipOption<T extends string> = { label: string; key?: T; value?: T };

type FilterChipGroupBaseProps<T extends string> = {
  options: FilterChipOption<T>[];
  style?: ViewStyle;
  /** Stack chips onto multiple lines instead of a horizontal scroll row. */
  wrap?: boolean;
  /** Minimum selections when `multiple` is true (default 1). */
  minSelected?: number;
  onLightSurface?: boolean;
};

type FilterChipGroupSingleProps<T extends string> = FilterChipGroupBaseProps<T> & {
  multiple?: false;
  value?: T;
  selectedKey?: T;
  onChange?: (key: T) => void;
  onSelect?: (key: T) => void;
};

type FilterChipGroupMultipleProps<T extends string> = FilterChipGroupBaseProps<T> & {
  multiple: true;
  value?: T[];
  selectedKey?: never;
  onChange?: (keys: T[]) => void;
  onSelect?: never;
};

type FilterChipGroupProps<T extends string> =
  | FilterChipGroupSingleProps<T>
  | FilterChipGroupMultipleProps<T>;

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
  const selected = value ?? selectedKey;
  const hasHandler = Boolean(onChange ?? onSelect);

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
          hasHandler
            ? () => {
                if (multiple) {
                  const current = Array.isArray(selected) ? selected : [];
                  const has = current.includes(optKey);
                  if (has && current.length <= minSelected) return;
                  const next = has
                    ? current.filter((key) => key !== optKey)
                    : [...current, optKey];
                  (onChange as ((keys: T[]) => void) | undefined)?.(next);
                  return;
                }
                if (onChange) {
                  (onChange as (key: T) => void)(optKey);
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

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    borderRadius: careRadius.capsule,
    borderWidth: 1,
    borderColor: systemLiquidGlass.border,
    backgroundColor: systemLiquidGlass.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: systemLiquidGlass.borderActive,
    backgroundColor: systemLiquidGlass.chipActive,
  },
  chipPressed: {
    opacity: 0.82,
  },
  label: {
    ...careTypography.caption,
    color: systemLiquidGlass.text.secondary,
    fontWeight: '600',
  },
  labelSelected: {
    color: systemLiquidGlass.text.primary,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: careSpacing.sm,
    paddingVertical: careSpacing.xs,
  },
});
