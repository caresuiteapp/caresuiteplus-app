import { useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { lightSurfaceText, useAuroraGlassSelectStyles } from '@/design/tokens/auroraGlass';

export type ListFilterOption = { key: string; label: string };

type ListFilterSelectProps = {
  label: string;
  value: string;
  options: ListFilterOption[];
  onChange: (key: string) => void;
  style?: ViewStyle;
  onLightSurface?: boolean;
};

export function ListFilterSelect({
  label,
  value,
  options,
  onChange,
  style,
  onLightSurface = false,
}: ListFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const styles = useAuroraGlassSelectStyles();
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
            <Text
              style={[
                styles.optionLabel,
                onLightSurface ? { color: lightSurfaceText.primary } : null,
                selected ? styles.optionLabelSelected : null,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.wrap, style]}>
      <Text style={[styles.label, onLightSurface ? { color: lightSurfaceText.primary } : null]}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.trigger, pressed ? styles.triggerPressed : null]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}: ${selectedLabel}`}
      >
        <Text
          style={[styles.triggerText, onLightSurface ? { color: lightSurfaceText.primary } : null]}
          numberOfLines={1}
        >
          {selectedLabel}
        </Text>
        <Text style={[styles.chevron, onLightSurface ? { color: lightSurfaceText.muted } : null]}>
          {open ? '▴' : '▾'}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.modalTitle, onLightSurface ? { color: lightSurfaceText.primary } : null]}>
              {label}
            </Text>
            {optionList}
            <Pressable onPress={() => setOpen(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Schließen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
