import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { dialPhoneNumber } from '@/components/portal/EmployeePortalClientRecordContactActions';
import { useEmployeePortalClientRecords } from '@/hooks/useEmployeePortalClientRecords';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import type { EmployeePortalClientRecordListItem } from '@/lib/portal/employeePortalClientRecordsService';
import { EmployeePortalAgendaAction, agendaFocusRing } from './employee/EmployeePortalAgendaAction';
import { useEmployeePortalAgendaLayout } from './employee/EmployeePortalAgendaLayout';
import { ClientDossier, ClientDossierArtwork, ClientDossierFacts } from './employee/EmployeePortalClientDossier';
import {
  ClientRecordBadge, ClientRecordLoading, ClientRecordPanel, ClientRecordViewport, clientRecordTextWrap,
} from './employee/EmployeePortalClientRecordLayout';
import { employeePortalDesign as c } from './employee/employeePortalDesign';

function matchesClientSearch(record: EmployeePortalClientRecordListItem, terms: string[], phoneDigits: string) {
  const fields = [record.displayName, record.street, record.zip, record.city, record.phone, record.mobile];
  const text = fields.filter(Boolean).join(' ').toLocaleLowerCase('de-DE');
  return terms.every(term => text.includes(term)) ||
    (phoneDigits.length > 0 && [record.phone, record.mobile].some(number => number?.replace(/\D/g, '').includes(phoneDigits)));
}

function ClientRecordCard({ record, onOpen, readableWidth, wideRow }: {
  record: EmployeePortalClientRecordListItem; onOpen: () => void; readableWidth: number; wideRow: boolean;
}) {
  const location = [record.street, [record.zip, record.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const phone = record.mobile?.trim() || record.phone;
  const compact = readableWidth < 390;
  const grade = record.careGradeLabel?.replace(/^PG\s+(\d)$/, 'Pflegegrad $1').replace(/^kein Pflegegrad$/, 'Kein Pflegegrad');
  const gradeBadge = grade ? <ClientRecordBadge label={grade} /> : null;
  const gradeInTab = readableWidth >= 245;
  return (
    <View testID={`employee-portal-client-card-${record.clientId}`}>
      <ClientDossier compact={compact} tabAccessory={gradeInTab ? gradeBadge : null}>
        <View style={[styles.fileBody, wideRow && styles.fileBodyRow]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Klientenakte ${record.displayName} öffnen`}
            onPress={onOpen} style={({ hovered, pressed, focused }: { hovered?: boolean; pressed: boolean; focused?: boolean }) => [
              styles.cardHeading, wideRow && styles.rowHeading, readableWidth < 172 && styles.narrowHeading,
              hovered && styles.hover, pressed && styles.pressed, focused && styles.focus,
            ]}>
            <View style={[styles.iconPlate, compact && styles.iconPlateCompact]}>
              <ClientDossierArtwork kind="dossier" size={compact ? 38 : 48} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={[styles.name, compact && styles.nameCompact]}>{record.displayName}</Text>
              {location ? <Text style={styles.address}>{location}</Text> : null}
              {gradeInTab ? null : gradeBadge}
            </View>
          </Pressable>
          <View style={wideRow && styles.rowFacts}>
            <ClientDossierFacts record={record} sideBySide={readableWidth >= 465} />
          </View>
        </View>

        {record.nextAssignmentAt || record.activeAssignmentCount > 0 ? (
          <View style={styles.cardMeta}>
            {record.nextAssignmentAt ? (
              <View style={styles.nextVisit}>
                <Ionicons name="calendar-outline" size={16} color={c.accent} accessible={false} />
                <View style={styles.nextCopy}>
                  <Text style={styles.metaText}>Mein nächster Einsatz</Text>
                  <Text style={styles.date}>{formatDate(record.nextAssignmentAt) || 'Datum offen'}</Text>
                </View>
              </View>
            ) : null}
            {record.activeAssignmentCount > 0 ? (
              <ClientRecordBadge active label={`${record.activeAssignmentCount} ${record.activeAssignmentCount === 1 ? 'aktiver Einsatz' : 'aktive Einsätze'}`} />
            ) : null}
          </View>
        ) : null}

        {record.hints ? (
          <View style={styles.hint}>
            <Text style={styles.hintLabel}>Einsatzhinweis</Text>
            <Text style={styles.metaText}>{record.hints}</Text>
          </View>
        ) : null}

        <View style={styles.actions} testID="employee-portal-client-card-actions">
          {phone ? (
            <EmployeePortalAgendaAction label="Anrufen" accessibilityLabel={`${record.displayName} anrufen`}
              icon={<ClientDossierArtwork kind="phone" size={21} />} onPress={() => dialPhoneNumber(phone)} />
          ) : null}
          <EmployeePortalAgendaAction label="Akte öffnen" accessibilityLabel={`Akte von ${record.displayName} öffnen`}
            icon={<ClientDossierArtwork kind="dossier" size={23} />} primary onPress={onOpen} />
        </View>
      </ClientDossier>
    </View>
  );
}

export function EmployeePortalClientRecordsScreen() {
  const router = useRouter();
  const layout = useEmployeePortalAgendaLayout();
  const { records, loading, error, refresh, refreshError } = useEmployeePortalClientRecords();
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase('de-DE');
  const visibleRecords = useMemo(() => {
    if (!normalizedSearch) return records;
    const terms = normalizedSearch.split(/\s+/);
    const phoneDigits = /^[\d\s+()./-]+$/.test(normalizedSearch) ? normalizedSearch.replace(/\D/g, '') : '';
    return records.filter(record => matchesClientSearch(record, terms, phoneDigits));
  }, [normalizedSearch, records]);
  const twoColumns = layout.readableWidth >= 990;
  const cardWidth = layout.readableWidth / (twoColumns ? 2 : 1) - 14;
  const compactHeader = layout.compact || layout.shortLandscape;
  const initialError = records.length === 0 ? error : null;
  const refreshRecords = () => void refresh();
  const count = records.length === 1 ? '1 aktive Akte' : `${records.length} aktive Akten`;
  const resultLabel = normalizedSearch
    ? `${visibleRecords.length} von ${records.length} ${records.length === 1 ? 'Akte' : 'Akten'}`
    : count;

  return (
    <ClientRecordViewport layout={layout} testID="employee-portal-client-records">
      <View style={[styles.register, compactHeader && styles.registerCompact]}>
        <LinearGradient colors={['#224D68', '#15324A', '#0D2438']} locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.registerTop}>
          <View style={styles.registerCopy}>
            <Text style={styles.kicker}>Aktenregister</Text>
            <Text accessibilityRole="header" aria-level={1} style={[styles.title, compactHeader && styles.titleCompact,
              layout.readableWidth < 182 && styles.titleNarrow]}>Klientenakten</Text>
            <Text style={styles.subtitle}>Stammdaten, Versicherung und Hinweise für Ihre Einsätze.</Text>
          </View>
          {layout.readableWidth >= 275 ? (
            <View style={[styles.heroArt, (layout.readableWidth < 600 || layout.shortLandscape) && styles.heroArtCompact]}>
              <ClientDossierArtwork kind="dossier" size={layout.readableWidth < 600 || layout.shortLandscape ? 64 : 100} />
            </View>
          ) : null}
        </View>
        <View style={styles.toolbar}>
          <View style={[styles.searchBar, layout.compact && styles.fullSearch]}>
            {layout.readableWidth >= 175 ? <Ionicons name="search-outline" size={19} color={c.accent} accessible={false} /> : null}
            <TextInput accessibilityLabel="Klientenakten durchsuchen" autoCorrect={false} returnKeyType="search"
              placeholder={layout.readableWidth < 300 ? 'Name oder Ort …' : 'Name, Ort, Adresse oder Telefon'}
              placeholderTextColor={c.muted} style={styles.searchInput} value={search} onChangeText={setSearch} />
            {search ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Suche löschen" onPress={() => setSearch('')}
                style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => [
                  styles.clear, focused && styles.focus, pressed && styles.pressed,
                ]}>
                <Ionicons name="close" size={17} color={c.accent} accessible={false} />
              </Pressable>
            ) : null}
          </View>
          <EmployeePortalAgendaAction label={layout.compact ? 'Aktualisieren' : 'Klientenakten aktualisieren'}
            accessibilityLabel="Klientenakten aktualisieren" icon="refresh-outline" busy={loading} onPress={refreshRecords} />
        </View>
      </View>
      {refreshError && !initialError ? (
        <InfoBanner variant="error" presentation="inline" onDarkSurface title="Aktualisierung nicht möglich"
          message={refreshError} actionLabel="Erneut versuchen" onAction={refreshRecords} />
      ) : null}

      {loading && records.length === 0 && !initialError ? <ClientRecordLoading message="Klientenakten werden geladen …" /> : null}
      {initialError ? (
        <InfoBanner variant="error" presentation="inline" onDarkSurface title="Klientenakten konnten nicht geladen werden"
          message={initialError} actionLabel="Erneut versuchen" onAction={refreshRecords} />
      ) : null}
      {!loading && !initialError && visibleRecords.length === 0 ? (
        <ClientRecordPanel title={normalizedSearch ? 'Keine Treffer' : 'Keine aktiven Klientenakten'} icon="folder-outline">
          <Text style={styles.address}>
            {normalizedSearch ? 'Ändern Sie den Suchbegriff oder setzen Sie die Suche zurück.' : 'Für das Team liegen derzeit keine aktiven Akten vor.'}
          </Text>
          {normalizedSearch ? (
            <View style={styles.emptyActions}><EmployeePortalAgendaAction label="Suche zurücksetzen" icon="close-outline" onPress={() => setSearch('')} /></View>
          ) : null}
        </ClientRecordPanel>
      ) : null}
      {visibleRecords.length > 0 ? (
        <View style={styles.results}>
          <View style={styles.resultHeading}>
            <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>Aktenübersicht</Text>
            <Text accessibilityLiveRegion="polite" style={styles.resultCount}>{resultLabel}</Text>
          </View>
          <View style={styles.grid}>
            {visibleRecords.map(record => (
              <View key={record.clientId} style={[styles.cell, twoColumns && styles.cellHalf]}>
                <ClientRecordCard record={record} readableWidth={cardWidth} wideRow={!twoColumns && cardWidth >= 670}
                  onOpen={() => router.push(`/portal/employee/clients/${record.clientId}` as never)} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ClientRecordViewport>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  register: {
    gap: 12, padding: 16, minWidth: 0, borderWidth: 1, borderColor: '#557E98',
    borderRadius: 18, overflow: 'hidden', backgroundColor: '#15324A',
  },
  registerCompact: { padding: 11, gap: 9, borderRadius: 14 },
  registerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  registerCopy: { flex: 1, minWidth: 0, gap: 4 },
  kicker: {
    color: c.accent, fontSize: font(10), lineHeight: font(15), letterSpacing: 1.1, textTransform: 'uppercase',
    fontWeight: '800', ...clientRecordTextWrap,
  },
  title: { color: c.text, fontSize: font(34), lineHeight: font(40), fontWeight: '800', ...clientRecordTextWrap },
  titleCompact: { fontSize: font(23), lineHeight: font(29) },
  titleNarrow: { fontSize: font(20), lineHeight: font(25) },
  subtitle: { color: c.muted, fontSize: font(13), lineHeight: font(19), ...clientRecordTextWrap },
  heroArt: {
    width: 128, minHeight: 102, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: 'rgba(132,208,239,0.12)',
  },
  heroArtCompact: { width: 68, minHeight: 69, borderRadius: 11 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9, minWidth: 0 },
  searchBar: {
    flexGrow: 1, flexBasis: 260, minWidth: 0, maxWidth: '100%', minHeight: 48,
    paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: c.control, borderWidth: 1, borderColor: c.line, borderRadius: 12,
  },
  fullSearch: { flexBasis: '100%' },
  searchInput: { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 6, color: c.text, fontSize: font(16), lineHeight: font(22) },
  clear: { width: 44, height: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: c.selected },
  results: { minWidth: 0, gap: 12 },
  resultHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 },
  sectionTitle: { color: c.text, fontSize: font(18), lineHeight: font(24), fontWeight: '800' },
  resultCount: {
    flexShrink: 1, color: c.accent, fontSize: font(12), lineHeight: font(17), fontWeight: '700',
    borderRadius: 8, backgroundColor: c.control, paddingHorizontal: 8, paddingVertical: 4, ...clientRecordTextWrap,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginHorizontal: -7, rowGap: 16 },
  cell: { width: '100%', minWidth: 0, paddingHorizontal: 7 },
  cellHalf: { width: '50%' },
  fileBody: { minWidth: 0, gap: 12 },
  fileBodyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 9, minWidth: 0 },
  rowHeading: { flex: 1 },
  rowFacts: { flex: 2.2, minWidth: 0 },
  narrowHeading: { flexWrap: 'wrap' },
  iconPlate: {
    width: 59, height: 57, flexShrink: 0, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#608BA4', borderRadius: 12, backgroundColor: '#335A72',
  },
  iconPlateCompact: { width: 46, height: 46, borderRadius: 9 },
  cardCopy: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: c.text, fontSize: font(20), lineHeight: font(26), fontWeight: '800', ...clientRecordTextWrap },
  nameCompact: { fontSize: font(17), lineHeight: font(22) },
  address: { color: c.muted, fontSize: font(13), lineHeight: font(19), ...clientRecordTextWrap },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  nextVisit: { flexGrow: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  nextCopy: { flexShrink: 1, minWidth: 0, gap: 1 },
  metaText: { color: c.muted, fontSize: font(12), lineHeight: font(17), ...clientRecordTextWrap },
  date: { color: c.text, fontSize: font(13), lineHeight: font(18), fontWeight: '700' },
  hint: { gap: 3, padding: 8, borderRadius: 9, backgroundColor: c.control },
  hintLabel: { color: c.accent, fontSize: font(11), lineHeight: font(15), fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap' },
  hover: { backgroundColor: c.raised },
  focus: { ...agendaFocusRing },
  pressed: { opacity: 0.8 },
}));
