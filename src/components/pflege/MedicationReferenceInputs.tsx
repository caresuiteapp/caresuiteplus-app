import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { PremiumInput } from '@/components/ui/PremiumInput';
import { radius, spacing, typography, useLegacyTheme } from '@/theme';
import {
  PRACTICE_STATES,
  saveManualPhysician,
  searchAuthorizedMedicines,
  searchMedicationPackages,
  searchNationalPracticeLocations,
  searchPhysicians,
  searchPracticeLocations,
  type AuthorizedMedicine,
  type MedicationPackageOption,
  type PhysicianOption,
  type PracticeLocationOption,
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
    source: { gap: spacing.xs, borderTopColor: colors.borderStrong, borderTopWidth: 1, paddingTop: spacing.sm },
    reference: { gap: spacing.xs, borderRadius: radius.md, backgroundColor: colors.bgInput, padding: spacing.sm },
    sourceLink: { minHeight: 44, maxWidth: '100%', flexShrink: 1, justifyContent: 'center', paddingHorizontal: spacing.xs },
    linkLabel: { ...typography.caption, color: colors.primary, textDecorationLine: 'underline' },
  }), [colors]);
}

const RVR_SOURCE = 'rvr-ruhr-praxis';
const FAIR_SOURCE = 'fair-iop-2024';
const EMA_SOURCE = 'ema-article57';
const OSM_SOURCE = 'osm-de-praxis';
const NATIONAL_PHYSICIAN_DIRECTORY = 'https://gesund.bund.de/suchen/aerztinnen-und-aerzte';

const directorySourceDetails = {
  [OSM_SOURCE]: {
    label: '© OpenStreetMap-Mitwirkende',
    notice: 'Praxisstandorte aus OpenStreetMap. Die Abdeckung ist je nach Ort unterschiedlich. Der Zeitstempel nennt die letzte Kartenbearbeitung. Bundesländer und Gemeinden: © BKG 2026, VG250 (Daten bearbeitet).',
    links: [
      { label: 'OpenStreetMap und Datenlizenz', url: 'https://www.openstreetmap.org/copyright' },
      { label: 'BKG-Datenquellen', url: 'https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf' },
      { label: 'Lizenz BKG dl-de/by-2-0', url: 'https://www.govdata.de/dl-de/by-2-0' },
      { label: 'Deutschland-Datenauszug (ODbL)', url: 'https://www.caresuiteplus.app/open-data/osm-praxen-deutschland-2026-11-12.zip' },
    ],
  },
  [RVR_SOURCE]: {
    label: '© Regionalverband Ruhr',
    notice: 'Daten bearbeitet. Die Praxisstandorte können älter sein. Adresse und Kontaktdaten vor der Übernahme prüfen.',
    links: [
      { label: 'Datensatz des Regionalverbands Ruhr', url: 'https://daten.geoportal.ruhr/srv/api/records/4ed7b8fa-2249-4a27-b901-4de837c1b97d' },
      { label: 'Lizenz dl-de/by-2-0', url: 'https://www.govdata.de/dl-de/by-2-0' },
    ],
  },
  [FAIR_SOURCE]: {
    label: 'FAIR IOP Medication Database · Forschungsstand 2024',
    notice: 'Auswahl von Klinikpräparaten. Daten bearbeitet. PZN und Angaben mit der aktuellen Packung abgleichen.',
    creators: 'Eduardo Salgado, Raphael Heidepriem, Renate Delucchi Danhier, Eugenia Rinaldi, Akira-Sebastian Poncette, Iris Dahlhaus, Daniel Fürstenau, Felix Balzer, Sylvia Thun und Julian Sass',
    links: [
      { label: 'Datensatz FAIR IOP (DOI)', url: 'https://doi.org/10.6084/m9.figshare.26142688.v1' },
      { label: 'Lizenz CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    ],
  },
  [EMA_SOURCE]: {
    label: 'Quelle: Europäische Arzneimittel-Agentur (EMA)',
    notice: 'Auszug aus dem Artikel-57-Register. Die Zulassung sagt nichts über verfügbare Packungen aus. Die Einträge enthalten keine PZN und werden nicht in die Verordnung übernommen.',
    links: [{
      label: 'EMA-Datensatz zu Artikel 57',
      url: 'https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/data-medicines-iso-idmp-standards-post-authorisation/public-data-article-57-database',
    }],
  },
} as const;

function DirectorySourceAttribution({ source }: { source: string }) {
  const styles = useDirectoryStyles();
  if (source !== RVR_SOURCE && source !== FAIR_SOURCE && source !== EMA_SOURCE && source !== OSM_SOURCE) return null;
  const info = directorySourceDetails[source];
  return <View style={styles.source}>
    <Text style={styles.heading}>{info.label}</Text>
    <Text style={styles.caption}>{info.notice}</Text>
    {'creators' in info ? <Text style={styles.caption}>{info.creators}</Text> : null}
    <View style={styles.choices}>{info.links.map(({ label, url }) => <Pressable key={url} accessibilityRole="link"
      style={styles.sourceLink} onPress={() => { void Linking.openURL(url).catch(() => undefined); }}>
      <Text style={styles.linkLabel}>{label}</Text>
    </Pressable>)}</View>
  </View>;
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

function DirectorySearch<T extends { source: string }>({
  tenantId, enabled, canEditNow, search, label, placeholder, empty, itemKey, describe, selectedKey, onPick,
  extra, source, activeDetails, onQueryChange,
}: DirectoryAccess & {
  search: (tenant: string, needle: string) => Promise<ServiceResult<T[]>>;
  label: string; placeholder: string; empty: string;
  itemKey: (item: T) => string;
  describe: (item: T) => { title: string; detail: string };
  selectedKey?: string;
  onPick: (item: T) => void;
  extra?: ReactNode;
  source?: string;
  activeDetails?: (item: T) => ReactNode;
  onQueryChange?: () => void;
}) {
  const styles = useDirectoryStyles();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const { current, retry } = useDirectorySearch(tenantId, enabled, query, search);
  const displayed = current?.rows.slice(0, expanded ? 30 : 8) ?? [];
  const sources = new Set([...displayed.map(item => item.source), ...(source ? [source] : [])]);
  const searchState = useRef({ query, current, enabled, canEditNow });
  searchState.current = { query, current, enabled, canEditNow };
  const status = query.trim().length < 2 ? 'Mindestens zwei Zeichen eingeben.'
    : !current || current.state === 'loading' ? 'Verzeichnis wird durchsucht …'
    : current.state === 'error' ? 'Das Verzeichnis ist derzeit nicht verfügbar. Die manuelle Eingabe bleibt möglich.'
    : current.rows.length === 0 ? empty
    : `${current.rows.length} Treffer. ${activeDetails ? 'Eintrag für Details öffnen.' : 'Wählen Sie den passenden Eintrag.'}`;
  return <View style={styles.panel}>
    <PremiumInput label={label} accessibilityLabel={label} value={query} placeholder={placeholder} autoComplete="off"
      maxLength={120} editable={enabled} onChangeText={(value) => {
        if (!canEditNow()) return;
        searchState.current = { ...searchState.current, query: value, current: null };
        setQuery(value); setExpanded(false); onQueryChange?.();
      }} />
    {enabled ? <Text accessibilityLiveRegion="polite" style={styles.caption}>{status}</Text> : null}
    {current?.state === 'error' && <PremiumButton title="Suche wiederholen" variant="ghost" size="sm" disabled={!enabled} onPress={retry} />}
    {[...sources].map(item => <DirectorySourceAttribution key={item} source={item} />)}
    {current?.state === 'ready' && displayed.length > 0 ? <View style={styles.list}>
      {displayed.map((item) => {
        const itemId = itemKey(item);
        return <View key={itemId} style={styles.list}>
          <ResultButton {...describe(item)} selected={selectedKey === itemId} disabled={!enabled} onPress={() => {
              const live = searchState.current;
              if (!live.enabled || !live.canEditNow() || live.current !== current || !current.rows.includes(item)) return;
              onPick(item);
            }} />
          {selectedKey === itemId ? activeDetails?.(item) : null}
        </View>;
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
    [item.source === FAIR_SOURCE ? 'FAIR IOP · Forschungsbestand 2024' : item.source, item.sourceVersion].filter(Boolean).join(' · ')].filter(Boolean).join(' · '),
});
const authorizedMedicineKey = (item: AuthorizedMedicine) => item.id;
const authorizationScope = (item: AuthorizedMedicine) => item.authorizationScope === 'EU' ? 'EU-Zulassung' : 'Zulassung in Deutschland';
const describeAuthorization = (item: AuthorizedMedicine) => ({
  title: item.name,
  detail: [authorizationScope(item), item.activeSubstance ? `Wirkstoff: ${item.activeSubstance}` : null].filter(Boolean).join(' · '),
});
const describePhysician = (item: PhysicianOption) => ({
  title: item.displayName,
  detail: [item.practiceName, item.specialty, item.street, [item.postalCode, item.city].filter(Boolean).join(' '),
    item.lanr ? `LANR ${item.lanr}` : null, item.bsnr ? `BSNR ${item.bsnr}` : null,
    item.source === 'manual' ? 'Eigenes Verzeichnis' : item.source].filter(Boolean).join(' · '),
});
const physicianKey = (item: PhysicianOption) => item.id;
const practiceLocationKey = (item: PracticeLocationOption) => item.id;
const practiceRecordDate = (value: string | null) => {
  if (!value) return 'Stand des Eintrags unbekannt';
  const [year, month, day] = value.split('-');
  return `Stand des Eintrags: ${day}.${month}.${year}`;
};
const describePracticeLocation = (item: PracticeLocationOption) => ({
  title: item.displayName,
  detail: ['Praxisstandort', item.practiceName !== item.displayName ? item.practiceName : null, item.specialty,
    item.street, [item.postalCode, item.city].filter(Boolean).join(' '), item.stateName, practiceRecordDate(item.sourceUpdatedAt),
    'Praxisdaten für eigenen Kontakt übernehmen'].filter(Boolean).join(' · '),
});

export function MedicationPackagePicker({ selectedKey, onPick, ...access }: DirectoryAccess & {
  selectedKey?: string; onPick: (item: MedicationPackageOption) => void;
}) {
  const [directory, setDirectory] = useState<'package' | 'authorization' | null>(null);
  const styles = useDirectoryStyles();
  return <View style={styles.list}>
    <View style={styles.choices}>
      <PremiumButton title={directory === 'package' ? 'Präparatesuche schließen' : 'Präparat im Verzeichnis suchen'}
        variant="secondary" disabled={!access.enabled} onPress={() => setDirectory(directory === 'package' ? null : 'package')} />
      <PremiumButton title={directory === 'authorization' ? 'Zulassungssuche schließen' : 'Zugelassene Arzneimittel suchen'}
        variant="secondary" disabled={!access.enabled} onPress={() => setDirectory(directory === 'authorization' ? null : 'authorization')} />
    </View>
    {directory === 'package' && access.enabled ? <DirectorySearch {...access} search={searchMedicationPackages} itemKey={medicationPackageKey}
      label="Präparatesuche" placeholder="PZN, Präparat, Marke, Hersteller oder Darreichungsform"
      empty="Keine Treffer im verfügbaren Verzeichnis. Suche verfeinern oder Präparat manuell erfassen."
      selectedKey={selectedKey} describe={describePackage} onPick={(item) => { onPick(item); setDirectory(null); }} /> : null}
    {directory === 'authorization' && access.enabled ? <AuthorizedMedicineLookup key={access.tenantId} {...access} /> : null}
    {directory !== 'package' && selectedKey?.startsWith(`${FAIR_SOURCE}:`) ? <DirectorySourceAttribution source={FAIR_SOURCE} /> : null}
  </View>;
}

function AuthorizedMedicineLookup(access: DirectoryAccess) {
  const [activeId, setActiveId] = useState<string>();
  const styles = useDirectoryStyles();
  return <DirectorySearch {...access} search={searchAuthorizedMedicines} itemKey={authorizedMedicineKey}
    label="Zulassungssuche" placeholder="Arzneimittelname, Wirkstoff oder Zulassungsinhaber"
    empty="Keine passende Zulassung im verfügbaren EMA-Datenstand. Prüfen Sie den Suchbegriff."
    describe={describeAuthorization} source={EMA_SOURCE} selectedKey={activeId}
    onQueryChange={() => setActiveId(undefined)} onPick={(item) => setActiveId(activeId === item.id ? undefined : item.id)}
    activeDetails={(item) => <View style={styles.reference}>
      <Text accessibilityRole="header" style={styles.heading}>Zulassungseintrag · Nur zur Ansicht</Text>
      <Text style={styles.body}>{item.name}</Text>
      <Text style={styles.caption}>{authorizationScope(item)}</Text>
      {item.activeSubstance ? <Text style={styles.caption}>Wirkstoff: {item.activeSubstance}</Text> : null}
      {item.authorizationHolder ? <Text style={styles.caption}>Zulassungsinhaber: {item.authorizationHolder}</Text> : null}
      <Text style={styles.caption}>EMA-Datenstand: {item.sourceVersion}</Text>
    </View>} />;
}

function NewPhysicianForm({ tenantId, enabled, canEditNow, prescribedBy, onSaved, practice }: DirectoryAccess & {
  prescribedBy: string; onSaved: (item: PhysicianOption) => void; practice?: PracticeLocationOption;
}) {
  const styles = useDirectoryStyles();
  const [draft, setDraft] = useState(() => ({
    displayName: practice ? '' : prescribedBy, practiceName: practice?.practiceName ?? practice?.displayName ?? '', specialty: practice?.specialty ?? '',
    postalCode: practice?.postalCode ?? '', city: practice?.city ?? '', street: practice?.street ?? '', phone: practice?.phone ?? '',
  }));
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
    {practice ? <>
      <Text style={styles.caption}>{practiceRecordDate(practice.sourceUpdatedAt)}. Praxisdaten prüfen und den Namen der verordnenden Person selbst eintragen.</Text>
      <DirectorySourceAttribution source={practice.source} />
    </> : null}
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
  const [directory, setDirectory] = useState<'physicians' | 'ruhr' | 'national'>('physicians');
  const [state, setState] = useState<string | null>(null);
  const [statePicker, setStatePicker] = useState(false);
  const searchNational = useCallback((tenant: string, query: string) => searchNationalPracticeLocations(tenant, query, state), [state]);
  const [practice, setPractice] = useState<PracticeLocationOption | undefined>(undefined);
  const clearDraft = () => { setCreating(false); setPractice(undefined); };
  const switchDirectory = (next: typeof directory) => {
    if (!access.canEditNow()) return;
    clearDraft(); setDirectory(next); setStatePicker(false);
  };
  const pick = (item: PhysicianOption) => {
    if (!access.canEditNow() || item.source === RVR_SOURCE || item.source === OSM_SOURCE) return;
    onPick(item); clearDraft(); setOpen(false);
  };
  const manualEntry = <PremiumButton title={creating ? 'Eigenen Eintrag schließen' : 'Eigenen Verzeichniseintrag anlegen'} variant="ghost" size="sm"
    disabled={!access.enabled} onPress={() => { if (access.canEditNow()) { setPractice(undefined); setCreating(!creating); } }} />;
  return <View style={styles.list}>
    <PremiumButton title={open ? 'Arztsuche schließen' : 'Ärztin oder Arzt suchen'} variant="secondary" disabled={!access.enabled}
      onPress={() => { setOpen(!open); setDirectory('physicians'); setStatePicker(false); clearDraft(); }} />
    {open && access.enabled ? <>
      <View style={styles.choices}>
        {directory !== 'physicians' ? <PremiumButton title="Zur Arztsuche" variant="ghost" size="sm" onPress={() => switchDirectory('physicians')} /> : null}
        {directory !== 'national' ? <PremiumButton title="Praxissuche Deutschland" variant="ghost" size="sm" onPress={() => switchDirectory('national')} /> : null}
        {directory !== 'ruhr' ? <PremiumButton title="Praxissuche Ruhrgebiet" variant="ghost" size="sm" onPress={() => switchDirectory('ruhr')} /> : null}
      </View>
      {directory !== 'physicians' && practice ? <PremiumButton title="Andere Praxis suchen" variant="ghost" size="sm"
        onPress={() => { if (access.canEditNow()) clearDraft(); }} />
      : directory === 'national' ? <>
        <PremiumButton title={`Bundesland: ${PRACTICE_STATES.find(([code]) => code === state)?.[1] ?? 'Alle'}`} variant="secondary" size="sm"
          onPress={() => { if (access.canEditNow()) setStatePicker(!statePicker); }} />
        {statePicker ? <View style={styles.choices}>
          <ResultButton title="Alle Bundesländer" selected={!state} disabled={!access.enabled} onPress={() => { if (access.canEditNow()) { setState(null); setStatePicker(false); } }} />
          {PRACTICE_STATES.map(([code, name]) => <ResultButton key={code} title={name} selected={state === code} disabled={!access.enabled}
            onPress={() => { if (access.canEditNow()) { setState(code); setStatePicker(false); } }} />)}
        </View> : null}
        <DirectorySearch key={`national:${state ?? ''}`} {...access} search={searchNational} itemKey={practiceLocationKey}
          label="Praxissuche Deutschland" placeholder="Praxisname, Ort, PLZ oder Fachrichtung"
          empty="Keine passenden kartierten Standorte gefunden. Prüfen Sie Schreibweise, Ort oder Bundesland."
          describe={describePracticeLocation} source={OSM_SOURCE} onPick={(item) => {
            if (!access.canEditNow() || item.source !== OSM_SOURCE) return;
            setPractice(item); setCreating(true); setStatePicker(false);
          }} extra={manualEntry} />
      </> : directory === 'ruhr' ? <DirectorySearch key="practices" {...access} search={searchPracticeLocations} itemKey={practiceLocationKey}
        label="Praxissuche Ruhrgebiet" placeholder="Praxis, Fachgebiet, PLZ oder Ort"
        empty="Keine Praxisstandorte gefunden. Suchbegriff verfeinern oder eigenen Eintrag anlegen."
        describe={describePracticeLocation} source={RVR_SOURCE} onPick={(item) => {
          if (!access.canEditNow() || item.source !== RVR_SOURCE) return;
          setPractice(item); setCreating(true);
        }} extra={manualEntry} />
      : <DirectorySearch key="physicians" {...access} search={searchPhysicians} itemKey={physicianKey}
        label="Arztsuche" placeholder="Name, Praxis, Fachgebiet oder Ort"
        empty="Keine Treffer im verfügbaren Verzeichnis. Die Angabe kann auch manuell erfasst werden."
        selectedKey={selectedId} describe={describePhysician} onPick={pick}
        extra={manualEntry} />}
      {creating ? <NewPhysicianForm key={practice?.id ?? 'manual'} {...access} prescribedBy={prescribedBy} onSaved={pick} practice={practice} /> : null}
      <Pressable accessibilityRole="link" style={styles.sourceLink}
        onPress={() => { if (access.canEditNow()) void Linking.openURL(NATIONAL_PHYSICIAN_DIRECTORY).catch(() => undefined); }}>
        <Text style={styles.linkLabel}>Bundesweite Arztsuche auf gesund.bund.de öffnen</Text>
      </Pressable>
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
