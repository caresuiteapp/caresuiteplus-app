import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import {
  CLIENT_FUNDING_SOURCE_DESCRIPTIONS,
  CLIENT_FUNDING_SOURCE_KEYS,
  CLIENT_FUNDING_SOURCE_LABELS,
  type ClientFundingSourceKey,
} from '@/types/clients/clientFundingSource';
import { colors, spacing, typography } from '@/theme';

export function ClientFundingSourceSelector({
  values,
  onChange,
  error,
  disabled = false,
}: {
  values: ClientFundingSourceKey[];
  onChange: (values: ClientFundingSourceKey[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const text = useAuroraAdaptiveText();

  function toggle(key: ClientFundingSourceKey) {
    if (disabled) return;
    onChange(values.includes(key) ? values.filter((value) => value !== key) : [...values, key]);
  }

  return (
    <View style={styles.root}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: text.primary }]}>Gewünschte Finanzierungsarten *</Text>
          <Text style={[styles.subtitle, { color: text.secondary }]}>Einzeln oder beliebig kombinieren. Diese Auswahl steuert Budgets und Rechnungen.</Text>
        </View>
        <PremiumBadge
          label={values.length === 0 ? 'Auswahl erforderlich' : `${values.length} ausgewählt`}
          variant={values.length === 0 ? 'orange' : 'green'}
        />
      </View>
      <View style={styles.grid}>
        {CLIENT_FUNDING_SOURCE_KEYS.map((key) => {
          const selected = values.includes(key);
          return (
            <Pressable
              key={key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              onPress={() => toggle(key)}
              style={({ pressed }) => [
                styles.card,
                selected && styles.cardSelected,
                pressed && !disabled && styles.cardPressed,
                disabled && styles.cardDisabled,
              ]}
            >
              <View style={[styles.check, selected && styles.checkSelected]}>
                <Text style={styles.checkLabel}>{selected ? '✓' : ''}</Text>
              </View>
              <View style={styles.cardCopy}>
                <Text style={[styles.bookingState, selected ? styles.bookingStateSelected : styles.bookingStatePreview]}>
                  {selected ? '✓ LEISTUNG GEBUCHT' : 'NOCH NICHT GEBUCHT'}
                </Text>
                <Text style={[styles.cardTitle, { color: text.primary }]}>{CLIENT_FUNDING_SOURCE_LABELS[key]}</Text>
                <Text style={[styles.cardDescription, { color: text.secondary }]}>{CLIENT_FUNDING_SOURCE_DESCRIPTIONS[key]}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  headingCopy: { flex: 1, minWidth: 240, gap: 2 },
  title: { ...typography.label, fontSize: 15 },
  subtitle: { ...typography.caption, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { flexBasis: 250, flexGrow: 1, minHeight: 96, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(22,131,255,0.16)', backgroundColor: 'rgba(255,255,255,0.9)' },
  cardSelected: { borderColor: colors.cyan, backgroundColor: 'rgba(30,150,255,0.16)' },
  cardPressed: { opacity: 0.82 },
  cardDisabled: { opacity: 0.58 },
  check: { width: 25, height: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(160,205,255,0.40)', backgroundColor: 'rgba(255,255,255,0.05)' },
  checkSelected: { borderColor: colors.cyan, backgroundColor: colors.blue },
  checkLabel: { color: '#FFFFFF', fontSize: 16, lineHeight: 19, fontWeight: '900' },
  cardCopy: { flex: 1, gap: 4 },
  bookingState: { alignSelf: 'flex-start', fontSize: 9, lineHeight: 13, fontWeight: '900', letterSpacing: 0.7 },
  bookingStateSelected: { color: '#65F2A7' },
  bookingStatePreview: { color: '#FFD166' },
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  cardDescription: { ...typography.caption, lineHeight: 18 },
  error: { color: colors.error, fontSize: 12, lineHeight: 17, fontWeight: '700' },
});
