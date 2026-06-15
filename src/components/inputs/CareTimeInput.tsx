import { StyleSheet, Text, View } from 'react-native';
import { PremiumInput } from '@/components/ui/PremiumInput';
import { colors, spacing, typography } from '@/theme';

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function CareTimeInput({ label, value, onChange, error }: Props) {
  return (
    <View style={styles.wrap}>
      <PremiumInput
        label={label ?? 'Uhrzeit'}
        value={value}
        onChangeText={onChange}
        placeholder="HH:MM"
        error={error}
        keyboardType="numbers-and-punctuation"
      />
      <Text style={styles.hint}>Format: HH:MM Uhr</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
