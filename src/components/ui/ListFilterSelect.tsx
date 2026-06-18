import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

export type ListFilterOption = { key: string; label: string };

type ListFilterSelectProps = {
  label: string;
  value: string;
  options: ListFilterOption[];
  onChange: (key: string) => void;
  style?: ViewStyle;
};

export function ListFilterSelect({
  label,
  value,
  options,
  onChange,
  style,
}: ListFilterSelectProps) {
  const [open, setOpen] = useState(false);
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
    <View style={[styles.wrap, style]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.trigger, pressed ? styles.triggerPressed : null]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}: ${selectedLabel}`}
      >
        <Text style={styles.triggerText} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {Platform.OS === 'web' && open ? (
        <>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityRole="none" />
          <View style={styles.dropdown}>{optionList}</View>
        </>
      ) : null}

      {Platform.OS !== 'web' ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
              <GradientModalHeader title={label} onClose={() => setOpen(false)} />
              <View style={styles.modalBody}>
                {optionList}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
    zIndex: 1,
  },
  label: {
    ...typography.label,
  },
  trigger: {
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgInput,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  triggerPressed: {
    opacity: 0.9,
  },
  triggerText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  chevron: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: spacing.xs,
    zIndex: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      },
      default: {},
    }),
  },
  optionList: {
    gap: 0,
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  optionSelected: {
    backgroundColor: 'rgba(255,149,0,0.12)',
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  optionLabelSelected: {
    color: colors.orange,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bgPremium,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  modalClose: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  modalCloseText: {
    ...typography.bodyStrong,
    color: colors.orange,
  },
});
