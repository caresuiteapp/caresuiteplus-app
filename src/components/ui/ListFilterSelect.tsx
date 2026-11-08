import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { useAuroraGlassSelectStyles } from '@/design/tokens/auroraGlass';
import { spatialCare } from '@/design/tokens/spatialCareSuite';

export type ListFilterOption = { key: string; label: string };

type ListFilterSelectProps = {
  label: string;
  value: string;
  options: ListFilterOption[];
  onChange: (key: string) => void;
  style?: ViewStyle;
  /** Disable flex growth for fields stacked vertically in a form. */
  grow?: boolean;
  onLightSurface?: boolean;
  onDarkSurface?: boolean;
};

export function ListFilterSelect({
  label,
  value,
  options,
  onChange,
  style,
  grow = true,
  onDarkSurface = false,
}: ListFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const styles = useAuroraGlassSelectStyles();
  const wrapStyle: ViewStyle = grow ? styles.wrap : {
    ...StyleSheet.flatten(styles.wrap),
    flex: undefined,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  };
  const selectedLabel = options.find((opt) => opt.key === value)?.label ?? value;

  const handleSelect = (key: string) => {
    onChange(key);
    setOpen(false);
  };

  const optionList = (
    <View style={styles.optionList}>
      {options.map((opt) => {
        const selected = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => handleSelect(opt.key)}
            style={({ pressed }) => [
              styles.option,
              selected ? styles.optionSelected : null,
              pressed ? styles.optionPressed : null,
            ]}
            accessibilityRole="menuitem"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.optionLabel, selected ? styles.optionLabelSelected : null]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      style={[wrapStyle, style]}
      {...(Platform.OS === 'web'
        ? ({ dataSet: { csHealthosComponent: 'filter-select' } } as object)
        : {})}
    >
      <Text style={[styles.label, onDarkSurface && darkStyles.text]}>{label}</Text>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.trigger, onDarkSurface && darkStyles.trigger, pressed && styles.triggerPressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}: ${selectedLabel}`}
      >
        <Text style={[styles.triggerText, onDarkSurface && darkStyles.text]} numberOfLines={onDarkSurface ? undefined : 1}>
          {selectedLabel}
        </Text>
        <Text style={[styles.chevron, onDarkSurface && darkStyles.text]}>
          {open ? '▴' : '▾'}
        </Text>
      </Pressable>

      <PlatformModal
        visible={open}
        title={label}
        subtitle={`Aktuell: ${selectedLabel}`}
        onClose={() => setOpen(false)}
        maxWidth={520}
        minWidth={300}
        maxHeightRatio={0.82}
      >
        {optionList}
      </PlatformModal>
    </View>
  );
}

const darkStyles = StyleSheet.create({
  text: { color: spatialCare.textOnNight },
  trigger: { backgroundColor: spatialCare.input, borderColor: spatialCare.border },
});
