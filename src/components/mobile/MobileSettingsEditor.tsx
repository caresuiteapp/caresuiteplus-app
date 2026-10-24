import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import type { ServiceResult } from '@/types';
import { MobileButton, MobileField, MobileSheet, m } from './MobileWorkspace';
import { MobileSelect } from './MobileSelect';

export type MobileSettingsField = { key: string; label: string; hint?: string; required?: boolean; multiline?: boolean; numeric?: boolean; options?: Record<string, string> };
export function MobileSettingsEditor<T>({ title, initial, fields, onSave, onSaved, onClose, onReload }: {
  title: string; initial: Record<string, string>; fields: MobileSettingsField[];
  onSave: (values: Record<string, string>) => Promise<ServiceResult<T> & { reloadRequired?: boolean }>;
  onSaved: (value: T) => void; onClose: () => void; onReload?: () => void;
}) {
  const [values, setValues] = useState(initial); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [blocked, setBlocked] = useState(false);
  const lock = useRef(false); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const close = (after = onClose) => {
    if (lock.current) return;
    if (!dirty) { after(); return; }
    Alert.alert('Änderungen verwerfen?', 'Ihre Eingaben wurden noch nicht vollständig gespeichert.', [
      { text: 'Weiter bearbeiten', style: 'cancel' }, { text: 'Verwerfen', style: 'destructive', onPress: after },
    ]);
  };
  const save = async () => {
    if (lock.current || blocked) return;
    if (fields.some(field => field.required && !values[field.key]?.trim())) { setError('Bitte alle Pflichtangaben ausfüllen.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await onSave(values); if (!alive.current) return;
      if (!result.ok) { setError(result.error); setBlocked(!!result.reloadRequired); return; }
      onSaved(result.data); onClose();
    } catch { if (alive.current) setError('Speichern nicht möglich. Ihre Eingaben bleiben erhalten.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return <MobileSheet visible title={title} onClose={() => close()} footer={<>
    {error ? <Text accessibilityRole="alert" style={m.error}>{error}</Text> : null}
    <View style={m.wrap}><MobileButton primary label="Speichern" icon="save" busy={busy} disabled={blocked} onPress={() => void save()} /><MobileButton label="Abbrechen" disabled={busy} onPress={() => close()} />
      {blocked && onReload ? <MobileButton label="Aktuellen Stand laden" onPress={() => close(() => { onClose(); onReload(); })} /> : null}</View>
  </>}>{fields.map(field => <View key={field.key} style={m.field}>{field.options ? <MobileSelect label={field.label} value={values[field.key] ?? ''} options={field.options} disabled={busy || blocked} onChange={value => setValues(previous => ({ ...previous, [field.key]: value }))} /> : <MobileField label={`${field.label}${field.required ? ' *' : ''}`} value={values[field.key] ?? ''} editable={!busy && !blocked} multiline={field.multiline} keyboardType={field.numeric ? 'decimal-pad' : 'default'} onChangeText={value => setValues(previous => ({ ...previous, [field.key]: value }))} />}{field.hint ? <Text style={m.muted}>{field.hint}</Text> : null}</View>)}</MobileSheet>;
}
