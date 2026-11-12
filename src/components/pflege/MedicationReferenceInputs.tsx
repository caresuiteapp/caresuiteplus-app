import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { PremiumInput } from '@/components/ui/PremiumInput';
import { radius, spacing, typography, useLegacyTheme } from '@/theme';
import {
  saveManualPhysician,
  searchMedicationPackages,
  searchPhysicians,
  type MedicationPackageOption,
  type PhysicianOption,
} from '@/lib/pflege/medicationMasterData';
import type { ServiceResult } from '@/types';

type DirectoryAccess = { tenantId: string; enabled: boolean; canEditNow: () => boolean };
type SearchState<T> = { key: string; state: 'loading' | 'ready' | 'error'; rows: T[] };

function useDirectorySearch<T>(
  tenantId: string, enabled: boolean, query: string,
  search: (tenant: string, needle: string) => Promise<ServiceResult<T[]>>,
) {
  const needle = query.trim();
  const key = JSON.stringify([tenantId, needle]);
  const ready = enabled && needle.length >= 2;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<SearchState<T> | null>(null);
  useEffect(() => {
    if (!ready) return;
    let current = true;
    setResult({ key, state: 'loading', rows: [] });
    const timer = setTimeout(() => {
      void Promise.resolve().then(() => search(tenantId, needle)).then(
        (next) => {
          if (current) setResult(next.ok
            ? { key, state: 'ready', rows: next.data }
            : { key, state: 'error', rows: [] });
        },
        () => { if (current) setResult({ key, state: 'error', rows: [] }); },
      );
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [attempt, key, needle, ready, search, tenantId]);
  return {
    current: ready && result?.key === key ? result : null,
    retry: () => setAttempt((value) => value + 1),
  };
}

function useDirectoryStyles() {
  const { colors } = useLegacyTheme();
  return useMemo(() => StyleSheet.create({
    panel: { gap: spacing.sm, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
    list: { gap: spacing.xs },
    action: { alignSelf: 'flex-start', maxWidth: '100%' },
    row: { minHeight: 48, gap: 3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.bgElevated, padding: spacing.sm },
    rowFocused: { borderColor: colors.primary, borderWidth: 2, padding: spacing.sm - 1 },
    rowPressed: { backgroundColor: colors.bgInput },
    body: { ...typography.body, color: colors.textPrimary },
    heading: { ...typography.label, color: colors.textPrimary },
    caption: { ...typography.caption, color: colors.textSecondary },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    active: { borderColor: colors.primary, backgroundColor: colors.bgInput },
    fields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    field: { flexBasis: 170, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  }), [colors]);
}

function ResultButton({ title, detail, selected, disabled, onPress }: {
  title: string; detail?: string; selected?: boolean; disabled: boolean; onPress: () => void;
}) {
  const styles = useDirectoryStyles();
  const [focused, setFocused] = useState(false);
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={[title, detail].filter(Boolean).join(', ')}
    accessibilityState={{ selected, disabled }}
    disabled={disabled}
    onFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)}
    onPress={onPress}
    style={({ pressed }) => [styles.row, selected && styles.active, pressed && styles.rowPressed, focused && styles.rowFocused]}
  >
    <Text style={styles.heading}>{title}</Text>
    {detail ? <Text style={styles.caption}>{detail}</Text> : null}
  </Pressable>;
}

function DirectorySearch<T>({
  tenantId, enabled, canEditNow, search, label, placeholder, empty, itemKey, describe, selectedKey, onPick, extra,
}: DirectoryAccess & {
  search: (tenant: string, needle: string) => Promise<ServiceResult<T[]>>;
  label: string; placeholder: string; empty: string;
  itemKey: (item: T) => string;
  describe: (item: T) => { title: string; detail: string };
  selectedKey?: string;
  onPick: (item: T) => void;
  extra?: ReactNode;
}) {
  const styles = useDirectoryStyles();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const { current, retry } = useDirectorySearch(tenantId, enabled, query, search);
  const displayed = current?.rows.slice(0, expanded ? 30 : 8) ?? [];
  const searchState = useRef({ query, current, enabled, canEditNow });
  searchState.current = { query, current, enabled, canEditNow };
  const status = query.trim().length < 2 ? 'Mindestens zwei Zeichen eingeben.'
    : !current || current.state === 'loading' ? 'Verzeichnis wird durchsucht …'
    : current.state === 'error' ? 'Das Verzeichnis ist derzeit nicht verfügbar. Die manuelle Eingabe bleibt möglich.'
    : current.rows.length === 0 ? empty
    : `${current.rows.length} Treffer. Wählen Sie den passenden Eintrag.`;
  return <View style={styles.panel}>
    <PremiumInput label={label} accessibilityLabel={label} value={query} placeholder={placeholder} autoComplete="off"
      maxLength={120} editable={enabled} onChangeText={(value) => {
        if (!canEditNow()) return;
        searchState.current = { ...searchState.current, query: value, current: null };
        setQuery(value); setExpanded(false);
      }} />
    {enabled ? <Text accessibilityLiveRegion="polite" style={styles.caption}>{status}</Text> : null}
    {current?.state === 'error' && <PremiumButton title="Suche wiederholen" variant="ghost" size="sm" disabled={!enabled} onPress={retry} />}
    {current?.state === 'ready' && displayed.length > 0 ? <View style={styles.list}>
      {displayed.map((item) => {
        const itemId = itemKey(item);
        return <ResultButton key={itemId} {...describe(item)} selected={selectedKey === itemId} disabled={!enabled}
          onPress={() => {
            const live = searchState.current;
            if (!live.enabled || !live.canEditNow() || live.current !== current || !current.rows.includes(item)) return;
            onPick(item);
          }} />;
      })}
      {!expanded && current.rows.length > 8 ? <PremiumButton title="Weitere Treffer anzeigen" variant="ghost" size="sm"
        disabled={!enabled} onPress={() => setExpanded(true)} /> : null}
    </View> : null}
    {extra}
  </View>;
}

export const medicationPackageKey = (item: Pick<MedicationPackageOption, 'source' | 'pzn'>) => `${item.source}:${item.pzn}`;
const describePackage = (item: MedicationPackageOption) => ({
  title: item.name,
  detail: [`PZN ${item.pzn}`, item.strength, item.dosageForm, item.packageSize,
    item.brand ? `Marke: ${item.brand}` : null, item.manufacturer ? `Hersteller: ${item.manufacturer}` : null,
    item.ingredient ? `Wirkstoff: ${item.ingredient}` : null,
    [item.source, item.sourceVersion].filter(Boolean).join(' · ')].filter(Boolean).join(' · '),
});
const describePhysician = (item: PhysicianOption) => ({
  title: item.displayName,
  detail: [item.practiceName, item.specialty, item.street, [item.postalCode, item.city].filter(Boolean).join(' '),
    item.lanr ? `LANR ${item.lanr}` : null, item.bsnr ? `BSNR ${item.bsnr}` : null,
    item.source === 'manual' ? 'Eigenes Verzeichnis' : item.source].filter(Boolean).join(' · '),
});
const physicianKey = (item: PhysicianOption) => item.id;

export function MedicationPackagePicker({ selectedKey, onPick, ...access }: DirectoryAccess & {
  selectedKey?: string; onPick: (item: MedicationPackageOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const styles = useDirectoryStyles();
  return <View style={styles.list}>
    <PremiumButton title={open ? 'Präparatesuche schließen' : 'Präparat im Verzeichnis suchen'}
      variant="secondary" disabled={!access.enabled} onPress={() => setOpen(!open)} />
    {open && access.enabled ? <DirectorySearch {...access} search={searchMedicationPackages} itemKey={medicationPackageKey}
      label="Präparatesuche" placeholder="PZN, Präparat, Marke, Hersteller oder Darreichungsform"
      empty="Keine Treffer im verfügbaren Verzeichnis. Suche verfeinern oder Präparat manuell erfassen."
      selectedKey={selectedKey} describe={describePackage} onPick={(item) => { onPick(item); setOpen(false); }} /> : null}
  </View>;
}

function NewPhysicianForm({ tenantId, enabled, canEditNow, prescribedBy, onSaved }: DirectoryAccess & {
  prescribedBy: string; onSaved: (item: PhysicianOption) => void;
}) {
  const styles = useDirectoryStyles();
  const [draft, setDraft] = useState(() => ({ displayName: prescribedBy, practiceName: '', specialty: '', postalCode: '', city: '', street: '', phone: '' }));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const flight = useRef(false);
  const live = useRef({ tenantId, enabled, canEditNow, prescribedBy, onSaved });
  live.current = { tenantId, enabled, canEditNow, prescribedBy, onSaved };
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const edit = (field: keyof typeof draft, value: string) => {
    if (flight.current || !canEditNow()) return;
    setDraft((prior) => ({ ...prior, [field]: value }));
    setNotice('');
  };
  async function save() {
    if (!enabled || !canEditNow() || flight.current || !draft.displayName.trim()) return;
    flight.current = true;
    setBusy(true); setNotice('');
    const nameAtSave = prescribedBy;
    const current = () => alive.current && live.current.tenantId === tenantId && live.current.enabled && live.current.canEditNow();
    try {
      const result = await saveManualPhysician(tenantId, {
        displayName: draft.displayName.trim(), practiceName: draft.practiceName.trim(), specialty: draft.specialty.trim(),
        postalCode: draft.postalCode.trim(), city: draft.city.trim(), street: draft.street.trim(), phone: draft.phone.trim(),
      });
      if (!current()) return;
      if (!result.ok) { setNotice(result.error); return; }
      if (live.current.prescribedBy === nameAtSave) live.current.onSaved(result.data);
      else setNotice('Im eigenen Verzeichnis gespeichert. Die neuere Angabe in der Verordnung bleibt erhalten.');
    } catch {
      if (current()) setNotice('Der Verzeichniseintrag konnte nicht bestätigt werden. Bitte vor einem weiteren Speicherversuch im Verzeichnis suchen.');
    } finally {
      flight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const field = (key: keyof typeof draft, label: string, maxLength = 150) => <View style={styles.field}>
    <PremiumInput label={label} accessibilityLabel={label} value={draft[key]} editable={enabled && !busy} maxLength={maxLength}
      autoComplete="off" onChangeText={(value) => edit(key, value)} />
  </View>;
  return <View style={styles.panel}>
    <Text style={styles.heading}>Eigener Verzeichniseintrag</Text>
    <Text style={styles.caption}>Nur berufliche Kontaktdaten erfassen. Der Eintrag steht danach in der Suche dieses Unternehmens zur Verfügung.</Text>
    {field('displayName', 'Name der Ärztin oder des Arztes *')}
    <View style={styles.fields}>{field('practiceName', 'Praxis')}{field('specialty', 'Fachgebiet')}</View>
    {field('street', 'Praxisanschrift')}
    <View style={styles.fields}>{field('postalCode', 'Postleitzahl', 5)}{field('city', 'Ort')}{field('phone', 'Telefon der Praxis', 40)}</View>
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.caption}>{notice}</Text> : null}
    <PremiumButton title="Im Verzeichnis speichern und auswählen" variant="secondary" loading={busy} disabled={!enabled || !draft.displayName.trim()}
      onPress={() => { void save(); }} />
  </View>;
}

export function MedicationPhysicianPicker({ prescribedBy, selectedId, onPick, ...access }: DirectoryAccess & {
  prescribedBy: string; selectedId?: string; onPick: (item: PhysicianOption) => void;
}) {
  const styles = useDirectoryStyles();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const pick = (item: PhysicianOption) => {
    if (!access.canEditNow()) return;
    onPick(item); setCreating(false); setOpen(false);
  };
  return <View style={styles.list}>
    <PremiumButton title={open ? 'Arztsuche schließen' : 'Ärztin oder Arzt suchen'} variant="secondary" disabled={!access.enabled}
      onPress={() => { setOpen(!open); setCreating(false); }} />
    {open && access.enabled ? <>
      <DirectorySearch {...access} search={searchPhysicians} itemKey={physicianKey}
        label="Arztsuche" placeholder="Name, Praxis, Fachgebiet oder Ort"
        empty="Keine Treffer im verfügbaren Verzeichnis. Die Angabe kann auch manuell erfasst werden."
        selectedKey={selectedId} describe={describePhysician} onPick={pick}
        extra={<PremiumButton title={creating ? 'Eigenen Eintrag schließen' : 'Eigenen Verzeichniseintrag anlegen'} variant="ghost" size="sm"
          disabled={!access.enabled} onPress={() => { if (access.canEditNow()) setCreating(!creating); }} />} />
      {creating ? <NewPhysicianForm {...access} prescribedBy={prescribedBy} onSaved={pick} /> : null}
    </> : null}
  </View>;
}

const dosageForms = ['Tablette', 'Filmtablette', 'Retardtablette', 'Kapsel', 'Tropfen', 'Lösung', 'Suspension',
  'Saft', 'Sirup', 'Granulat', 'Pulver', 'Creme', 'Salbe', 'Gel', 'Pflaster', 'Suppositorium', 'Spray', 'Inhalat',
  'Injektionslösung', 'Infusionslösung', 'Augentropfen', 'Ohrentropfen', 'Nasentropfen'];
const routes = ['oral', 'sublingual', 'bukkal', 'über Sonde', 'kutan', 'transdermal', 'inhalativ',
  'nasal', 'am Auge', 'am Ohr', 'rektal', 'vaginal', 'subkutan', 'intramuskulär', 'intravenös'];
const doseUnits = ['mg', 'g', 'µg', 'ml', 'IE', 'Tropfen', 'Tablette', 'Kapsel', 'Hub', 'Stück'];

export function doseWithSelectedUnit(dose: string, unit: string): string | null {
  const number = dose.trim();
  return /^\d+(?:[.,]\d+)?$/.test(number) && doseUnits.includes(unit) ? `${number} ${unit}` : null;
}

export function MedicationOrderFieldOptions({ kind, value, enabled, onSelect }: {
  kind: 'form' | 'route' | 'dose'; value: string; enabled: boolean; onSelect: (value: string) => void;
}) {
  const styles = useDirectoryStyles();
  const [open, setOpen] = useState(false);
  const title = kind === 'form' ? 'Darreichungsform auswählen' : kind === 'route' ? 'Applikationsweg auswählen' : 'Einheit auswählen';
  const options = kind === 'form' ? dosageForms : kind === 'route' ? routes : doseUnits;
  const canPick = kind !== 'dose' || doseWithSelectedUnit(value, doseUnits[0]) !== null;
  return <View style={styles.list}>
    <PremiumButton title={open ? 'Auswahl schließen' : title} variant="ghost" size="sm"
      accessibilityLabel={open ? `${title}: Auswahl schließen` : title} disabled={!enabled} onPress={() => setOpen(!open)} />
    {open && enabled ? <View style={styles.panel}>
      <Text style={styles.caption}>{kind === 'dose'
        ? 'Zuerst nur die verordnete Zahl eingeben, danach die Einheit wählen. Bestehende Dosierungen mit Einheit und Freitext bleiben unverändert.'
        : 'Aus der Verordnung übernehmen oder das Feld manuell ausfüllen.'}</Text>
      <View style={styles.choices}>{options.map((option) => {
        const next = kind === 'dose' ? doseWithSelectedUnit(value, option) : option;
        return <ResultButton key={option} title={option} selected={next !== null && next === value} disabled={!canPick}
          onPress={() => { if (next !== null) { onSelect(next); setOpen(false); } }} />;
      })}</View>
    </View> : null}
  </View>;
}
