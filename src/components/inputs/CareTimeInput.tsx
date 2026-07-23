import { StyleSheet, Text, View } from 'react-native';
import { PremiumInput } from '@/components/ui/PremiumInput';
import type { LlganViewContext } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { normalizeTimeInput } from '@/lib/formatters/normalizeTimeInput';
import { colors, spacing, typography } from '@/theme';

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  viewContext?: LlganViewContext;
  onLightSurface?: boolean;
  showFormatHint?: boolean;
};

function shouldAutoFormatWhileTyping(text: string): boolean {
  return /^\d{4}$/.test(text) && !/[:.]/.test(text);
}

export function CareTimeInput({
  label,
  value,
  onChange,
  error,
  placeholder = 'HH:MM',
  viewContext,
  onLightSurface = false,
  showFormatHint = true,
}: Props) {
  const handleChangeText = (text: string) => {
    if (shouldAutoFormatWhileTyping(text)) {
      const normalized = normalizeTimeInput(text);
      onChange(normalized !== text ? normalized : text);
      return;
    }
    onChange(text);
  };

  const handleBlur = () => {
    const normalized = normalizeTimeInput(value);
    if (normalized !== value) {
      onChange(normalized);
    }
  };

  return (
    <View style={styles.wrap}>
      <PremiumInput
        label={label ?? 'Uhrzeit'}
        value={value}
        viewContext={viewContext}
        onLightSurface={onLightSurface}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        placeholder={placeholder}
        error={error}
        keyboardType="numbers-and-punctuation"
      />
      {showFormatHint ? <Text style={styles.hint}>Format: HH:MM Uhr</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
