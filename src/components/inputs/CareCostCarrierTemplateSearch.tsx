import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PremiumInput } from '@/components/ui';
import type { CostBearerTypeKey } from '@/lib/clients/clientIntakeCostBearerConfig';
import {
  COST_CARRIER_SEARCH_DEBOUNCE_MS,
  COST_CARRIER_SEARCH_MIN_QUERY_LENGTH,
  formatCostCarrierAddress,
  searchCostCarrierTemplates,
} from '@/features/costCarriers/costCarrierService';
import type { CostCarrierSystemTemplate } from '@/features/costCarriers/costCarrierTypes';
import { colors, radius, spacing, typography } from '@/theme';

export type CostCarrierFieldValues = {
  name: string;
  street: string;
  zip: string;
  city: string;
  ikNumber: string;
  systemTemplateId?: string;
  carrierType?: string;
};

type Props = {
  label: string;
  uiCarrierType: CostBearerTypeKey;
  values: CostCarrierFieldValues;
  onChange: (values: CostCarrierFieldValues) => void;
  error?: string;
  hint?: string;
};

export function CareCostCarrierTemplateSearch({
  label,
  uiCarrierType,
  values,
  onChange,
  error,
  hint = 'Systemvorlage suchen — bei Auswahl werden Name und Adresse übernommen.',
}: Props) {
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<CostCarrierSystemTemplate[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!focused || values.name.trim().length < COST_CARRIER_SEARCH_MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setSearchError(null);

      void searchCostCarrierTemplates(uiCarrierType, values.name, 8).then((result) => {
        if (controller.signal.aborted) return;
        setLoading(false);
        if (!result.ok) {
          setResults([]);
          setSearchError(result.error);
          return;
        }
        setResults(result.data);
        setSearchError(null);
      });
    }, COST_CARRIER_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [focused, uiCarrierType, values.name]);

  const showResults =
    focused
    && values.name.trim().length >= COST_CARRIER_SEARCH_MIN_QUERY_LENGTH
    && (loading || searchError || results.length > 0);

  const hasAddress = Boolean(values.street.trim() || values.zip.trim() || values.city.trim());

  const handleNameChange = (name: string) => {
    onChange({
      ...values,
      name,
      systemTemplateId: undefined,
      carrierType: undefined,
    });
  };

  const handleSelect = (template: CostCarrierSystemTemplate) => {
    onChange({
      name: template.name,
      street: template.street,
      zip: template.zip,
      city: template.city,
      ikNumber: template.ikNumber,
      systemTemplateId: template.id,
      carrierType: template.carrierType,
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
          <Text style={styles.resultsTitle}>
            {loading ? 'Systemvorlagen werden gesucht …' : 'Systemvorlagen'}
          </Text>
          {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}
          {!loading && !searchError && results.length === 0 ? (
            <Text style={styles.empty}>Keine Treffer</Text>
          ) : null}
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.resultsList}>
            {results.map((entry) => (
              <Pressable
                key={entry.id}
                style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
                onPress={() => handleSelect(entry)}
              >
                <Text style={styles.resultName}>{entry.name}</Text>
                <Text style={styles.resultMeta}>
                  {formatCostCarrierAddress(entry)}
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
  searchError: {
    ...typography.caption,
    color: '#c00',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  empty: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
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
