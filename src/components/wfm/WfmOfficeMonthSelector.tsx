import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ListFilterSelect, PremiumButton } from '@/components/ui';
import { officeMonthKey, shiftOfficeMonth } from '@/lib/wfm/wfmOfficeMonth';

type Props = { value: string; onChange: (month: string) => void };
const months = Array.from({ length: 12 }, (_, index) => ({
  key: String(index + 1).padStart(2, '0'),
  label: new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(2026, index, 15)),
}));

export function WfmOfficeMonthSelector({ value, onChange }: Props) {
  const [year, month] = value.split('-');
  const currentYear = new Date().getFullYear();
  const firstYear = Math.min(currentYear - 10, Number(year));
  const lastYear = Math.max(currentYear + 5, Number(year));
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => ({
    key: String(lastYear - index), label: String(lastYear - index),
  }));
  return <View style={styles.root} testID="wfm-month-selector">
    <View style={styles.selects}>
      <ListFilterSelect label="Monat" value={month} options={months}
        onChange={(next) => onChange(`${year}-${next}`)} style={styles.month} />
      <ListFilterSelect label="Jahr" value={year} options={years}
        onChange={(next) => onChange(`${next}-${month}`)} style={styles.year} />
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Vorheriger Monat"
        onPress={() => onChange(shiftOfficeMonth(value, -1))} style={styles.arrow}>
        <Text style={styles.glyph}>‹</Text>
      </Pressable>
      <PremiumButton title="Aktueller Monat" variant="secondary"
        onPress={() => onChange(officeMonthKey())} />
      <Pressable accessibilityRole="button" accessibilityLabel="Nächster Monat"
        onPress={() => onChange(shiftOfficeMonth(value, 1))} style={styles.arrow}>
        <Text style={styles.glyph}>›</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
  selects: { flexDirection: 'row', flexWrap: 'wrap', flexGrow: 1, gap: 12 },
  month: { flexGrow: 1, flexBasis: 180, minWidth: 140 },
  year: { flexGrow: 1, flexBasis: 110, minWidth: 100 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingBottom: 1 },
  arrow: { width: 44, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#A9CFF7', backgroundColor: '#EAF4FF', alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 28, lineHeight: 32, color: '#0867CF' },
});
