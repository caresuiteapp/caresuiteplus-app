import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ConnectBillingMode } from '@/types/connect/billing';
import { colors, radius, spacing, typography } from '@/theme';

type Option = {
  key: ConnectBillingMode;
  label: string;
  description: string;
};

type Props = {
  options: Option[];
  selected: ConnectBillingMode;
  onSelect: (mode: ConnectBillingMode) => void;
  disabled?: boolean;
};

export function BillingModeSelector({ options, selected, onSelect, disabled }: Props) {
  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, disabled }}
            disabled={disabled}
            onPress={() => onSelect(option.key)}
            style={[styles.option, active && styles.optionActive, disabled && styles.optionDisabled]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
            <Text style={styles.description}>{option.description}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  option: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bgSurface,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.bgPremium,
  },
  optionDisabled: { opacity: 0.6 },
  label: { ...typography.bodyStrong, color: colors.textPrimary },
  labelActive: { color: colors.primary },
  description: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
});
