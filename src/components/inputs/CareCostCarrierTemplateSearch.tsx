import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PremiumInput } from '@/components/ui';
import {
  formatSystemCostCarrierAddress,
  type SystemCostCarrierType,
} from '@/lib/catalogs/systemCostCarrierTemplates';
import { searchSystemCostCarrierTemplates } from '@/lib/catalogs/systemCostCarrierSearchService';
import { colors, radius, spacing, typography } from '@/theme';

export type CostCarrierFieldValues = {
  name: string;
  street: string;
  zip: string;
  city: string;
  ikNumber: string;
};

type Props = {
  label: string;
  carrierType: SystemCostCarrierType;
  values: CostCarrierFieldValues;
  onChange: (values: CostCarrierFieldValues) => void;
  error?: string;
  hint?: string;
};

export function CareCostCarrierTemplateSearch({
  label,
  carrierType,
  values,
  onChange,
  error,
  hint = 'Systemvorlage suchen — bei Auswahl werden Name und Adresse übernommen.',
}: Props) {
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    if (!focused && !values.name.trim()) return [];
    return searchSystemCostCarrierTemplates(values.name, carrierType);
  }, [carrierType, focused, values.name]);

  const showResults = focused && values.name.trim().length > 0 && results.length > 0;
  const hasAddress = Boolean(values.street.trim() || values.zip.trim() || values.city.trim());

  const handleNameChange = (name: string) => {
    onChange({ ...values, name });
  };

  const handleSelect = (template: ReturnType<typeof searchSystemCostCarrierTemplates>[number]) => {
    onChange({
      name: template.name,
      street: template.street,
      zip: template.zip,
      city: template.city,
      ikNumber: template.ikNumber,
    });
    setFocused(false);
  };

  return (
    <View style={styles.wrap}>
      <PremiumInput
        label={label}
        value={values.name}
        onChangeText={handleNameChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Name oder Ort eingeben …"
        error={error}
        hint={hint}
      />

      {showResults ? (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>Systemvorlagen</Text>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.resultsList}>
            {results.map((entry) => (
              <Pressable
                key={entry.id}
                style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
                onPress={() => handleSelect(entry)}
              >
                <Text style={styles.resultName}>{entry.name}</Text>
                <Text style={styles.resultMeta}>
                  {formatSystemCostCarrierAddress(entry)}
                  {entry.ikNumber ? ` · IK ${entry.ikNumber}` : ''}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {hasAddress ? (
        <View style={styles.addressBlock}>
          <Text style={styles.addressLabel}>Adresse (aus Systemvorlage)</Text>
          <PremiumInput label="Straße" value={values.street} editable={false} />
          <View style={styles.addressRow}>
            <View style={styles.addressZip}>
              <PremiumInput label="PLZ" value={values.zip} editable={false} />
            </View>
            <View style={styles.addressCity}>
              <PremiumInput label="Ort" value={values.city} editable={false} />
            </View>
          </View>
          {values.ikNumber ? (
            <PremiumInput label="IK-Nummer" value={values.ikNumber} editable={false} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, gap: spacing.sm },
  results: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurface,
    overflow: 'hidden',
  },
  resultsTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  resultsList: { maxHeight: 220 },
  resultRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: spacing.xs,
  },
  resultRowPressed: { backgroundColor: colors.borderOrange },
  resultName: { ...typography.bodyStrong, color: colors.textPrimary },
  resultMeta: { ...typography.caption, color: colors.textSecondary },
  addressBlock: { gap: spacing.sm },
  addressLabel: { ...typography.caption, color: colors.textSecondary },
  addressRow: { flexDirection: 'row', gap: spacing.sm },
  addressZip: { flex: 1 },
  addressCity: { flex: 2 },
});
