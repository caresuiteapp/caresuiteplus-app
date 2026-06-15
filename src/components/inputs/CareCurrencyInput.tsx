import { StyleSheet, Text, View } from 'react-native';
import { PremiumInput } from '@/components/ui/PremiumInput';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { colors, spacing, typography } from '@/theme';

type Props = {
  label?: string;
  valueCents: number | null;
  onChangeCents: (cents: number) => void;
  error?: string;
};

export function CareCurrencyInput({ label, valueCents, onChangeCents, error }: Props) {
  const euros = valueCents != null ? (valueCents / 100).toFixed(2).replace('.', ',') : '';

  return (
    <View style={styles.wrap}>
      <PremiumInput
        label={label ?? 'Betrag'}
        value={euros}
        onChangeText={(text) => {
          const normalized = text.replace(/\./g, '').replace(',', '.');
          const num = parseFloat(normalized);
          if (!Number.isNaN(num)) onChangeCents(Math.round(num * 100));
          else if (!text.trim()) onChangeCents(0);
        }}
        placeholder="0,00"
        error={error}
        keyboardType="decimal-pad"
      />
      {valueCents != null && valueCents > 0 ? (
        <Text style={styles.preview}>{formatCurrency(valueCents, true)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  preview: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
