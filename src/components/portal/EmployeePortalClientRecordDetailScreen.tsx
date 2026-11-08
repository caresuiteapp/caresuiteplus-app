import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Linking, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useEmployeePortalClientRecordDetail } from '@/hooks/useEmployeePortalClientRecords';
import { formatDate, formatDateTime } from '@/lib/formatters/dateTimeFormatters';
import type { EmployeePortalClientRecordDetail } from '@/lib/portal/employeePortalClientRecordsService';
import { ASSIGNMENT_STATUS_LABELS, type AssignmentStatus } from '@/types/modules/assignmentStatus';
import { EmployeePortalClientDocumentPreviewSheet } from './EmployeePortalClientDocumentPreviewSheet';
import { dialPhoneNumber, PhoneActionRow } from './EmployeePortalClientRecordContactActions';
import { EmployeePortalAgendaAction } from './employee/EmployeePortalAgendaAction';
import { EmployeePortalAgendaHero, useEmployeePortalAgendaLayout } from './employee/EmployeePortalAgendaLayout';
import { ClientDossier, ClientDossierArtwork, ClientDossierFacts } from './employee/EmployeePortalClientDossier';
import {
  ClientRecordBadge, ClientRecordLink, ClientRecordLoading, ClientRecordPanel, ClientRecordViewport, clientRecordTextWrap,
} from './employee/EmployeePortalClientRecordLayout';
import { employeePortalDesign as c } from './employee/employeePortalDesign';

type RecordLayout = ReturnType<typeof useEmployeePortalAgendaLayout>;

function buildAddress(record: EmployeePortalClientRecordDetail): string {
  const street = [record.street, record.houseNumber].filter(Boolean).join(' ');
  const city = [record.zip, record.city].filter(Boolean).join(' ');
  const unit = [record.floor ? `Etage ${record.floor}` : null, record.apartmentNumber ? `Whg. ${record.apartmentNumber}` : null]
    .filter(Boolean).join(' · ');
  return [street, city, unit].filter(Boolean).join(', ');
}

function RecordInfo({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <View style={styles.info}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>
  );
}

function RecordError({ title, message, refresh }: { title: string; message: string; refresh?: () => void }) {
  return <InfoBanner variant="error" presentation="inline" onDarkSurface title={title} message={message}
    actionLabel={refresh ? 'Erneut versuchen' : undefined} onAction={refresh} />;
}

function ClientRecordHero({ record, address, layout }: { record: EmployeePortalClientRecordDetail; address: string; layout: RecordLayout }) {
  const metrics = [
    ...(record.careGradeLabel ? [{ label: 'Pflegegrad', value: record.careGradeLabel }] : []),
    ...(record.nextAssignmentAt ? [{ label: 'Mein nächster Einsatz', value: formatDate(record.nextAssignmentAt) || 'Datum offen' }] : []),
    { label: 'Freigegebene Dokumente', value: record.documentsError ? 'Nicht verfügbar' : record.portalDocuments.length },
    { label: 'Meine aktiven Einsätze', value: record.assignmentHistoryError ? 'Nicht verfügbar' : record.activeAssignmentCount },
  ];
  const metricColumns = layout.readableWidth >= 740 ? metrics.length : layout.readableWidth >= 175 ? 2 : 1;
  const metricWidth = `${100 / metricColumns}%` as ViewStyle['width'];
  return (
    <ClientDossier compact={layout.compact} tabAccessory={<ClientRecordBadge label="Nur lesen" />}>
      <View style={[styles.identity, layout.readableWidth < 175 && styles.identityStacked]}>
        <ClientDossierArtwork kind="dossier" size={layout.compact ? 49 : 67} />
        <View style={[styles.identityCopy, layout.readableWidth < 175 && styles.fullIdentity]}>
          <Text accessibilityRole="header" aria-level={1} style={[styles.name, layout.compact && styles.nameCompact]}>{record.displayName}</Text>
          {address ? <Text style={styles.body}>{address}</Text> : null}
        </View>
      </View>
      <ClientDossierFacts record={record} sideBySide={layout.readableWidth >= 475} />
      <View style={styles.metrics}>
        {metrics.map(metric => (
          <View key={metric.label} style={[styles.metricCell, { width: metricWidth }]}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.label}>{metric.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </ClientDossier>
  );
}

function ClientRecordContent({ record, layout, refresh }: {
  record: EmployeePortalClientRecordDetail; layout: RecordLayout; refresh: () => void;
}) {
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState(25);
  const address = buildAddress(record);
  const hasNotes = record.hints || record.accessHint || record.keyManagementNotes || record.employeeNotes || record.emergencyNotes;
  const openMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    void Linking.openURL(url).catch(() => Alert.alert('Navigation nicht verfügbar', 'Die Kartenanwendung konnte nicht geöffnet werden.'));
  };

  return (
    <>
      <ClientRecordHero record={record} address={address} layout={layout} />
      <View style={[styles.detail, layout.readableWidth >= 675 && styles.split]}>
        <View style={styles.column}>
          <ClientRecordPanel title="Kontakt & Anfahrt" icon={<ClientDossierArtwork kind="phone" size={23} />}>
            {record.phone ? <PhoneActionRow label="Telefon" value={record.phone} /> : null}
            {record.mobile ? <PhoneActionRow label="Mobil" value={record.mobile} icon="phone-portrait-outline" /> : null}
            {!record.phone && !record.mobile ? <Text style={styles.body}>Keine Telefonnummer hinterlegt.</Text> : null}
            {address ? <ClientRecordLink title="Route in Karten öffnen" icon="navigate-outline" detail={address} onPress={openMaps} /> : null}
          </ClientRecordPanel>

          {hasNotes || record.accessError ? (
            <ClientRecordPanel title="Hinweise für den Einsatz" icon="clipboard-outline">
              {record.accessError ? <RecordError title="Zugangshinweise nicht verfügbar" message={record.accessError} refresh={refresh} /> : null}
              <RecordInfo label="Zugang" value={record.accessHint} />
              <RecordInfo label="Schlüssel / Zugang" value={record.keyManagementNotes} />
              <RecordInfo label="Hinweise aus der Akte" value={record.employeeNotes} />
              <RecordInfo label="Notfallhinweise" value={record.emergencyNotes} />
              <RecordInfo label="Besonderheiten aus Einsätzen" value={record.hints} />
            </ClientRecordPanel>
          ) : null}

          {record.contacts.length > 0 || record.contactsError ? (
            <ClientRecordPanel title="Ansprechpartner" icon="people-outline">
              {record.contactsError ? <RecordError title="Ansprechpartner nicht verfügbar" message={record.contactsError} refresh={refresh} /> : null}
              {record.contacts.map(contact => {
                const phone = contact.phone?.trim() || contact.mobile;
                const detail = [
                  contact.isPrimaryContact ? 'Hauptkontakt' : null,
                  contact.isEmergencyContact ? 'Notfall' : null,
                  contact.relationship,
                ].filter(Boolean).join(' · ');
                return (
                  <View key={contact.id} style={styles.contact}>
                    {phone ? (
                      <ClientRecordLink title={contact.displayName} detail={detail} icon="person-outline" actionIcon="call-outline"
                        accessibilityLabel={`${contact.displayName} anrufen`} onPress={() => dialPhoneNumber(phone)} />
                    ) : (
                      <RecordInfo label={detail || 'Kontakt'} value={contact.displayName} />
                    )}
                    {contact.phone && contact.mobile && contact.phone !== contact.mobile ? (
                      <>
                        <PhoneActionRow label="Telefon" value={contact.phone} />
                        <PhoneActionRow label="Mobil" value={contact.mobile} icon="phone-portrait-outline" />
                      </>
                    ) : null}
                  </View>
                );
              })}
            </ClientRecordPanel>
          ) : null}

          {record.gender || address || record.doorbellName ? (
            <ClientRecordPanel title="Weitere Stammdaten" icon={<ClientDossierArtwork kind="identity" size={24} />}>
              <RecordInfo label="Geschlecht" value={record.gender} />
              <RecordInfo label="Adresse" value={address} />
              <RecordInfo label="Klingel" value={record.doorbellName} />
            </ClientRecordPanel>
          ) : null}

          {record.allergies || record.mobilityNotes || record.pets ? (
            <ClientRecordPanel title="Gesundheit & Alltag" icon="heart-outline">
              <RecordInfo label="Allergien" value={record.allergies} />
              <RecordInfo label="Mobilität" value={record.mobilityNotes} />
              <RecordInfo label="Haustiere" value={record.pets} />
            </ClientRecordPanel>
          ) : null}
        </View>

        <View style={styles.column}>
          <ClientRecordPanel title="Freigegebene Dokumente" icon="documents-outline">
            {record.documentsError ? (
              <RecordError title="Dokumente nicht verfügbar" message={record.documentsError} refresh={refresh} />
            ) : record.portalDocuments.length === 0 ? (
              <Text style={styles.body}>Für diese Akte sind keine Dokumente freigegeben.</Text>
            ) : record.portalDocuments.map(doc => (
              <ClientRecordLink key={doc.id} title={doc.title} icon="document-text-outline"
                detail={[doc.categoryLabel, formatDate(doc.createdAt)].filter(Boolean).join(' · ')}
                accessibilityLabel={`Dokument öffnen: ${doc.title}`} onPress={() => setPreviewDocumentId(doc.id)} />
            ))}
          </ClientRecordPanel>

          <ClientRecordPanel title="Meine Einsätze" icon="calendar-outline">
            {record.assignmentHistoryError ? (
              <RecordError title="Einsatzhistorie nicht verfügbar" message={record.assignmentHistoryError} refresh={refresh} />
            ) : record.assignmentHistory.length === 0 ? (
              <Text style={styles.body}>Ihnen sind für diese Akte keine Einsätze zugeordnet.</Text>
            ) : record.assignmentHistory.slice(0, historyLimit).map(entry => (
              <View key={entry.assignmentId} style={styles.history}>
                <Ionicons name="time-outline" size={17} color={c.accent} accessible={false} />
                <View style={styles.historyCopy}>
                  <Text style={styles.historyTitle}>{entry.title}</Text>
                  <Text style={styles.label}>{formatDateTime(entry.plannedStartAt)}</Text>
                </View>
                <ClientRecordBadge label={ASSIGNMENT_STATUS_LABELS[entry.status as AssignmentStatus] ?? entry.status} />
              </View>
            ))}
            {!record.assignmentHistoryError && record.assignmentHistory.length > historyLimit ? (
              <View style={styles.toolbar}>
                <EmployeePortalAgendaAction label={`Weitere Einsätze anzeigen (${record.assignmentHistory.length - historyLimit})`}
                  icon="chevron-down-outline" onPress={() => setHistoryLimit(limit => limit + 25)} />
              </View>
            ) : null}
          </ClientRecordPanel>
        </View>
      </View>

      {previewDocumentId ? (
        <EmployeePortalClientDocumentPreviewSheet clientId={record.clientId} documentId={previewDocumentId}
          visible onClose={() => setPreviewDocumentId(null)} />
      ) : null}
    </>
  );
}

export function EmployeePortalClientRecordDetailScreen({ clientId }: { clientId: string | undefined }) {
  const router = useRouter();
  const layout = useEmployeePortalAgendaLayout();
  const { record, loading, error, refresh, refreshError, notFound } = useEmployeePortalClientRecordDetail(clientId);
  const loadError = error ?? (notFound || (!loading && !record) ? 'Klient:in nicht gefunden oder kein Zugriff.' : null);
  const refreshRecord = () => void refresh();

  return (
    <ClientRecordViewport layout={layout} testID="employee-portal-client-record-detail">
      <View style={styles.toolbar}>
        <EmployeePortalAgendaAction label="Zur Klientenübersicht" icon="arrow-back-outline"
          onPress={() => router.replace('/portal/employee/clients' as never)} />
        {record && !loadError ? <EmployeePortalAgendaAction label="Akte aktualisieren" icon="refresh-outline" busy={loading} onPress={refreshRecord} /> : null}
      </View>
      {refreshError && !loadError ? <RecordError title="Aktualisierung nicht möglich" message={refreshError} refresh={refreshRecord} /> : null}
      {loadError || !record ? (
        <>
          <EmployeePortalAgendaHero layout={layout} artwork="clients" kicker="Aktive Akten"
            title="Klientenakte" subtitle="Kontaktdaten und Hinweise für Ihre Einsätze." condensed={layout.shortLandscape} />
          {loadError ? (
            <RecordError title="Akte nicht verfügbar" message={loadError} refresh={clientId ? refreshRecord : undefined} />
          ) : <ClientRecordLoading message="Klientenakte wird geladen …" />}
        </>
      ) : <ClientRecordContent key={record.clientId} record={record} layout={layout} refresh={refreshRecord} />}
    </ClientRecordViewport>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, minWidth: 0 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  identityStacked: { flexDirection: 'column' },
  identityCopy: { flex: 1, minWidth: 0, gap: 3 },
  fullIdentity: { flex: undefined, width: '100%' },
  name: { color: c.text, fontSize: font(32), lineHeight: font(38), fontWeight: '800', ...clientRecordTextWrap },
  nameCompact: { fontSize: font(23), lineHeight: font(29) },
  body: { color: c.muted, fontSize: font(13), lineHeight: font(19), ...clientRecordTextWrap },
  label: { color: c.muted, fontSize: font(11), lineHeight: font(16), ...clientRecordTextWrap },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, rowGap: 8 },
  metricCell: { minWidth: 0, paddingHorizontal: 4 },
  metric: {
    flex: 1, gap: 3, minWidth: 0, padding: 9, borderRadius: 11,
    borderWidth: 1, borderColor: c.line, backgroundColor: c.control,
  },
  metricValue: { color: c.text, fontSize: font(15), lineHeight: font(20), fontWeight: '800', ...clientRecordTextWrap },
  detail: { gap: 12, minWidth: 0 },
  split: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 12 },
  info: { gap: 3, paddingVertical: 4, minWidth: 0 },
  contact: { gap: 6, minWidth: 0 },
  history: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 10, minWidth: 0,
    borderRadius: 11, borderWidth: 1, borderColor: c.line, backgroundColor: c.control,
  },
  historyCopy: { flex: 1, minWidth: 0, gap: 3 },
  historyTitle: { color: c.text, fontSize: font(13), lineHeight: font(18), fontWeight: '700', ...clientRecordTextWrap },
}));
