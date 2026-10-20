import { StyleSheet, View } from 'react-native';
import { PremiumInput } from '@/components/ui';
import type { CostCarrierFieldValues } from '@/components/inputs/CareCostCarrierTemplateSearch';
import { spacing } from '@/theme';

type Props = {
  label: string;
  values: CostCarrierFieldValues;
  onChange: (values: CostCarrierFieldValues) => void;
  error?: string;
  hint?: string;
};

export function CareCostBearerManualFields({
  label,
  values,
  onChange,
  error,
  hint = 'Name und Adresse manuell erfassen.',
}: Props) {
  return (
    <View style={styles.wrap}>
      <PremiumInput
        label={label}
        value={values.name}
        onChangeText={(name) => onChange({ ...values, name })}
        placeholder="Name eingeben …"
        error={error}
        hint={hint}
      />
      <PremiumInput
        label="Straße"
        value={values.street}
        onChangeText={(street) => onChange({ ...values, street })}
      />
      <View style={styles.addressRow}>
        <View style={styles.addressZip}>
          <PremiumInput label="PLZ" value={values.zip} onChangeText={(zip) => onChange({ ...values, zip })} />
        </View>
        <View style={styles.addressCity}>
          <PremiumInput label="Ort" value={values.city} onChangeText={(city) => onChange({ ...values, city })} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, gap: spacing.sm },
  addressRow: { flexDirection: 'row', gap: spacing.sm },
  addressZip: { flex: 1 },
  addressCity: { flex: 2 },
});
