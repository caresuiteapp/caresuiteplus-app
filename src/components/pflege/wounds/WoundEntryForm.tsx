import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ErrorState, FilterChipGroup, InfoBanner, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { currentMedicationEventTime, MedicationEventTimeInput, medicationEventInstant } from '@/components/pflege/MedicationEventTimeInput';
import { useWoundRecordStyles } from './woundRecordStyles';
import { WoundCatalogPanel } from './WoundCatalogPanel';
import { ageAt, CLINICAL_FIELDS, COMPLICATING_FACTORS, ENTRY_LABELS, formatWoundNumber, RISK_SCALES, scorePressureRisk,
  woundBmi, woundNumber, type RecordPayload, type RiskScale, type WoundCatalogItem } from '@/lib/pflege/woundRecordDomain';
import { FOOT_SIDE_LABELS, MATERIAL_LABELS, TRACHEOSTOMY_LABELS } from '@/lib/pflege/woundRecordReport';
import type { WoundRecordScope, WoundRecordWrite } from '@/lib/pflege/woundRecordService';

export type FormKind = 'note' | 'risk' | 'anamnesis' | 'diabetic_foot' | 'tracheostomy' | 'material';
const NOTES = [['description', 'Wundbeschreibung'], ['treatment', 'Wundbehandlung']] as const;
const MATERIAL = [['name', 'Bezeichnung und Ausführung'], ['supplier', 'Lieferant oder Hersteller'], ['code', 'Artikelnummer oder PZN'],
  ['unit', 'Mengeneinheit'], ['quantity', 'Menge'], ['price', 'Einheitspreis in Euro'], ['reference', 'Belegnummer oder Bezug']] as const;

export function WoundEntryForm({ kind, scope, birthDate, locked, onSave, onClose }: {
  kind: FormKind; scope: WoundRecordScope; birthDate: string | null; locked: boolean;
  onSave: (entry: WoundRecordWrite) => Promise<void>; onClose: () => void;
}) {
  const styles = useWoundRecordStyles();
  const [time, setTime] = useState(currentMedicationEventTime);
  const [values, setValues] = useState<Record<string, string>>({});
  const [scale, setScale] = useState<RiskScale>('braden');
  const [scores, setScores] = useState<number[]>([]);
  const [factors, setFactors] = useState<string[]>([]);
  const [error, setError] = useState('');
  const observations = medicationEventInstant(time);
  const age = observations ? ageAt(birthDate, observations) : null;
  const total = scorePressureRisk(scale, scores);
  const bmi = woundBmi(woundNumber(values.heightCm ?? ''), woundNumber(values.weightKg ?? ''));
  const set = (key: string, value: string) => setValues(prev => ({ ...prev, [key]: value }));
  const input = (key: string, label: string, number = false, multiline = true) =>
    <PremiumInput key={key} label={label} accessibilityLabel={label} value={values[key] ?? ''} onChangeText={value => set(key, value)}
      multiline={multiline && !number} editable={!locked} maxLength={number ? 12 : 2000}
      keyboardType={number ? 'decimal-pad' : 'default'} />;
  const choices = (key: string, options: Record<string, string>) => <FilterChipGroup wrap
    options={Object.entries(options).map(([k, label]) => ({ key: k, label }))}
    value={values[key] ?? ''} onChange={locked ? undefined : value => set(key, value)} />;

  function insert(field: string, text: string) {
    const next = [values[field]?.trim(), text].filter(Boolean).join('\n\n');
    if (next.length > 2000) { setError('Der Baustein passt nicht vollständig in das Feld. Kürze zuerst den vorhandenen Text.'); return; }
    set(field, next); setError('');
  }

  function copyArticle(item: WoundCatalogItem) {
    setValues(prev => ({ ...prev, name: item.name, supplier: item.supplier, code: item.code, unit: item.unit,
      price: item.unit_cents == null ? '' : String(item.unit_cents / 100) }));
  }

  function build(): RecordPayload {
    if (!observations || Date.parse(observations) > Date.now()) throw Error('Bitte tatsächlichen Zeitpunkt prüfen.');
    const data: RecordPayload = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]));
    if (kind === 'risk') {
      if (age == null || age < 18) throw Error('Zum Beobachtungszeitpunkt muss in den Stammdaten ein Erwachsenenalter bestätigt sein.');
      if (total === null || !values.assessment?.trim()) throw Error('Bitte alle Kategorien bewerten und die fachliche Beurteilung erfassen.');
      return { scale, scores, assessment: values.assessment.trim(), plan: values.plan?.trim() ?? '' };
    }
    if (kind === 'anamnesis') {
      for (const [key, min, max] of [['heightCm', 20, 300], ['weightKg', .001, 1000], ['vas', 0, 100]] as const) {
        if (!values[key]?.trim()) continue;
        const n = woundNumber(values[key]);
        if (n === null || n < min || n > max) throw Error('Bitte Größe, Gewicht oder VAS-Eingabe prüfen.');
        data[key] = n;
      }
      if (factors.length) data.factors = factors;
    }
    if (kind === 'diabetic_foot' && !values.side) throw Error('Bitte die untersuchte Fußseite auswählen.');
    if (kind === 'tracheostomy') {
      if (!values.mode) throw Error('Bitte die Protokollart auswählen.');
      if (values.mode === 'training' && (!values.training?.trim() || !values.participants?.trim())) throw Error('Bitte Schulungsinhalt und Teilnehmende erfassen.');
    }
    if (kind === 'material') {
      const quantity = woundNumber(values.quantity ?? '');
      const price = values.price?.trim() ? woundNumber(values.price) : null;
      if (!values.mode || !values.name?.trim() || !values.unit?.trim() || quantity == null || quantity <= 0 || quantity > 100000
        || (values.mode === 'delivered' && !values.reference?.trim())
        || (values.price?.trim() && (price == null || price > 1e6 || !/^\d+([.,]\d{1,2})?$/.test(values.price.trim())))) {
        throw Error('Bitte Vorgang, Artikel, Menge, Einheit und bei einer Lieferung den Belegbezug prüfen.');
      }
      const { price: _price, ...record } = data;
      return { ...record, quantity, unitCents: price == null ? null : Math.round(price * 100) };
    }
    if (!Object.keys(data).some(key => key !== 'mode' && key !== 'side')) throw Error('Bitte mindestens eine Befundangabe erfassen.');
    return data;
  }

  async function save() {
    if (locked) return;
    let payload: RecordPayload;
    try { payload = build(); } catch (e) { setError(e instanceof Error ? e.message : 'Eingabe prüfen.'); return; }
    setError('');
    await onSave({ kind, observedAt: observations, payload });
  }

  return <SectionPanel title={ENTRY_LABELS[kind]}>
    <View style={styles.stack}>
      <MedicationEventTimeInput label={kind === 'material' ? 'Zeitpunkt des Materialvorgangs' : 'Tatsächlicher Beobachtungszeitpunkt'}
        value={time} disabled={locked} onChange={setTime} />
      {kind === 'note' && NOTES.map(([key, label]) => <View key={key} style={styles.tight}>
        {input(key, label)}<WoundCatalogPanel scope={scope} kind={key} embedded edit disabled={locked}
          onInsert={item => insert(key, item.text)} />
      </View>)}
      {kind === 'risk' && <>
        <FilterChipGroup wrap value={scale} options={Object.entries(RISK_SCALES).map(([key, s]) => ({ key, label: s.label }))}
          onChange={locked ? undefined : key => { setScale(key as RiskScale); setScores([]); }} />
        <Text style={styles.muted}>Punkte aus der in deiner Einrichtung verwendeten Skala übernehmen. Niedrigere Punktwerte stehen für ein höheres Risiko.</Text>
        {(age == null || age < 18) && <InfoBanner variant="warning" message="Diese Skalen sind hier für Erwachsene vorgesehen. Maßgeblich sind das Geburtsdatum in der Klientenakte und der Beobachtungszeitpunkt." />}
        <View style={styles.row}>
          {RISK_SCALES[scale].domains.map(([label, maximum], index) => <View key={label} style={[styles.field, styles.panel]}>
            <Text style={styles.title}>{label}</Text>
            <FilterChipGroup wrap value={String(scores[index] ?? '')} options={Array.from({ length: maximum }, (_, i) => ({ key: String(i + 1), label: String(i + 1) }))}
              onChange={locked ? undefined : key => setScores(previous => {
                const updated = Array.from({ length: RISK_SCALES[scale].domains.length }, (_, i) => previous[i] ?? 0);
                updated[index] = Number(key);
                return updated;
              })} />
          </View>)}
        </View>
        <Text style={styles.value}>{total == null ? '—' : total} / {scale === 'braden' ? '23' : '20'} Punkte</Text>
        {input('assessment', 'Fachliche Beurteilung und Risikofaktoren')}
        {input('plan', 'Individuell geplante Prophylaxe und Kontrolle')}
      </>}
      {kind === 'diabetic_foot' && choices('side', FOOT_SIDE_LABELS)}
      {kind === 'tracheostomy' && choices('mode', TRACHEOSTOMY_LABELS)}
      {(kind === 'anamnesis' || kind === 'diabetic_foot' || kind === 'tracheostomy') &&
        <View style={styles.row}>{CLINICAL_FIELDS[kind].map(([key, label]) => <View key={key} style={styles.field}>{input(key, label)}</View>)}</View>}
      {kind === 'anamnesis' && <>
        <View style={styles.row}>
          {([['heightCm', 'Größe in cm'], ['weightKg', 'Gewicht in kg'], ['vas', 'Visuelle Analogskala · 0 bis 100 mm']] as const)
            .map(([key, label]) => <View key={key} style={styles.field}>{input(key, label, true)}</View>)}
        </View>
        <Text style={styles.text}>BMI {bmi == null ? '—' : formatWoundNumber(bmi, 1) + ' kg/m²'}</Text>
        <Text style={styles.title}>Dokumentierte Einflussfaktoren</Text>
        <View style={styles.row}>{Object.entries(COMPLICATING_FACTORS).map(([key, label]) => {
          const chosen = factors.includes(key);
          return <Pressable key={key} disabled={locked} accessibilityRole="checkbox" accessibilityState={{ checked: chosen, disabled: locked }}
            style={styles.panel} onPress={() => setFactors(prev => chosen ? prev.filter(value => value !== key) : [...prev, key])}>
            <Text style={styles.text}>{chosen ? '✓ ' : '＋ '}{label}</Text>
          </Pressable>;
        })}</View>
      </>}
      {kind === 'material' && <>
        {choices('mode', MATERIAL_LABELS)}
        <WoundCatalogPanel scope={scope} kind="article" embedded edit disabled={locked} onInsert={copyArticle} />
        <View style={styles.row}>{MATERIAL.map(([key, label]) => <View key={key} style={styles.field}>
          {input(key, label, ['quantity', 'price'].includes(key), false)}</View>)}</View>
      </>}
      {!!error && <ErrorState message={error} />}
      <View style={styles.row}>
        <PremiumButton title="Eintrag in der Akte speichern" onPress={save} disabled={locked || (kind === 'risk' && (age == null || age < 18))} />
        <PremiumButton title="Eingabe schließen" variant="secondary" onPress={onClose} disabled={locked} />
      </View>
    </View>
  </SectionPanel>;
}
