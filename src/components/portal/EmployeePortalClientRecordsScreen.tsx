import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ClientAnimalAvatar } from '@/components/clients/ClientAnimalAvatar';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { dialPhoneNumber } from '@/components/portal/EmployeePortalClientRecordContactActions';
import { useEmployeePortalClientRecords } from '@/hooks/useEmployeePortalClientRecords';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import type { EmployeePortalClientRecordListItem } from '@/lib/portal/employeePortalClientRecordsService';
import { EmployeePortalAgendaAction, agendaFocusRing } from './employee/EmployeePortalAgendaAction';
import { EmployeePortalAgendaHero, useEmployeePortalAgendaLayout } from './employee/EmployeePortalAgendaLayout';
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

function ClientRecordCard({ record, onOpen, narrow }: {
  record: EmployeePortalClientRecordListItem; onOpen: () => void; narrow: boolean;
}) {
  const location = [record.street, [record.zip, record.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const phone = record.mobile?.trim() || record.phone;
  return (
    <View testID={`employee-portal-client-card-${record.clientId}`}>
      <View style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Klientenakte ${record.displayName} öffnen`}
          onPress={onOpen} style={({ hovered, pressed, focused }: { hovered?: boolean; pressed: boolean; focused?: boolean }) => [
            styles.cardHeading, narrow && styles.narrowHeading, hovered && styles.hover, pressed && styles.pressed, focused && styles.focus,
          ]}>
          <ClientAnimalAvatar clientId={record.clientId} clientName={record.displayName} size={narrow ? 40 : 48} ringColor={c.accent} />
          <View style={styles.cardCopy}>
            <Text style={styles.name}>{record.displayName}</Text>
            {location ? <Text style={styles.address}>{location}</Text> : null}
            {record.careGradeLabel ? <ClientRecordBadge label={record.careGradeLabel} /> : null}
          </View>
        </Pressable>

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
              icon="call-outline" onPress={() => dialPhoneNumber(phone)} />
          ) : null}
          <EmployeePortalAgendaAction label="Akte öffnen" accessibilityLabel={`Akte von ${record.displayName} öffnen`}
            icon="folder-open-outline" primary onPress={onOpen} />
        </View>
      </View>
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
  const columns = layout.readableWidth >= 1280 ? 4 : layout.readableWidth >= 940 ? 3 : layout.readableWidth >= 610 ? 2 : 1;
  const cellWidth = `${100 / columns}%` as ViewStyle['width'];
  const initialError = records.length === 0 ? error : null;
  const refreshRecords = () => void refresh();
  const count = records.length === 1 ? '1 aktive Akte' : `${records.length} aktive Akten`;
  const resultLabel = normalizedSearch
    ? `${visibleRecords.length} von ${records.length} ${records.length === 1 ? 'Akte' : 'Akten'}`
    : count;

  return (
    <ClientRecordViewport layout={layout} testID="employee-portal-client-records">
      <EmployeePortalAgendaHero layout={layout} artwork="clients" kicker="Aktive Akten"
        title="Klientenakten" subtitle="Kontaktdaten und Hinweise für Ihre Einsätze." condensed={layout.shortLandscape} />
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
        <EmployeePortalAgendaAction label="Klientenakten aktualisieren" icon="refresh-outline" busy={loading} onPress={refreshRecords} />
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
              <View key={record.clientId} style={[styles.cell, { width: cellWidth }]}>
                <ClientRecordCard record={record} narrow={layout.readableWidth / columns < 245}
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
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, minWidth: 0 },
  searchBar: {
    flexGrow: 1, flexBasis: 260, minWidth: 0, maxWidth: '100%', minHeight: 48,
    paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: c.control, borderWidth: 1, borderColor: c.line, borderRadius: 12,
  },
  fullSearch: { flexBasis: '100%' },
  searchInput: { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 6, color: c.text, fontSize: font(16), lineHeight: font(22) },
  clear: { width: 44, height: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: c.selected },
  results: { minWidth: 0, gap: 12 },
  resultHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  sectionTitle: { color: c.text, fontSize: font(18), lineHeight: font(24), fontWeight: '800' },
  resultCount: { color: c.accent, fontSize: font(12), lineHeight: font(17), fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginHorizontal: -6, rowGap: 12 },
  cell: { minWidth: 0, paddingHorizontal: 6 },
  card: {
    minWidth: 0, flexShrink: 0, padding: 13, gap: 10, borderRadius: 17,
    backgroundColor: c.panel, borderWidth: 1, borderLeftWidth: 3, borderColor: c.line, borderLeftColor: c.accent,
  },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 9, minWidth: 0 },
  narrowHeading: { flexWrap: 'wrap' },
  cardCopy: { flex: 1, minWidth: 0, gap: 5 },
  name: { color: c.text, fontSize: font(17), lineHeight: font(23), fontWeight: '800', ...clientRecordTextWrap },
  address: { color: c.muted, fontSize: font(13), lineHeight: font(19), ...clientRecordTextWrap },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  nextVisit: { flexGrow: 1, flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  nextCopy: { flexShrink: 1, minWidth: 0, gap: 1 },
  metaText: { color: c.muted, fontSize: font(12), lineHeight: font(17), ...clientRecordTextWrap },
  date: { color: c.text, fontSize: font(13), lineHeight: font(18), fontWeight: '700' },
  hint: { gap: 3, padding: 8, borderRadius: 9, backgroundColor: c.control },
  hintLabel: { color: c.accent, fontSize: font(11), lineHeight: font(15), fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 9 },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap' },
  hover: { backgroundColor: c.raised },
  focus: { ...agendaFocusRing },
  pressed: { opacity: 0.8 },
}));
