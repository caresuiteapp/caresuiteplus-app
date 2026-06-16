import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type InputFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
};

/** Dark glass input with focus-ready border and error state. */
export function InputField({ label, hint, error, style, ...props }: InputFieldProps) {
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={[type.label, styles.label]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={galaxyPalette.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? (
        <Text style={styles.error} numberOfLines={2}>
          {error}
        </Text>
      ) : null}
      {hint && !error ? (
        <Text style={[type.caption, styles.hint]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: careSpacing.xs,
    minWidth: 0,
  },
  label: {
    flexShrink: 0,
  },
  input: {
    minHeight: 44,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: galaxyPalette.borderGlass,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    color: galaxyPalette.textPrimary,
    fontSize: 15,
  },
  inputError: {
    borderColor: galaxyPalette.danger,
  },
  hint: {
    flexShrink: 1,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
    color: galaxyPalette.danger,
    flexShrink: 1,
  },
});
