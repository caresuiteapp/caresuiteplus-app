import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PremiumInput } from '@/components/ui';
import {
  ADDRESS_SEARCH_MIN_QUERY_LENGTH,
  searchGermanAddresses,
} from '@/lib/geo/addressAutocompleteService';
import type { GermanAddressFields } from '@/lib/geo/addressParsing';
import { colors, radius, spacing, typography } from '@/theme';

const SEARCH_DEBOUNCE_MS = 350;

export type AddressFieldValues = GermanAddressFields;

type FieldErrors = Partial<Record<keyof AddressFieldValues, string>>;

type Props = {
  values: AddressFieldValues;
  onChange: (values: AddressFieldValues) => void;
  errors?: FieldErrors;
  hint?: string;
};

export function CareAddressSearch({
  values,
  onChange,
  errors = {},
  hint = 'Adresse suchen — Vorschläge übernehmen Straße, Hausnummer, PLZ und Ort.',
}: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; label: string } & AddressFieldValues>>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!focused || query.trim().length < ADDRESS_SEARCH_MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setSuggestions([]);
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

      void searchGermanAddresses(query, { signal: controller.signal }).then((result) => {
        if (controller.signal.aborted) return;

        setLoading(false);
        if (!result.ok) {
          setSuggestions([]);
          setSearchError(result.error);
          return;
        }

        setSuggestions(result.data);
        setSearchError(null);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [query, focused]);

  const showPanel =
    focused && query.trim().length >= ADDRESS_SEARCH_MIN_QUERY_LENGTH && (loading || searchError || suggestions.length > 0 || !loading);

  const showEmpty =
    focused &&
    query.trim().length >= ADDRESS_SEARCH_MIN_QUERY_LENGTH &&
    !loading &&
    !searchError &&
    suggestions.length === 0;

  const handleSelect = (suggestion: AddressFieldValues & { id: string; label: string }) => {
    onChange({
      street: suggestion.street,
      houseNumber: suggestion.houseNumber,
      zip: suggestion.zip,
      city: suggestion.city,
    });
    setQuery(suggestion.label);
    setFocused(false);
    setSuggestions([]);
  };

  const updateField = (field: keyof AddressFieldValues, value: string) => {
    onChange({ ...values, [field]: value });
  };

  return (
    <View style={styles.wrap}>
      <PremiumInput
        label="Adresse suchen"
        value={query}
        onChangeText={setQuery}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Straße, PLZ oder Ort eingeben …"
        hint={hint}
      />

      {showPanel ? (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>Vorschläge</Text>
          {loading ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={styles.statusText}>Suche …</Text>
            </View>
          ) : null}
          {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
          {showEmpty ? <Text style={styles.statusText}>Keine Treffer — Felder manuell ausfüllen.</Text> : null}
          {!loading && suggestions.length > 0 ? (
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.resultsList}>
              {suggestions.map((entry) => (
                <Pressable
                  key={entry.id}
                  style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
                  onPress={() => handleSelect(entry)}
                >
                  <Text style={styles.resultName}>{entry.label}</Text>
                  {entry.label !== [entry.street, entry.houseNumber].filter(Boolean).join(' ').trim() ? (
                    <Text style={styles.resultMeta}>
                      {[entry.street, entry.houseNumber].filter(Boolean).join(' ')}
                      {entry.zip || entry.city ? ` · ${[entry.zip, entry.city].filter(Boolean).join(' ')}` : ''}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      <View style={styles.fields}>
        <PremiumInput
          label="Straße *"
          value={values.street}
          onChangeText={(value) => updateField('street', value)}
          error={errors.street}
        />
        <PremiumInput
          label="Hausnummer"
          value={values.houseNumber}
          onChangeText={(value) => updateField('houseNumber', value)}
          error={errors.houseNumber}
        />
        <View style={styles.row}>
          <View style={styles.zip}>
            <PremiumInput
              label="PLZ *"
              value={values.zip}
              onChangeText={(value) => updateField('zip', value)}
              error={errors.zip}
            />
          </View>
          <View style={styles.city}>
            <PremiumInput
              label="Ort *"
              value={values.city}
              onChangeText={(value) => updateField('city', value)}
              error={errors.city}
            />
          </View>
        </View>
      </View>
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusText: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: '#c00',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  fields: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  zip: { flex: 1 },
  city: { flex: 2 },
});
