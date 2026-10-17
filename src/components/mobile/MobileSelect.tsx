import { useState } from 'react';
import { Text, View } from 'react-native';
import { MobileButton, MobileRecordRow, MobileSearch, MobileSheet, MobileState, m } from './MobileWorkspace';

export function MobileSelect({ label, value, options, onChange, disabled, empty = 'Nicht zugeordnet' }: { label: string; value: string; options: Record<string, string>; onChange: (value: string) => void; disabled?: boolean; empty?: string }) {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState(''); const [limit, setLimit] = useState(40);
  const rows = Object.entries(options).filter(([, title]) => title.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
  const choose = (key: string) => { onChange(key); setOpen(false); setSearch(''); setLimit(40); };
  return <View style={m.field}><Text style={m.label}>{label}</Text><MobileButton label={value ? options[value] ?? 'Bestehende Zuordnung' : empty} icon="chevron-down" disabled={disabled} onPress={() => setOpen(true)} />
    <MobileSheet visible={open} title={label} onClose={() => setOpen(false)}><MobileSearch value={search} onChangeText={v => { setSearch(v); setLimit(40); }} /><MobileButton label={empty} selected={!value} onPress={() => choose('')} />{rows.slice(0, limit).map(([key, title]) => <MobileRecordRow key={key} title={title} selected={value === key} onPress={() => choose(key)} />)}{!rows.length ? <MobileState title="Keine passenden Einträge" /> : null}{rows.length > limit ? <MobileButton label="Weitere Einträge" onPress={() => setLimit(n => n + 40)} /> : null}</MobileSheet>
  </View>;
}
