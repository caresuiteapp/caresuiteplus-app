// Generated native presentation from src/components/pflege/ClientRecordOverview365.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { SemanticArtwork } from "../icons/SemanticArtwork.native.tsx";
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AuroraBadge, AuroraGlassCard } from '@/components/aurora';
import { ClientWorkspaceLiveBadge, ClientWorkspacePanel, } from '@/components/office/ClientWorkspacePrimitives';
import type { ClientRecordOverview } from "../../lib/clients/clientRecordOverview365.native.ts";
import type { ClientDocumentEvidenceRecord, ClientEvidenceField } from "../../lib/clients/clientDocumentEvidence.native.ts";
import type { ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
type ClientRecordOverviewPanelProps = {
    overview: ClientRecordOverview;
    onNavigateTab: (tab: ClientRecordTabKey) => void;
};
function SummaryRow({ label, value }: {
    label: string;
    value: string;
}) {
    return (<View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>);
}
function FocusCard({ icon, label, value, variant = 'cyan' }: {
    icon: string;
    label: string;
    value: string;
    variant?: 'cyan' | 'pink' | 'green';
}) {
    return (<AuroraGlassCard style={styles.focusCard}>
      <View style={styles.focusHeader}>
        <SemanticArtwork style={styles.focusIcon} webSize={24}>{icon}</SemanticArtwork>
        <AuroraBadge label={label} variant={variant}/>
      </View>
      <Text style={styles.focusValue}>{value}</Text>
    </AuroraGlassCard>);
}
function EvidenceRow({ record, scopeKey }: {
    record: ClientDocumentEvidenceRecord;
    scopeKey: string;
}) {
    const [opened, setOpened] = useState<string | null>(null);
    const key = `${scopeKey}:${record.kind}:${record.id}`;
    const renderField = (field: ClientEvidenceField) => <View key={field.key} style={styles.evidenceField}><Text style={styles.evidenceLabel}>{field.label}</Text><Text style={styles.documentDate}>{field.display}</Text></View>;
    return <View style={styles.evidenceCard}>
    <Text style={styles.documentTitle}>{record.title}</Text>
    <Text style={styles.documentDate}>ID: {record.id}</Text>
    {renderField(record.primary)}
    <Pressable accessibilityRole="button" onPress={() => setOpened(value => value === key ? null : key)} style={styles.evidenceButton}><Text style={styles.evidenceButtonText}>{opened === key ? 'Weitere Belegangaben schließen' : 'Weitere Belegangaben anzeigen'}</Text></Pressable>
    {opened === key ? record.fields.filter(field => field.key !== record.primary.key).map(renderField) : null}
  </View>;
}
function EvidenceGroup({ title, records, scopeKey }: {
    title: string;
    records: ClientDocumentEvidenceRecord[];
    scopeKey: string;
}) {
    const [limit, setLimit] = useState(6);
    return <View style={styles.evidenceGroup}>
    <Text style={styles.documentTitle}>{title} · {records.length} gelieferte Angaben</Text>
    {records.length ? <View style={styles.documentList}>{records.slice(0, limit).map(record => <EvidenceRow key={`${scopeKey}:${record.kind}:${record.id}`} scopeKey={scopeKey} record={record}/>)}</View> : <Text style={styles.emptyDocumentsText}>Der gelieferte Bestand ist leer. Das schließt weitere oder ältere Nachweise nicht aus.</Text>}
    {limit < records.length ? <Pressable accessibilityRole="button" style={styles.evidenceButton} onPress={() => setLimit(value => value + 6)}><Text style={styles.quickLinkLabel}>Weitere Angaben anzeigen ({records.length - limit} verbleibend)</Text></Pressable> : null}
  </View>;
}
export function ClientRecordOverviewPanel({ overview, onNavigateTab }: ClientRecordOverviewPanelProps) {
    const { isDesktopOrWide } = useDeviceClass();
    const evidence = overview.documentEvidence;
    const scopeKey = `${evidence.tenantId}:${evidence.clientId}`;
    return (<View style={styles.root}>
      <ClientWorkspacePanel eyebrow="Versorgungsradar" title="Heute wichtig" subtitle="Gelieferte Hinweise, offene Punkte und Belegangaben auf einen Blick" accessory={<ClientWorkspaceLiveBadge label="Gelieferte Aktenangaben"/>}>
        <View style={styles.focusGrid}>
          <FocusCard icon="◷" label="Terminangaben" value={overview.nextAppointment}/>
          <FocusCard icon="!" label="Offene Punkte" value={overview.openItemsSummary} variant="pink"/>
          <FocusCard icon="▤" label="Belegangaben" value={evidence.error ? 'Ungeklärt' : `${evidence.contracts.length} Verträge · ${evidence.consents.length} Einwilligungen · ${evidence.documents.length} Dokumente`} variant="cyan"/>
        </View>
        <View style={styles.evidenceField}>
          <Text style={styles.evidenceLabel}>{overview.appointmentEvidence.hint.label}</Text>
          <Text style={styles.documentDate}>{evidence.error ? 'Ungeklärt' : overview.appointmentEvidence.hint.display}</Text>
          <Text style={styles.emptyDocumentsText}>Ein gelieferter Statushinweis ist kein Termin-, Durchführungs- oder Freigabenachweis.</Text>
        </View>
      </ClientWorkspacePanel>

      <View style={[styles.workspace, isDesktopOrWide && styles.workspaceWide]}>
        <View style={styles.mainColumn}>
          <ClientWorkspacePanel eyebrow="Stammdaten-Kurzüberblick" title="Versorgungsprofil" subtitle="Wichtigste Angaben auf einen Blick">
            <View style={styles.summaryGrid}>
              <View style={styles.summaryColumn}>
                <SummaryRow label="Name" value={overview.fullName}/>
                <SummaryRow label="Geburtsdatum" value={overview.dateOfBirth}/>
                <SummaryRow label="Adresse" value={overview.address}/>
                <SummaryRow label="Telefon" value={overview.phone}/>
                <SummaryRow label="Gespeichertes Aufnahmedatum" value={overview.admissionDate}/>
                <SummaryRow label="Aktenerstellung · Metadatum, kein Aufnahmebeginn" value={evidence.error ? 'Ungeklärt' : overview.recordDates.creation.display}/>
              </View>
              <View style={styles.summaryColumn}>
                <SummaryRow label="Pflegegrad" value={overview.careLevel}/>
                <SummaryRow label="Leistungsart" value={overview.serviceTypes}/>
                <SummaryRow label="Kostenträger" value={overview.primaryCostBearer}/>
                <SummaryRow label="Letzte Aktivität" value={overview.lastActivity}/>
              </View>
            </View>
          </ClientWorkspacePanel>

          <ClientWorkspacePanel eyebrow="Belegangaben getrennt prüfen" title="Unterzeichnungsangaben, Einwilligungen und Dokumentstatus" subtitle="Dokumentstatus und Erteilungszeit sind keine Unterzeichnung">
            <Text style={styles.emptyDocumentsText}>Hier stehen die tatsächlich gelieferten Aktenangaben. Eine hinterlegte Unterzeichnungszeit bestätigt keine geprüfte Signatur, rechtliche Wirksamkeit oder vollständige Aufnahme. Erteilte Einwilligungen sind keine automatisch nachgewiesenen Dokumentunterschriften.</Text>
            {evidence.error ? <View style={styles.emptyDocuments}><Text style={styles.emptyDocumentsTitle}>Belegbestand ungeklärt</Text><Text style={styles.emptyDocumentsText}>{evidence.error}</Text></View> : <View style={styles.evidenceGroup}>
              <EvidenceGroup title="Verträge · ausdrücklich hinterlegte Unterzeichnungsangaben" records={evidence.contracts} scopeKey={scopeKey}/>
              <EvidenceGroup title="Einwilligungen · hinterlegte Entscheidungen" records={evidence.consents} scopeKey={scopeKey}/>
              <EvidenceGroup title="Dokumente · Workflow und Erfassung" records={evidence.documents} scopeKey={scopeKey}/>
            </View>}
            {overview.quickLinks.some(link => link.tab === 'dokumente') ? <Pressable accessibilityRole="button" style={styles.evidenceButton} onPress={() => onNavigateTab('dokumente')}><Text style={styles.quickLinkLabel}>Dokumente und vorhandene Nachweise öffnen</Text></Pressable> : null}
          </ClientWorkspacePanel>
        </View>

        {overview.quickLinks.length > 0 ? (<ClientWorkspacePanel eyebrow="Direktzugriff" title="Schnellaktionen" subtitle="Häufig genutzte Bereiche" style={styles.sidePanel}>
            <View style={styles.quickLinks}>
              {overview.quickLinks.map((link, index) => (<Pressable key={link.tab} style={styles.quickLink} onPress={() => onNavigateTab(link.tab)}>
                  <View style={styles.quickLinkNumber}><Text style={styles.quickLinkNumberText}>{index + 1}</Text></View>
                  <Text style={styles.quickLinkLabel}>{link.label}</Text>
                  <Text style={styles.arrow}>→</Text>
                </Pressable>))}
            </View>
          </ClientWorkspacePanel>) : null}
      </View>
    </View>);
}
const styles = StyleSheet.create({
    root: { gap: careSpacing.md },
    focusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
    focusCard: { flex: 1, minWidth: 180, minHeight: 108 },
    focusHeader: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: careSpacing.sm },
    focusIcon: { color: careSuiteAuroraTheme.accent.cyan, fontSize: 22, fontWeight: '900' },
    focusValue: { maxWidth: '100%', flexShrink: 1, color: careSuiteAuroraTheme.text.primary, fontSize: 15, lineHeight: 21, fontWeight: '800' },
    workspace: { gap: careSpacing.md },
    workspaceWide: { flexDirection: 'row', alignItems: 'flex-start' },
    mainColumn: { flex: 1, minWidth: 0, gap: careSpacing.md },
    sidePanel: { width: '100%', maxWidth: 360, flexShrink: 0 },
    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.md },
    summaryColumn: { flex: 1, minWidth: 180, maxWidth: '100%' },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: careSpacing.sm,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: careSuiteAuroraTheme.glass.border,
    },
    summaryLabel: { flex: 0.8, color: careSuiteAuroraTheme.text.muted, fontSize: 11, lineHeight: 16, fontWeight: '800' },
    summaryValue: { flex: 1.2, color: careSuiteAuroraTheme.text.primary, fontSize: 13, lineHeight: 18, fontWeight: '800', textAlign: 'right' },
    evidenceGroup: { gap: careSpacing.md, minWidth: 0, maxWidth: '100%' },
    evidenceCard: { gap: careSpacing.sm, minWidth: 0, padding: careSpacing.sm, borderRadius: careRadius.lg, borderWidth: 1, borderColor: careSuiteAuroraTheme.glass.border, backgroundColor: 'rgba(255,255,255,0.045)' },
    evidenceField: { gap: 3, minWidth: 0, maxWidth: '100%' },
    evidenceLabel: { color: careSuiteAuroraTheme.text.primary, fontSize: 12, lineHeight: 18, fontWeight: '700', flexShrink: 1, maxWidth: '100%' },
    evidenceButtonText: { color: careSuiteAuroraTheme.accent.cyan, fontSize: 13, lineHeight: 19, fontWeight: '800', flexShrink: 1, maxWidth: '100%' },
    evidenceButton: { paddingVertical: careSpacing.sm, minWidth: 0, maxWidth: '100%' },
    documentList: { gap: 7 },
    documentTitle: { flexShrink: 1, maxWidth: '100%', color: careSuiteAuroraTheme.text.primary, fontSize: 13, fontWeight: '800' },
    documentDate: { flexShrink: 1, maxWidth: '100%', color: careSuiteAuroraTheme.text.muted, fontSize: 11, fontWeight: '600' },
    emptyDocuments: { gap: 4, paddingVertical: careSpacing.sm },
    emptyDocumentsTitle: { color: careSuiteAuroraTheme.text.primary, fontSize: 14, fontWeight: '900' },
    emptyDocumentsText: { color: careSuiteAuroraTheme.text.muted, fontSize: 12, lineHeight: 17, fontWeight: '600' },
    quickLinks: { gap: 7 },
    quickLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: careSpacing.sm,
        padding: careSpacing.sm,
        borderRadius: careRadius.lg,
        borderWidth: 1,
        borderColor: careSuiteAuroraTheme.glass.border,
        backgroundColor: 'rgba(255,255,255,0.045)',
    },
    quickLinkNumber: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(105,232,255,0.10)',
    },
    quickLinkNumberText: { color: careSuiteAuroraTheme.accent.cyan, fontSize: 12, fontWeight: '900' },
    quickLinkLabel: { flex: 1, color: careSuiteAuroraTheme.text.primary, fontSize: 13, fontWeight: '800' },
    arrow: { color: careSuiteAuroraTheme.accent.cyan, fontSize: 18, fontWeight: '900' },
});
