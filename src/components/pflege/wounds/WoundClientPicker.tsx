import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useWoundEntryStyles } from './woundEntryStyles';

type Person = { id: string; name: string };
const PAGE_SIZE = 8;
const searchText = (value: string) => value.toLocaleLowerCase('de').normalize('NFD')
  .replace(/\p{M}/gu, '').replace(/ß/g, 'ss');

export function WoundClientPicker({ people, selected, onSelect, onReset, disabled, showOnEmpty = false }: {
  people: readonly Person[]; selected?: string; onSelect: (id: string) => void; onReset?: () => void;
  disabled?: boolean; showOnEmpty?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [count, setCount] = useState(PAGE_SIZE);
  const styles = useWoundEntryStyles();
  const { c } = useCareLightPalette();
  const tokens = searchText(search).trim().split(/\s+/).filter(Boolean);
  const picked = people.find(person => person.id === selected);
  const visible = tokens.length > 0 || (!picked && showOnEmpty);
  const matched = useMemo(() => [...people].sort((a, b) => a.name.localeCompare(b.name, 'de')), [people])
    .filter(person => tokens.every(part => searchText(person.name).includes(part)));
  return <View style={styles.stack}>
    <PremiumInput label="Nach Klient:innen suchen" accessibilityLabel="Nach Klient:innen suchen"
      value={search} placeholder="Vor- oder Nachname" onChangeText={value => { setSearch(value); setCount(PAGE_SIZE); }}
      editable={!disabled} />
    {selected && <View style={styles.toolbar}>
      <View style={[styles.headingRow, styles.identity]}>
        <Feather name="user-check" size={16} color={c.text} accessible={false} />
        <Text style={styles.body} accessibilityLiveRegion="polite">{picked?.name ?? 'Ausgewählte Pflegeakte'}</Text>
      </View>
      {onReset && <PremiumButton title="Alle Klient:innen" size="sm" variant="ghost"
        onPress={() => { setSearch(''); onReset(); }} />}
    </View>}
    {visible && !disabled && (matched.length ? <>
      <View style={styles.list}>
        {matched.slice(0, count).map((person, index) => <Pressable key={person.id}
          accessibilityRole="button" accessibilityState={{ selected: person.id === selected }}
          style={({ pressed }) => [styles.pickerRow, index > 0 && styles.divider, pressed && styles.recordActive]}
          onPress={() => { onSelect(person.id); setSearch(''); setCount(PAGE_SIZE); }}>
          <Feather name={person.id === selected ? 'check' : 'user'} size={16} color={c.muted} accessible={false} />
          <Text style={styles.body}>{person.name}</Text>
        </Pressable>)}
      </View>
      {matched.length > count && <PremiumButton title="Weitere Klient:innen anzeigen" size="sm" variant="ghost"
        onPress={() => setCount(value => value + PAGE_SIZE)} />}
    </> : <Text style={styles.muted}>{tokens.length ? 'Keine passende Pflegeakte gefunden.' : 'Keine aktiven Pflegeakten verfügbar.'}</Text>)}
  </View>;
}
