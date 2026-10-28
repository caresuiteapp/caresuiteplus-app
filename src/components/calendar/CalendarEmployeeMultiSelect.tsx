import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CareEntityOption } from '@/components/inputs/CareEntitySelect';
import { careSuiteAppFontFamily } from '@/design/tokens/appFontFamily';

export function CalendarEmployeeMultiSelect({ values, options, onChange, disabled, loading }: {
  values: string[]; options: CareEntityOption[]; onChange: (values: string[]) => void; disabled?: boolean; loading?: boolean;
}) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(values), [values]);
  const people = useMemo(() => new Map(options.map(person => [person.value, person.label])), [options]);
  const filtered = options.filter(person => person.label.toLocaleLowerCase('de-DE').includes(query.trim().toLocaleLowerCase('de-DE')));
  const locked = disabled || loading;
  return <View style={styles.root}>
    <Text style={styles.label}>Mitarbeitende</Text>
    <Text style={styles.hint}>Mehrere Personen oder das gesamte Team auswählen.</Text>
    <TextInput accessibilityLabel="Mitarbeitende suchen" placeholder="Name suchen" value={query} onChangeText={setQuery} editable={!locked} autoCorrect={false} style={styles.search} placeholderTextColor="#60758C" />
    <View style={styles.wrap}>
      <Pressable accessibilityRole="button" accessibilityLabel="Alle Mitarbeitenden auswählen" disabled={locked || !options.some(person => !selected.has(person.value))} onPress={() => onChange([...new Set([...values, ...options.map(person => person.value)])])} style={styles.action}><Text style={styles.actionText}>Alle auswählen</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Mitarbeitendenauswahl aufheben" disabled={locked || !values.length} onPress={() => onChange([])} style={styles.action}><Text style={styles.actionText}>Auswahl aufheben</Text></Pressable>
    </View>
    <Text accessibilityLiveRegion="polite" style={styles.hint}>{loading ? 'Mitarbeitende werden geladen …' : `${values.length} ${values.length === 1 ? 'Person ausgewählt' : 'Personen ausgewählt'}`}</Text>
    {values.length ? <View style={styles.wrap}>{values.map(id => <Pressable key={id} accessibilityRole="button" accessibilityLabel={`${people.get(id) ?? 'Nicht mehr verfügbare Person'} aus Auswahl entfernen`} disabled={locked} onPress={() => onChange(values.filter(value => value !== id))} style={styles.selected}><Text style={styles.selectedText}>{people.get(id) ?? 'Nicht mehr verfügbare Person'} ×</Text></Pressable>)}</View> : null}
    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.options} contentContainerStyle={{ gap: 4 }}>
      {filtered.map(person => <Pressable key={person.value} accessibilityRole="checkbox" accessibilityLabel={person.label} accessibilityState={{ checked: selected.has(person.value), disabled: !!locked }} disabled={locked} onPress={() => onChange(selected.has(person.value) ? values.filter(id => id !== person.value) : [...values, person.value])} style={[styles.person, selected.has(person.value) && { backgroundColor: '#E8F2FF' }]}><View style={[styles.checkbox, selected.has(person.value) && { backgroundColor: '#1569E8' }]}><Text style={{ color: '#fff' }}>{selected.has(person.value) ? '✓' : ''}</Text></View><Text style={[styles.label, { flex: 1 }]}>{person.label}</Text></Pressable>)}
      {!loading && !filtered.length ? <Text style={styles.hint}>{query ? 'Keine passenden Mitarbeitenden gefunden.' : 'Keine Mitarbeitenden verfügbar.'}</Text> : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { width: '100%', gap: 9 }, label: { color: '#102B49', fontFamily: careSuiteAppFontFamily, fontSize: 14, lineHeight: 21, fontWeight: '600', flexShrink: 1 }, hint: { color: '#546B84', fontFamily: careSuiteAppFontFamily, fontSize: 13, lineHeight: 20 },
  search: { minHeight: 48, backgroundColor: '#fff', borderWidth: 1, borderColor: '#C5D6EB', borderRadius: 12, color: '#102B49', fontFamily: careSuiteAppFontFamily, fontSize: 15, padding: 12 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, action: { minHeight: 44, padding: 10, borderRadius: 12, backgroundColor: '#EDF4FF', justifyContent: 'center', flexShrink: 1 }, actionText: { color: '#1557B8', fontFamily: careSuiteAppFontFamily, fontSize: 13, lineHeight: 20 }, selected: { minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, backgroundColor: '#1569E8', justifyContent: 'center', flexShrink: 1 }, selectedText: { color: '#fff', fontFamily: careSuiteAppFontFamily, fontSize: 13, lineHeight: 20, flexShrink: 1 },
  options: { maxHeight: 260, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D7E5F5' }, person: { minHeight: 48, padding: 12, gap: 10, flexDirection: 'row', alignItems: 'center' }, checkbox: { width: 24, height: 24, borderWidth: 1, borderColor: '#8CAED2', borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
});
