import { useId, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { InfoBanner, PremiumInput } from '@/components/ui';
import {
  currentMedicationEventTime, type MedicationEventTime,
} from '@/components/pflege/MedicationEventTimeInput.web';
import { VitalAction, VitalPills, useVitalStyles } from './VitalWorkspaceUi';
import { berlinEventCandidates, berlinEventInput } from '@/lib/pflege/medicationAdministrationDomain';
import type { VitalSignDefinition } from '@/lib/pflege/vitalCatalog';
import { vitalCatalogUnit, vitalContextOptions, vitalScoreChoices } from '@/lib/pflege/vitalCaptureOptions';
import { deriveVitalValues, parseVitalNumber, requiredVitalComponents } from '@/lib/pflege/vitalMeasurementDomain';
import { VitalMeasurementArtwork } from './VitalMeasurementArtwork';

const hourKeys = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const signedMeasurements = new Set(['base_excess', 'cvp', 'icp', 'cpp', 'peep', 'peak_airway_pressure', 'plateau_pressure']);
const minuteKeys = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

export function VitalCaptureTime({ value, onChange, disabled }: {
  value: MedicationEventTime;
  onChange(value: MedicationEventTime): void;
  disabled: boolean;
}) {
  const styles = useVitalStyles();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const candidates = useMemo(() => berlinEventCandidates(value.date, value.time), [value.date, value.time]);
  const displayDate = value.date.split('-').reverse().join('.');
  const update = (update: Partial<MedicationEventTime>) => onChange({ ...value, selected: '', ...update });
  const yesterday = () => {
    const now = currentMedicationEventTime();
    // Step back one calendar day in Berlin, independent of the browser zone or DST.
    const previous = new Date(now.date + 'T12:00:00Z');
    previous.setUTCDate(previous.getUTCDate() - 1);
    update({ date: berlinEventInput(previous).date });
  };
  const [hour = '', minute = ''] = value.time.split(':');
  return <View style={styles.stack}>
    <Text style={styles.label}>Messzeit · Berlin</Text>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Messzeit ändern. ${displayDate} ${value.time}`}
        accessibilityState={{ expanded: expanded && !disabled, disabled }} disabled={disabled}
        onPress={() => setExpanded(!expanded)} style={[styles.caseButton, styles.flex, disabled && styles.disabled]}>
        <View style={styles.caseIcon}><MaterialCommunityIcons name="clock-outline" size={20} color="#13648A" /></View>
        <Text style={[styles.caseLabel, styles.flex]}>{displayDate} · {value.time} Uhr</Text>
        <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color="#386480" />
      </Pressable>
      <VitalAction title="Jetzt" icon="clock-check-outline" variant="secondary" disabled={disabled}
        onPress={() => onChange(currentMedicationEventTime())} />
    </View>
    {expanded && !disabled ? <View style={styles.caseResults}>
      <View style={styles.row}>
        <VitalAction variant="secondary" title="Heute" onPress={() => update({ date: currentMedicationEventTime().date })} />
        <VitalAction variant="secondary" title="Gestern" onPress={yesterday} />
      </View>
      {Platform.OS === 'web' ? <View style={styles.numericFields}>
        <View style={styles.numericField}>
          <label htmlFor={id + '-date'} style={timeStyles.label}>Datum</label>
          <input type="date" id={id + '-date'} value={value.date} max={currentMedicationEventTime().date} lang="de-DE" required
            onChange={event => update({ date: event.currentTarget.value })} style={timeStyles.input} />
        </View>
        <View style={styles.numericField}>
          <label htmlFor={id + '-time'} style={timeStyles.label}>Uhrzeit</label>
          <input type="time" id={id + '-time'} value={value.time} lang="de-DE" required
            onChange={event => update({ time: event.currentTarget.value })} style={timeStyles.input} />
        </View>
      </View> : <>
        <PremiumInput label="Datum" accessibilityLabel="Messdatum (JJJJ-MM-TT)" placeholder="JJJJ-MM-TT"
          value={value.date} keyboardType="numbers-and-punctuation" onChangeText={date => update({ date })} />
        <View style={styles.numericFields}>
          <View style={styles.numericField}>
            <label htmlFor={id + '-hour'} style={timeStyles.label}>Stunde</label>
            <select id={id + '-hour'} value={hour} style={timeStyles.input}
              onChange={event => update({ time: event.currentTarget.value + ':' + minute })}>
              {hourKeys.map(key => <option key={key} value={key}>{key}</option>)}
            </select>
          </View>
          <View style={styles.numericField}>
            <label htmlFor={id + '-minute'} style={timeStyles.label}>Minute</label>
            <select id={id + '-minute'} value={minute} style={timeStyles.input}
              onChange={event => update({ time: hour + ':' + event.currentTarget.value })}>
              {minuteKeys.map(key => <option key={key} value={key}>{key}</option>)}
            </select>
          </View>
        </View>
      </>}
    </View> : null}
    {!candidates.length ? <Text accessibilityRole="alert" style={styles.body}>Bitte gültiges Datum und Uhrzeit wählen.</Text> : null}
    {candidates.length > 1 ? <>
      <Text style={styles.label}>Uhrzeit bei Zeitumstellung</Text>
      <VitalPills label="Uhrzeit" disabled={disabled} options={candidates.map(key => ({
        key, label: key.endsWith('+02:00') ? 'Sommerzeit (UTC+02)' : 'Winterzeit (UTC+01)',
      }))} value={value.selected} onChange={selected => onChange({ ...value, selected })} />
    </> : null}
  </View>;
}

const timeStyles = {
  label: { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#153951' },
  input: {
    width: '100%', boxSizing: 'border-box', minHeight: 44, border: '1px solid #B9D1E3',
    borderRadius: 10, backgroundColor: '#F6FAFE', padding: '6px 10px', fontSize: 15, color: '#0B354D', fontFamily: 'inherit',
  },
} as const;

type DraftFields = {
  values: Record<string, string>;
  context: Record<string, string>;
  note: string;
};

type CaseState = 'no-case' | 'checking' | 'unavailable' | 'disabled' | 'enabled';

function ContextChoice({ label, options, value, placeholder, onChange, disabled }: {
  label: string;
  options: readonly string[];
  value: string;
  placeholder?: string;
  onChange(value: string): void;
  disabled: boolean;
}) {
  const styles = useVitalStyles();
  const [custom, setCustom] = useState(() => !!value && !options.includes(value));
  return <View style={styles.stack}>
    <Text style={styles.label}>{label}</Text>
    <VitalPills label={label} value={custom ? 'custom' : value} disabled={disabled} options={[
      ...options.map(key => ({ key, label: key })), { key: 'custom', label: 'Eigene Angabe' },
    ]} onChange={choice => {
      setCustom(choice === 'custom');
      onChange(choice === 'custom' || choice === value ? '' : choice);
    }} />
    {custom ? <PremiumInput accessibilityLabel={label} placeholder={placeholder} value={value}
      maxLength={500} editable={!disabled} onChangeText={onChange} /> : null}
  </View>;
}

export function VitalCaptureFields({ definition, draft, caseState, locked, onChange, onChoose, autoFocus }: {
  definition: VitalSignDefinition | undefined;
  draft: DraftFields;
  caseState: CaseState;
  locked: boolean;
  onChange(next: DraftFields): void;
  onChoose?: () => void;
  autoFocus?: boolean;
}) {
  const styles = useVitalStyles();
  const [expanded, setExpanded] = useState(false);
  if (!definition) return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.heading}>Messung erfassen</Text>
    <Text style={styles.muted}>Messart aus der Schnellwahl oder dem gesamten Katalog wählen.</Text>
  </View>;

  const { key } = definition;
  const disabled = locked || caseState !== 'enabled';
  const setContext = (field: string, value: string) => onChange({ ...draft, context: { ...draft.context, [field]: value } });
  const numeric = Object.fromEntries(Object.entries(draft.values).flatMap(([field, value]) => {
    const parsed = parseVitalNumber(value);
    return parsed === null ? [] : [[field, parsed]];
  }));
  const derived = deriveVitalValues(key, numeric);
  const calculated = key === 'gcs' ? derived.total : key === 'fluid_balance' ? derived.balance : undefined;
  const components = definition.components.filter(component => !['total', 'balance'].includes(component.key));
  const required = requiredVitalComponents(definition);
  const details = (definition.contextFields ?? []).filter(field => field.key !== 'period' && !(key === 'pain_score' && field.key === 'scale'));
  const renderContext = (field: NonNullable<VitalSignDefinition['contextFields']>[number], requiredField = false) => {
    const label = field.label + (requiredField ? ' *' : '');
    const fieldOptions = vitalContextOptions[key]?.[field.key];
    if (fieldOptions) return <ContextChoice key={field.key} label={label} options={fieldOptions}
      placeholder={field.placeholder} value={draft.context[field.key] ?? ''} disabled={disabled}
      onChange={value => setContext(field.key, value)} />;
    return <PremiumInput key={field.key} label={label} value={draft.context[field.key] ?? ''}
      placeholder={field.placeholder} maxLength={500} editable={!disabled} onChangeText={value => setContext(field.key, value)} />;
  };

  return <View style={styles.panel}>
    <View style={styles.editorTitle}>
      <View style={styles.editorArtwork}><VitalMeasurementArtwork kind={key} size={74} /></View>
      <View style={styles.flex}>
        <Text accessibilityRole="header" style={styles.heading}>{definition.label}</Text>
        <Text style={styles.muted}>{vitalCatalogUnit(definition)}</Text>
      </View>
    </View>
    {onChoose ? <VitalAction title="Messart wechseln" icon="view-grid-outline" variant="secondary" onPress={onChoose} /> : null}
    {caseState !== 'enabled' ? <InfoBanner variant="info" message={caseState === 'no-case'
      ? 'Zum Erfassen bitte einen aktiven Pflegefall auswählen.'
      : caseState === 'checking' ? 'Messfreigabe für diesen Pflegefall wird geprüft.'
        : caseState === 'unavailable' ? 'Die Messfreigabe konnte nicht geladen werden.'
          : 'Diese Messart ist für den ausgewählten Pflegefall nicht freigegeben.'} /> : null}
    <View style={styles.numericFields}>
      {components.map((component, index) => {
        const scores = vitalScoreChoices(key, component.key);
        const unit = component.unit ? ` · ${component.unit}` : '';
        const label = key === 'pain_score' ? 'Schmerzintensität · NRS 0–10 *' : `${component.label}${unit}${required.includes(component.key) ? ' *' : ''}`;
        const update = (value: string) => onChange({
          ...draft, values: { ...draft.values, [component.key]: value },
          context: key === 'pain_score' ? { ...draft.context, scale: 'NRS' } : draft.context,
        });
        return <View key={component.key} style={[styles.numericField, scores && scoreStyles.full]}>
          {scores ? <View style={styles.stack}>
            <Text style={styles.label}>{label}</Text>
            <VitalPills label={label} disabled={disabled} options={scores.map(score => ({
              key: score, label: key === 'rass' && Number(score) > 0 ? '+' + score : score.replace('-', '−'),
            }))} value={draft.values[component.key] ?? ''} onChange={update} />
          </View> : <PremiumInput label={label} accessibilityLabel={label} value={draft.values[component.key] ?? ''}
            editable={!disabled} autoFocus={Platform.OS === 'web' && autoFocus && !disabled && index === 0}
            keyboardType={signedMeasurements.has(key) ? 'numbers-and-punctuation' : 'decimal-pad'}
            maxLength={18} style={styles.numeric} onChangeText={update} />}
        </View>;
      })}
    </View>
    {calculated !== undefined ? <View style={styles.result}>
      <Text style={styles.muted}>{key === 'gcs' ? 'Berechnete GCS-Summe' : 'Berechnete Bilanz · ml'}</Text>
      <Text accessibilityLiveRegion="polite" style={styles.value}>{new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 }).format(calculated)}</Text>
    </View> : null}
    {definition.contextFields?.filter(field => field.key === 'period').map(field => renderContext(field, true))}
    {key === 'fluid_balance' ? <View style={styles.stack}>
      <Text style={styles.label}>Erfassungsumfang *</Text>
      <VitalPills label="Erfassungsumfang" disabled={disabled} options={[
        { key: 'complete', label: 'Vollständig' }, { key: 'incomplete', label: 'Unvollständig' }, { key: 'unknown', label: 'Unbekannt' },
      ]} value={draft.context.completeness ?? ''} onChange={completeness => onChange({
        ...draft, context: { ...draft.context, completeness },
      })} />
      {draft.context.completeness && draft.context.completeness !== 'complete' ? <PremiumInput
        label="Fehlende Angaben / Einschränkung *" value={draft.context.incompleteReason ?? ''} editable={!disabled}
        onChangeText={value => setContext('incompleteReason', value)} maxLength={500} /> : null}
    </View> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
      onPress={() => setExpanded(!expanded)} style={styles.caseButton}>
      <MaterialCommunityIcons name="clipboard-text-outline" size={19} color="#13648A" />
      <Text style={[styles.label, styles.flex]}>Messdetails und Notiz</Text>
      <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color="#386480" />
    </Pressable>
    {expanded ? <View style={styles.stack}>
      {details.map(field => renderContext(field))}
      <PremiumInput label="Beobachtung, Messbedingungen und Reaktion" accessibilityLabel="Messnotiz"
        value={draft.note} editable={!disabled} maxLength={4000} multiline onChangeText={note => onChange({ ...draft, note })} />
    </View> : null}
  </View>;
}

const scoreStyles = StyleSheet.create({ full: { flexBasis: '100%' } });
