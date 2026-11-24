import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { PremiumInput } from '@/components/ui/PremiumInput';
import { radius, spacing, typography, useLegacyTheme } from '@/theme';
import { isValidPzn } from '@/lib/pflege/medicationMasterDataValidation';
import { getBfarmReference } from '@/lib/pflege/bfarmReferenceService';
import type { BfarmReference } from '@/lib/pflege/bfarmReference';
import { BfarmSourceNotice } from './BfarmSourceNotice';

type Props = { tenantId: string; enabled: boolean; canEditNow: () => boolean };
type Result = { key: string; record: BfarmReference | null };

export function BfarmReferenceLookup({ tenantId, enabled, canEditNow }: Props) {
  const { colors } = useLegacyTheme();
  const styles = useMemo(() => StyleSheet.create({
    panel: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, minWidth: 0 },
    card: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs, backgroundColor: colors.bgInput },
    title: { ...typography.label, color: colors.textPrimary, flexShrink: 1 },
    text: { ...typography.body, color: colors.textPrimary, flexShrink: 1 },
    caption: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
    action: { alignSelf: 'flex-start', maxWidth: '100%' },
  }), [colors]);
  const [pzn, setPzn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const generation = useRef<symbol | null>(null);
  const key = JSON.stringify([tenantId, enabled, pzn]);
  const scope = useRef({ key, enabled, canEditNow });
  scope.current = { key, enabled, canEditNow };
  useEffect(() => { generation.current = null; setBusy(false); setResult(null); setError(null);
    return () => { generation.current = null; };
  }, [tenantId, enabled]);
  function change(next: string) {
    generation.current = null; setPzn(next); setResult(null); setBusy(false); setError(null);
  }
  async function lookup() {
    if (!enabled || !canEditNow() || generation.current) return;
    if (!isValidPzn(pzn)) { setError('Bitte eine gültige achtstellige PZN einschließlich führender Nullen eingeben.'); return; }
    const request = Symbol('bfarm-reference');
    generation.current = request; setBusy(true); setResult(null); setError(null);
    const current = () => generation.current === request && scope.current.key === key && scope.current.enabled && scope.current.canEditNow();
    try {
      const response = await getBfarmReference(tenantId, pzn);
      if (!current()) return;
      if (response.ok) setResult({ key, record: response.data });
      else setError(response.error);
    } catch {
      if (current()) setError('Die Referenzdaten konnten nicht geladen werden. Bitte erneut versuchen.');
    } finally {
      if (generation.current === request) { generation.current = null; setBusy(false); }
    }
  }
  const visible = enabled && result?.key === key ? result : null;
  const record = visible?.record;
  if (!enabled) return null;
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.title}>BfArM-Referenzdaten</Text>
    <PremiumInput label="Achtstellige PZN" accessibilityLabel="Achtstellige PZN" value={pzn} maxLength={8}
      keyboardType="number-pad" autoCapitalize="none" autoCorrect={false} onChangeText={change}
      onSubmitEditing={() => { void lookup(); }} hint="Die vollständige PZN steht auf der Arzneimittelpackung. Führende Nullen mit eingeben." />
    <View style={styles.action}><PremiumButton title="Arzneimittel abrufen" size="sm" loading={busy} disabled={!enabled || busy}
      onPress={() => { void lookup(); }} /></View>
    {busy ? <Text accessibilityLiveRegion="polite" style={styles.caption}>Referenzdatensatz wird geladen…</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
    {visible && !record ? <Text accessibilityLiveRegion="polite" style={styles.text}>Zu dieser PZN ist im verfügbaren BfArM-Datenstand kein Datensatz enthalten. Prüfe die Packung oder erfasse die Angaben laut Verordnung.</Text> : null}
    {record ? <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.title}>{record.product.name}</Text>
      <Text selectable style={styles.text}>PZN {record.product.pzn}</Text>
      <Text style={styles.caption}>Darreichungsform: {record.product.dosageForm || 'Nicht angegeben'}</Text>
      {record.components.map(component => <View key={component.number} style={styles.card}>
        {record.components.length > 1 ? <Text style={styles.title}>Komponente {component.number}{component.description ? ': ' + component.description : ''}</Text> : null}
        {component.dosageForm ? <Text style={styles.caption}>{component.dosageForm}</Text> : null}
        {component.substances.length ? component.substances.map(substance => <Text key={substance.rank} style={styles.text}>
          {substance.name}: {substance.strength || 'Wirkstärke nicht angegeben'}
        </Text>) : <Text style={styles.caption}>Keine Wirkstoffangabe enthalten.</Text>}
      </View>)}
      <Text style={styles.caption}>Diese Referenzansicht dient zum Abgleich mit der vorhandenen Verordnung. Einzeldosis, Applikationsweg und Einnahmezeiten werden aus der Verordnung erfasst.</Text>
      <BfarmSourceNotice sourceVersion={record.product.sourceVersion} stale={record.stale} />
    </View> : null}
  </View>;
}
