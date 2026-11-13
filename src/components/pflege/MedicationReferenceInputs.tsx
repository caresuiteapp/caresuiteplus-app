import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { PremiumInput } from '@/components/ui/PremiumInput';
import { radius, spacing, typography, useLegacyTheme } from '@/theme';
import {
  PRACTICE_STATES,
  PHYSICIAN_FIELD_LIMITS,
  practiceLocationToPhysicianDraft,
  saveManualPhysician,
  searchAuthorizedMedicines,
  searchMedicationPackages,
  searchNationalPracticeLocations,
  searchNationalPracticeLocationsPage,
  searchPhysicians,
  searchPracticeLocations,
  searchPracticeLocationsPage,
  type AuthorizedMedicine,
  type MedicationPackageOption,
  type PhysicianOption,
  type PracticeLocationOption,
} from '@/lib/pflege/medicationMasterData';
import type { ServiceResult } from '@/types';

type DirectoryAccess = { tenantId: string; enabled: boolean; canEditNow: () => boolean };
type SearchPage<T> = { rows: T[]; nextCursor: string | null; limited?: true };
type SearchPageReader<T> = (tenant: string, needle: string, after: string | null) => Promise<ServiceResult<SearchPage<T>>>;
type SearchState<T> = {
  key: string;
  state: 'loading' | 'ready' | 'error';
  rows: T[];
  nextCursor?: string | null;
  limited?: true;
};

function useDirectorySearch<T>(
  tenantId: string, enabled: boolean, query: string,
  search: (tenant: string, needle: string) => Promise<ServiceResult<T[]>>,
  searchPage: SearchPageReader<T> | undefined,
  itemKey: (row: T) => string,
) {
  const needle = query.trim();
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([tenantId, needle, attempt]);
  const ready = enabled && needle.length >= 2;
  const [result, setResult] = useState<SearchState<T> | null>(null);
  const [pageStatus, setPageStatus] = useState<{ key: string; busy?: true; error?: string } | null>(null);
  const generation = useRef<symbol | null>(null);
  const pagePending = useRef<symbol | null>(null);
  const current = ready && result?.key === key ? result : null;
  const scope = useRef({ ready, key });
  scope.current = { ready, key };

  useEffect(() => {
    if (!ready) { setResult(null); setPageStatus(null); return; }
    const request = Symbol();
    generation.current = request;
    setResult({ key, state: 'loading', rows: [] });
    setPageStatus(null);
    const timer = setTimeout(() => {
      const read = async (): Promise<ServiceResult<SearchPage<T>>> => {
        if (searchPage) return searchPage(tenantId, needle, null);
        const response = await search(tenantId, needle);
        return response.ok ? { ok: true, data: { rows: response.data, nextCursor: null } } : response;
      };
      void read().then(
        (next) => {
          if (generation.current === request) setResult(next.ok
            ? { key, state: 'ready', ...next.data }
            : { key, state: 'error', rows: [] });
        },
        () => { if (generation.current === request) setResult({ key, state: 'error', rows: [] }); },
      );
    }, 250);
    return () => {
      if (generation.current === request) generation.current = null;
      if (pagePending.current === request) pagePending.current = null;
      clearTimeout(timer);
    };
  }, [key, needle, ready, search, searchPage, tenantId]);

  async function loadMore() {
    const request = generation.current;
    const cursor = current?.nextCursor;
    if (!cursor || !searchPage || !request || pagePending.current) return;
    pagePending.current = request;
    setPageStatus({ key, busy: true });
    const active = () => generation.current === request && scope.current.ready && scope.current.key === key;
    try {
      const response = await searchPage(tenantId, needle, cursor);
      if (!active()) return;
      if (!response.ok || response.data.nextCursor === cursor) {
        setPageStatus({ key, error: response.ok ? 'Die weiteren Treffer konnten nicht gelesen werden.' : response.error });
        return;
      }
      const page = response.data;
      setResult(prior => {
        if (prior?.key !== key || prior.nextCursor !== cursor) return prior;
        const ids = new Set(prior.rows.map(itemKey));
        return { ...prior, rows: [...prior.rows, ...page.rows.filter(item => !ids.has(itemKey(item)))], nextCursor: page.nextCursor };
      });
      setPageStatus(null);
    } catch {
      if (active()) setPageStatus({ key, error: 'Die weiteren Treffer konnten nicht geladen werden. Bitte erneut versuchen.' });
    } finally {
      if (pagePending.current === request) pagePending.current = null;
    }
  }
  return {
    current, pageStatus: current && pageStatus?.key === key ? pageStatus : null, loadMore,
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
  extra, source, activeDetails, onQueryChange, initialQuery = '', attributionAfterResults = false, searchPage,
}: DirectoryAccess & {
  search: (tenant: string, needle: string) => Promise<ServiceResult<T[]>>;
  searchPage?: SearchPageReader<T>;
  label: string; placeholder: string; empty: string;
  itemKey: (item: T) => string;
  describe: (item: T) => { title: string; detail: string };
  selectedKey?: string;
  onPick: (item: T) => void;
  extra?: ReactNode;
  source?: string;
  activeDetails?: (item: T) => ReactNode;
  onQueryChange?: (value: string) => void;
  initialQuery?: string;
  attributionAfterResults?: boolean;
}) {
  const styles = useDirectoryStyles();
  const [query, setQuery] = useState(initialQuery);
  const [expanded, setExpanded] = useState(false);
  const { current, retry, pageStatus, loadMore } = useDirectorySearch(tenantId, enabled, query, search, searchPage, itemKey);
  const displayed = current ? (searchPage ? current.rows : current.rows.slice(0, expanded ? 30 : 8)) : [];
  const sources = new Set([...displayed.map(item => item.source), ...(source ? [source] : [])]);
  const attribution = [...sources].map(item => <DirectorySourceAttribution key={item} source={item} />);
  const searchState = useRef({ query, current, enabled, canEditNow });
  searchState.current = { query, current, enabled, canEditNow };
  const status = query.trim().length < 2 ? 'Mindestens zwei Zeichen eingeben.'
    : !current || current.state === 'loading' ? 'Verzeichnis wird durchsucht …'
    : current.state === 'error' ? 'Das Verzeichnis ist derzeit nicht verfügbar. Die manuelle Eingabe bleibt möglich.'
    : current.rows.length === 0 ? empty
    : current.limited ? 'Bis zu 30 Treffer. Grenze die Suche ein, um andere Ergebnisse zu finden.'
    : `${current.nextCursor ? `${current.rows.length} Treffer geladen. Weitere sind verfügbar.` : !searchPage && current.rows.length === 30 ? 'Die ersten 30 Treffer.' : `${current.rows.length} Treffer.`} ${activeDetails ? 'Eintrag für Details öffnen.' : 'Wähle den passenden Eintrag.'}`;
  return <View style={styles.panel}>
    <PremiumInput label={label} accessibilityLabel={label} value={query} placeholder={placeholder} autoComplete="off"
      maxLength={120} editable={enabled} onChangeText={(value) => {
        if (!canEditNow()) return;
        searchState.current = { ...searchState.current, query: value, current: null };
        setQuery(value); setExpanded(false); onQueryChange?.(value);
      }} />
    {enabled ? <Text accessibilityLiveRegion="polite" style={styles.caption}>{status}</Text> : null}
    {current?.state === 'error' && <PremiumButton title="Suche wiederholen" variant="ghost" size="sm" disabled={!enabled} onPress={retry} />}
    {!attributionAfterResults ? attribution : null}
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
      {!searchPage && !expanded && current.rows.length > 8 ? <PremiumButton title="Weitere Treffer anzeigen" variant="ghost" size="sm"
        disabled={!enabled} onPress={() => setExpanded(true)} /> : null}
      {current.nextCursor ? <View style={styles.list}>
        {pageStatus?.error ? <Text accessibilityLiveRegion="polite" style={styles.caption}>{pageStatus.error}</Text> : null}
        <PremiumButton title={pageStatus?.error ? 'Weitere Treffer erneut laden' : 'Weitere Treffer laden'} variant="secondary" size="sm"
          style={styles.action} loading={pageStatus?.busy} disabled={!enabled} onPress={() => {
            if (canEditNow() && searchState.current.current === current) void loadMore();
          }} />
      </View> : null}
    </View> : null}
    {extra}
    {attributionAfterResults ? attribution : null}
  </View>;
}

export const medicationPackageKey = (item: Pick<MedicationPackageOption, 'source' | 'pzn'>) => `${item.source}:${item.pzn}`;
const describePackage = (item: MedicationPackageOption) => ({
  title: item.name,
  detail: [`PZN ${item.pzn}`, item.strength, item.dosageForm, item.packageSize].filter(Boolean).join(' · '),
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
    item.phone ? `Tel. ${item.phone}` : null, item.lanr ? `LANR ${item.lanr}` : null,
    item.bsnr ? `BSNR ${item.bsnr}` : null].filter(Boolean).join(' · '),
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
    item.phone ? `Tel. ${item.phone}` : null].filter(Boolean).join(' · '),
});

export function MedicationPackagePicker({ selectedKey, onPick, ...access }: DirectoryAccess & {
  selectedKey?: string; onPick: (item: MedicationPackageOption) => void;
}) {
  const [directory, setDirectory] = useState<'package' | 'authorization' | null>(null);
  const styles = useDirectoryStyles();
  return <View style={styles.list}>
    <Text accessibilityRole="header" style={styles.heading}>Arzneimittelverzeichnisse</Text>
    <Text style={styles.body}>Die Packungssuche übernimmt Präparatedaten. Die EMA-Suche zeigt Zulassungen zur Ansicht.</Text>
    <View style={styles.choices}>
      <PremiumButton title={directory === 'package' ? 'Packungssuche zu' : 'Packung suchen'} size="sm"
        accessibilityLabel={directory === 'package' ? 'Packungssuche schließen' : 'Packung suchen: Präparat im Verzeichnis suchen'}
        variant="secondary" disabled={!access.enabled} onPress={() => setDirectory(directory === 'package' ? null : 'package')} />
      <PremiumButton title={directory === 'authorization' ? 'EMA-Suche zu' : 'EMA-Suche'} size="sm"
        accessibilityLabel={directory === 'authorization' ? 'EMA-Suche schließen' : 'EMA-Suche: Zugelassene Arzneimittel suchen'}
        variant="secondary" disabled={!access.enabled} onPress={() => setDirectory(directory === 'authorization' ? null : 'authorization')} />
    </View>
    {directory === 'package' && access.enabled ? <MedicationPackageLookup key={access.tenantId} {...access}
      onPick={(item) => { onPick(item); setDirectory(null); }} /> : null}
    {directory === 'authorization' && access.enabled ? <AuthorizedMedicineLookup key={access.tenantId} {...access} /> : null}
    {directory !== 'package' && selectedKey?.startsWith(`${FAIR_SOURCE}:`) ? <DirectorySourceAttribution source={FAIR_SOURCE} /> : null}
  </View>;
}

function MedicationPackageLookup({ onPick, ...access }: DirectoryAccess & { onPick: (item: MedicationPackageOption) => void }) {
  const [active, setActive] = useState<MedicationPackageOption>();
  const styles = useDirectoryStyles();
  return <DirectorySearch {...access} search={searchMedicationPackages} itemKey={medicationPackageKey}
    label="Präparatesuche" placeholder="PZN, Name, Wirkstoff, Marke oder Hersteller"
    empty="Keine Packung in diesem Verzeichnis gefunden. Präparat und Stärke können Sie anhand der Originalverordnung erfassen."
    selectedKey={active ? medicationPackageKey(active) : undefined} describe={describePackage} attributionAfterResults
    onQueryChange={() => setActive(undefined)} onPick={(item) => setActive(active === item ? undefined : item)}
    activeDetails={(item) => active === item ? <View style={styles.reference}>
      <Text accessibilityRole="header" style={styles.heading}>Packung prüfen</Text>
      <Text style={styles.body}>PZN {item.pzn}</Text>
      {[
        ['Wirkstoff', item.ingredient], ['Stärke', item.strength], ['Darreichungsform', item.dosageForm],
        ['Marke', item.brand], ['Hersteller', item.manufacturer], ['Packungsgröße', item.packageSize],
      ].map(([label, value]) => <Text key={label} style={styles.caption}>{label}: {value || 'Im Verzeichnis nicht hinterlegt'}</Text>)}
      <Text style={styles.caption}>Datenstand: {item.sourceVersion}</Text>
      <Text style={styles.caption}>Die Auswahl füllt die Präparatfelder neu. Dosierung, Applikationsweg und Gabezeiten bleiben unverändert.</Text>
      <PremiumButton title="Packung übernehmen" variant="primary" disabled={!access.enabled} onPress={() => {
        if (access.canEditNow()) onPick(item);
      }} />
    </View> : null} />;
}

function AuthorizedMedicineLookup(access: DirectoryAccess) {
  const [activeId, setActiveId] = useState<string>();
  const styles = useDirectoryStyles();
  return <DirectorySearch {...access} search={searchAuthorizedMedicines} itemKey={authorizedMedicineKey} attributionAfterResults
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

function usePhysicianStyles() {
  const { colors } = useLegacyTheme();
  return useMemo(() => StyleSheet.create({
    shell: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.bgElevated, padding: spacing.md, gap: spacing.md },
    flow: { gap: spacing.sm },
    hidden: { display: 'none' },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    headerText: { flex: 1, minWidth: 0, gap: 3 },
    icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgInput, flexShrink: 0 },
    title: { color: colors.textPrimary, fontSize: 17, lineHeight: 23, fontWeight: '700' },
    sectionTitle: { color: colors.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '700' },
    text: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
    help: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    label: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '600' },
    separator: { borderTopWidth: 1, borderTopColor: colors.borderStrong, paddingTop: spacing.sm },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.sm },
    cell: { flexBasis: 200, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    shortCell: { flexBasis: 132, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    longCell: { flexBasis: 240, flexGrow: 3, flexShrink: 1, minWidth: 0 },
    detailCell: { gap: 2, flexBasis: 145, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    fullField: { alignSelf: 'stretch', minWidth: 0 },
    filteredChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
    tab: { alignItems: 'center', flexDirection: 'row', minHeight: 44, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs,
      borderWidth: 1, borderRadius: radius.md, borderColor: colors.borderStrong, backgroundColor: colors.bgElevated, maxWidth: '100%', flexShrink: 1 },
    activeTab: { borderColor: colors.primary, backgroundColor: colors.bgInput },
    focus: { borderColor: colors.primary, borderWidth: 2, paddingHorizontal: spacing.sm - 1, paddingVertical: spacing.xs - 1 },
    tabLabel: { color: colors.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
    card: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.bgInput, padding: spacing.sm, gap: spacing.sm },
    link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', maxWidth: '100%' },
    linkText: { color: colors.primary, textDecorationLine: 'underline', fontSize: 13, lineHeight: 18 },
  }), [colors]);
}

type PhysicianIcon = 'user' | 'check-circle' | 'map-pin' | 'edit-3' | 'search' | 'navigation';
const PRACTICE_KIND = {
  physicians: { label: 'Eigenes Arztverzeichnis', icon: 'user', prompt: 'Suche nach einer bereits gespeicherten Ärztin oder einem Arzt. Der Kontakt kann direkt für die Verordnung ausgewählt werden.' },
  national: { label: 'Praxissuche Deutschland', icon: 'map-pin', prompt: 'Suche nach Praxisstandorten in Deutschland. Vorhandene Praxisdaten kannst du in deinen Arztkontakt übernehmen.' },
  ruhr: { label: 'Praxissuche Ruhrgebiet', icon: 'navigation', prompt: 'Regionaler Datenbestand für Praxisstandorte im Ruhrgebiet.' },
} as const;
type PracticeDirectory = keyof typeof PRACTICE_KIND;

function PhysicianHeading({ title, detail, icon }: { title: string; detail?: string; icon: PhysicianIcon }) {
  const styles = usePhysicianStyles();
  const { colors } = useLegacyTheme();
  return <View style={styles.header}>
    <View style={styles.icon} importantForAccessibility="no-hide-descendants" aria-hidden><Feather name={icon} size={18} color={colors.primary} /></View>
    <View style={styles.headerText}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {detail ? <Text style={styles.help}>{detail}</Text> : null}
    </View>
  </View>;
}

function PhysicianChoice({ title, icon, active, onPress }: {
  title: string; icon: PhysicianIcon; active: boolean; onPress: () => void;
}) {
  const styles = usePhysicianStyles();
  const { colors } = useLegacyTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }}
    style={({ pressed }) => [styles.tab, (active || pressed) && styles.activeTab, focused && styles.focus]}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={onPress}>
    <View importantForAccessibility="no-hide-descendants" aria-hidden><Feather name={icon} size={16} color={colors.primary} /></View>
    <Text style={styles.tabLabel}>{title}</Text>
  </Pressable>;
}

function PracticeWebsiteLink({ practice }: { practice: PracticeLocationOption }) {
  const styles = usePhysicianStyles();
  const url = practice.contactSourceUrl;
  if (!url || !url.startsWith('https://')) return null;
  return <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(url).catch(() => undefined); }} style={styles.link}>
    <Text style={styles.linkText}>Kontaktdaten: Praxiswebsite</Text>
  </Pressable>;
}

function ContactFacts({ facts, showMissing = false }: {
  facts: ReadonlyArray<readonly [string, string | null | undefined]>; showMissing?: boolean;
}) {
  const styles = usePhysicianStyles();
  const visible = showMissing ? facts : facts.filter(([, value]) => !!value);
  if (!visible.length) return null;
  return <View style={styles.grid}>{visible.map(([label, value]) => <View key={label} style={styles.detailCell}>
    <Text style={styles.label}>{label}</Text>
    <Text style={value ? styles.text : styles.help}>{value || 'Nicht in der Quelle enthalten'}</Text>
  </View>)}</View>;
}

function PracticePreview({ practice, onTransfer }: { practice: PracticeLocationOption; onTransfer: () => void }) {
  const styles = usePhysicianStyles();
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>Kontaktdaten des Praxisstandorts</Text>
    <ContactFacts showMissing facts={[
      ['Praxis', practice.practiceName || practice.displayName], ['Fachgebiet', practice.specialty], ['Straße und Hausnummer', practice.street],
      ['PLZ', practice.postalCode], ['Ort', practice.city], ['Telefon', practice.phone],
      ...(practice.stateName ? [['Bundesland', practice.stateName] as const] : []),
    ]} />
    <Text style={styles.help}>{practiceRecordDate(practice.sourceUpdatedAt)}. Der Praxisname bestätigt nicht, wer die Verordnung ausgestellt hat.</Text>
    <PracticeWebsiteLink practice={practice} />
    <View style={styles.actions}>
      <PremiumButton title="Praxisdaten übernehmen" size="sm" onPress={onTransfer} />
    </View>
  </View>;
}

function PhysicianSummary({ physician }: { physician: PhysicianOption }) {
  const styles = usePhysicianStyles();
  return <View style={styles.card}>
    <PhysicianHeading title={physician.displayName} detail="Für diese Verordnung ausgewählt" icon="check-circle" />
    <ContactFacts facts={[
      ['Praxis', physician.practiceName], ['Fachgebiet', physician.specialty],
      ['Anschrift', [physician.street, [physician.postalCode, physician.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
      ['Telefon', physician.phone], ['LANR', physician.lanr], ['BSNR', physician.bsnr],
    ]} />
  </View>;
}

function NewPhysicianForm({ tenantId, enabled, canEditNow, prescribedBy, onSaved, onCancel, practice }: DirectoryAccess & {
  prescribedBy: string; onSaved: (item: PhysicianOption) => void; onCancel: () => void; practice?: PracticeLocationOption;
}) {
  const styles = usePhysicianStyles();
  const [draft, setDraft] = useState(() => practice ? practiceLocationToPhysicianDraft(practice) : {
    displayName: prescribedBy, practiceName: '', specialty: '', postalCode: '', city: '', street: '', phone: '',
  });
  const source = practice ? practiceLocationToPhysicianDraft(practice) : null;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const postalCode = draft.postalCode.trim();
  const postalCodeError = postalCode && !/^\d{5}$/.test(postalCode) ? 'Die Postleitzahl muss fünf Ziffern haben.' : undefined;
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
    if (!enabled || !canEditNow() || flight.current || !draft.displayName.trim() || postalCodeError) return;
    flight.current = true;
    setBusy(true); setNotice('');
    const nameAtSave = prescribedBy;
    const current = () => alive.current && live.current.tenantId === tenantId && live.current.enabled && live.current.canEditNow();
    try {
      const result = await saveManualPhysician(tenantId, {
        displayName: draft.displayName.trim(), practiceName: draft.practiceName.trim(), specialty: draft.specialty.trim(),
        postalCode, city: draft.city.trim(), street: draft.street.trim(), phone: draft.phone.trim(),
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
  const field = (key: keyof typeof draft, label: string, size: 'fullField' | 'cell' | 'shortCell' | 'longCell' = 'fullField') => <View style={styles[size]}>
    <PremiumInput label={label} accessibilityLabel={label} value={draft[key]} editable={enabled && !busy}
      maxLength={PHYSICIAN_FIELD_LIMITS[key]} autoComplete="off"
      inputMode={key === 'postalCode' ? 'numeric' : key === 'phone' ? 'tel' : 'text'}
      placeholder={key === 'displayName' ? 'Name laut Verordnung' : undefined}
      hint={key === 'displayName' ? 'Name mit der Verordnung abgleichen.' : source && !source[key] && !draft[key] ? 'Nicht in der Quelle enthalten' : undefined}
      error={key === 'postalCode' ? postalCodeError : undefined}
      onChangeText={(value) => edit(key, value)} />
  </View>;
  return <View style={styles.flow}>
    <PhysicianHeading title={practice ? 'Praxisdaten prüfen und Arztkontakt ergänzen' : 'Arztkontakt anlegen'}
      detail={practice ? 'Die vorhandenen Angaben sind vorausgefüllt. Fehlende Angaben kannst du ergänzen.' : 'Der Kontakt bleibt im Verzeichnis dieses Unternehmens.'} icon="edit-3" />
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>1. Verordnende Person</Text>
      {field('displayName', 'Name der Ärztin oder des Arztes *')}
    </View>
    <View style={styles.flow}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>2. Praxis und Kontakt (optional)</Text>
      <View style={styles.grid}>{field('practiceName', 'Praxis', 'cell')}{field('specialty', 'Fachgebiet', 'cell')}</View>
      {field('street', 'Praxisanschrift')}
      <View style={styles.grid}>
        {field('postalCode', 'Postleitzahl', 'shortCell')}{field('city', 'Ort', 'longCell')}{field('phone', 'Telefon der Praxis', 'cell')}
      </View>
    </View>
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.help}>{notice}</Text> : null}
    <Text style={styles.help}>Beim Speichern wird der Kontakt für diese Verordnung ausgewählt.</Text>
    <View style={[styles.actions, styles.separator]}>
      <PremiumButton title="Kontakt speichern" accessibilityLabel="Kontakt speichern und für die Verordnung auswählen" loading={busy} disabled={!enabled || !draft.displayName.trim() || !!postalCodeError}
        onPress={() => { void save(); }} />
      <PremiumButton title={practice ? 'Zurück zur Suche' : 'Abbrechen'} variant="ghost" disabled={busy}
        onPress={() => { if (!flight.current && canEditNow()) onCancel(); }} />
    </View>
    {practice ? <>
      <PracticeWebsiteLink practice={practice} />
      <DirectorySourceAttribution source={practice.source} />
    </> : null}
  </View>;
}

export function MedicationPhysicianPicker({ prescribedBy, selectedId, onPick, ...access }: DirectoryAccess & {
  prescribedBy: string; selectedId?: string; onPick: (item: PhysicianOption) => void;
}) {
  const styles = usePhysicianStyles();
  const [open, setOpen] = useState(false);
  const [directory, setDirectory] = useState<PracticeDirectory>('physicians');
  const [state, setState] = useState<string | null>(null);
  const [statePicker, setStatePicker] = useState(false);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string>();
  const [draft, setDraft] = useState<{ practice?: PracticeLocationOption } | null>(null);
  const [selection, setSelection] = useState<{ tenantId: string; item: PhysicianOption } | null>(null);
  const searchNational = useCallback((tenant: string, value: string) => searchNationalPracticeLocations(tenant, value, state), [state]);
  const searchNationalPage = useCallback((tenant: string, value: string, after: string | null) =>
    searchNationalPracticeLocationsPage(tenant, value, state, after), [state]);
  const selected = selection?.tenantId === access.tenantId && selection.item.id === selectedId && selection.item.displayName === prescribedBy ? selection.item : null;
  const setSearchQuery = (value: string) => { setQuery(value); setActiveId(undefined); };
  const switchDirectory = (next: PracticeDirectory) => {
    if (!access.enabled || !access.canEditNow() || next === directory) return;
    setDraft(null); setDirectory(next); setStatePicker(false); setSearchQuery('');
  };
  const pick = (item: PhysicianOption) => {
    if (!access.enabled || !access.canEditNow() || item.source === RVR_SOURCE || item.source === OSM_SOURCE) return;
    onPick(item);
    setSelection({ tenantId: access.tenantId, item }); setDraft(null); setOpen(false);
  };
  const selectState = (value: string | null) => {
    if (!access.canEditNow()) return;
    setState(value); setStatePicker(false); setActiveId(undefined);
  };
  const tab = PRACTICE_KIND[directory];
  return <View style={styles.flow}>
    {selected ? <PhysicianSummary physician={selected} /> : null}
    {!draft ? <View style={styles.actions}>
      <PremiumButton title={open ? 'Arztsuche schließen' : 'Ärztin oder Arzt suchen'} variant="secondary" disabled={!access.enabled}
        onPress={() => {
          if (!access.canEditNow()) return;
          setOpen(!open); setDraft(null); setStatePicker(false); setActiveId(undefined);
        }} />
    </View> : null}
    {open && access.enabled ? <View style={styles.shell} key={access.tenantId}>
      {draft ? <NewPhysicianForm key={draft.practice?.id ?? 'manual'} {...access} prescribedBy={prescribedBy} onSaved={pick}
        onCancel={() => setDraft(null)} practice={draft.practice} /> : null}
      <View style={[styles.flow, draft && styles.hidden]} accessibilityElementsHidden={!!draft} importantForAccessibility={draft ? 'no-hide-descendants' : 'auto'} aria-hidden={!!draft}>
        <PhysicianHeading title="Arztkontakt finden" detail="Wähle das Verzeichnis passend zu deiner Suche." icon="search" />
        <View style={styles.actions}>
          {(Object.keys(PRACTICE_KIND) as PracticeDirectory[]).map(key => <PhysicianChoice key={key} title={PRACTICE_KIND[key].label}
            icon={PRACTICE_KIND[key].icon} active={directory === key} onPress={() => switchDirectory(key)} />)}
        </View>
        <Text style={styles.help}>{tab.prompt}</Text>
        {directory === 'national' ? <View style={styles.flow}>
          <View style={styles.actions}>
            <PremiumButton title={`Bundesland: ${PRACTICE_STATES.find(([code]) => code === state)?.[1] ?? 'Alle'}`}
              variant="secondary" size="sm" onPress={() => { if (access.canEditNow()) setStatePicker(!statePicker); }} />
          </View>
          {statePicker ? <View style={styles.filteredChoices}>
            <ResultButton title="Alle Bundesländer" selected={!state} disabled={!access.enabled} onPress={() => selectState(null)} />
            {PRACTICE_STATES.map(([code, name]) => <ResultButton key={code} title={name} selected={state === code} disabled={!access.enabled}
              onPress={() => selectState(code)} />)}
          </View> : null}
        </View> : null}
        {directory === 'physicians' ? <DirectorySearch key="physicians" {...access} search={searchPhysicians} itemKey={physicianKey}
          label="Arztsuche" placeholder="Name, Praxis, Fachgebiet oder Ort"
          empty="Kein gespeicherter Kontakt gefunden. Suche nach einer Praxis oder lege einen Arztkontakt an."
          initialQuery={query} onQueryChange={setSearchQuery} selectedKey={selectedId} describe={describePhysician} onPick={pick} />
        : <DirectorySearch key={`${directory}:${state ?? ''}`} {...access}
          search={directory === 'national' ? searchNational : searchPracticeLocations}
          searchPage={directory === 'national' ? searchNationalPage : searchPracticeLocationsPage} itemKey={practiceLocationKey}
          label={tab.label} placeholder="Name, Ort, Postleitzahl oder Fachgebiet"
          empty="Keine passenden Praxisstandorte gefunden. Prüfe den Suchbegriff oder wähle ein anderes Bundesland."
          describe={describePracticeLocation} source={directory === 'national' ? OSM_SOURCE : RVR_SOURCE}
          initialQuery={query} onQueryChange={setSearchQuery} attributionAfterResults
          selectedKey={activeId} onPick={(item) => {
            if (!access.canEditNow() || item.source !== (directory === 'national' ? OSM_SOURCE : RVR_SOURCE)) return;
            setActiveId(item.id === activeId ? undefined : item.id);
          }}
          activeDetails={(practice) => <PracticePreview practice={practice} onTransfer={() => {
            if (!access.canEditNow()) return;
            setDraft({ practice }); setStatePicker(false);
          }} />} />}
        <View style={[styles.actions, styles.separator]}>
          <PremiumButton title="Arztkontakt anlegen" variant="secondary" size="sm"
            onPress={() => { if (access.canEditNow()) setDraft({}); }} />
          <Pressable accessibilityRole="link" style={styles.link}
            onPress={() => { if (access.canEditNow()) void Linking.openURL(NATIONAL_PHYSICIAN_DIRECTORY).catch(() => undefined); }}>
            <Text style={styles.linkText}>Offizielle Arztsuche auf gesund.bund.de öffnen</Text>
          </Pressable>
        </View>
      </View>
    </View> : null}
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
