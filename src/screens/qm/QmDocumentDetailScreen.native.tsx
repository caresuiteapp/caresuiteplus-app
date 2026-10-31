// Generated native presentation from src/screens/qm/QmDocumentDetailScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeHeader,NativeDiv,NativeButton,NativeH1,NativeP,NativeDetails,NativeSummary,NativeStrong,NativeSpan,NativeStyle,NativeSection,NativeH2,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { ErrorState, LoadingState } from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useQmRuntimePermissions } from "../../hooks/qm/useQmRuntimePermissions.native.ts";
import { useQmDocumentReferenceRead } from "../../hooks/qm/useQmDocumentReferenceRead.native.ts";
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getServiceMode } from '@/lib/services/mode';
import type { ClientNativeRow } from "../../lib/clients/clientRecordNativeOriginal.native.ts";
import type { QmVersionReferenceWeb, QmVersionReadEvidenceWeb } from "../../lib/qm/qmDocumentVersionReference.native.ts";
import { projectQmHygieneInstructionEvidenceWeb, type QmHygieneEvidenceFieldWeb, type QmHygieneEvidenceTagsWeb } from "../../lib/qm/qmHygieneInstructionEvidence.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { webScaledFontMetric } from '@/design/web/webFontSize';
import { CatalogIcon } from "../../components/catalog/CatalogWorkspace.native.tsx";
import { qmWorkspaceCss } from "../../components/qm/qmWorkspaceCss.native.ts";
import { qmDocumentWorkspaceCss } from "../../components/qm/qmDocumentWorkspaceCss.native.ts";
import { QmDocumentDetailScreen as LegacyQmDocumentDetailScreen } from './QmDocumentDetailScreen.tsx';
function QmDocumentDetailHeader({ title, refresh }: {
    title: string;
    refresh: () => Promise<void>;
}) {
    const router = useRouter();
    return <NativeHeader className="qm-header"><NativeDiv><NativeButton className="qm-button qm-button--quiet" type="button" onClick={() => router.push('/business/office/qm/documents' as never)}><CatalogIcon kind="back"/>QM-Dokumente</NativeButton><NativeH1>{title}</NativeH1><NativeP className="qm-muted">Gespeicherte Fassung und zugehörige Lesebelege</NativeP></NativeDiv><NativeButton className="qm-button" type="button" onClick={() => void refresh()}><CatalogIcon kind="refresh"/>Aktualisieren</NativeButton></NativeHeader>;
}
const states: Record<string, string> = { missing: 'Die gespeicherte Fassungsreferenz fehlt.', null: 'Keine Fassungsreferenz gespeichert.', empty: 'Die gespeicherte Referenz ist leer.', invalid: 'Das Format der gespeicherten Referenz ist ungeklärt.', unresolved: 'Die referenzierte Fassung ist nicht im gelieferten Auszug enthalten.' };
const versionStatuses = ['draft', 'in_review', 'approved', 'published', 'archived', 'superseded'];
function primitive(row: ClientNativeRow, key: string): string {
    if (!Object.hasOwn(row, key))
        return 'Nicht geliefert';
    const value = row[key];
    if (value === null)
        return 'Kein Wert gespeichert';
    if (value === undefined)
        return 'Nicht geliefert';
    if (value === '')
        return 'Leer gespeichert';
    return typeof value === 'string' ? value : 'Format ungeklärt';
}
function textValue(row: ClientNativeRow, key: string): string | null { return Object.hasOwn(row, key) && typeof row[key] === 'string' ? row[key] : null; }
function evidenceField(value: QmHygieneEvidenceFieldWeb): string { return value.state === 'value' ? value.value! : value.state === 'missing' ? 'Nicht geliefert' : value.state === 'undefined' ? 'Ungeklärter eigener Feldwert' : value.state === 'null' ? 'NULL im Original' : value.state === 'empty' ? 'Leer im Original' : 'Originalformat ungeklärt'; }
function evidenceTags(value: QmHygieneEvidenceTagsWeb): string { return value.state === 'value' ? value.value!.join(' · ') : value.state === 'empty' ? 'Leere Originalliste' : value.state === 'missing' ? 'Nicht geliefert' : value.state === 'undefined' ? 'Ungeklärter eigener Feldwert' : value.state === 'null' ? 'NULL im Original' : 'Originalformat ungeklärt'; }
function projectedVersion(view: QmVersionReferenceWeb) {
    const row = view.reference.version;
    if (!row)
        return null;
    const status = textValue(row, 'status');
    // Unknown raw status/content/metadata are never cast to public DTOs, serialized or passed to a child.
    return { id: primitive(row, 'id'), number: primitive(row, 'versionNumber'), status: status !== null && versionStatuses.includes(status) ? status : 'Gespeicherter Status ungeklärt', content: textValue(row, 'content'), approvedBy: primitive(row, 'approvedBy'), approvedAt: primitive(row, 'approvedAt'), publishedAt: primitive(row, 'publishedAt'), createdAt: primitive(row, 'createdAt'), updatedAt: primitive(row, 'updatedAt') };
}
function NativeQmDocumentDetail() {
    const params = useLocalSearchParams<{
        id: string;
    }>(), runtime = useQmRuntimePermissions();
    const auth = useAuth(), tenant = useServiceTenantId(), read = useQmDocumentReferenceRead(params.id, runtime);
    const { c } = useCareLightPalette(), styles = useMemo(() => createStyles(c), [c]);
    const view = read.view(), version = view ? projectedVersion(view) : null, hygieneResult = view ? projectQmHygieneInstructionEvidenceWeb(view.originals, { tenantId: tenant, documentId: params.id }) : null, hygiene = hygieneResult?.ok ? hygieneResult.data : null;
    const evidence = (label: string, rows: readonly QmVersionReadEvidenceWeb[]) => <NativeDetails className="qm-panel qmd-detail-fold"><NativeSummary><NativeStrong>{label}</NativeStrong><NativeSpan className="qm-status">{rows.length} gelieferte Belege</NativeSpan></NativeSummary><NativeDiv className="qm-panel-body">{rows.length === 0 ? <Text style={styles.secondary}>Dieser Auszug enthält in dieser Gruppe keine Zeilen. Vollständigkeit und Aktualität sind nicht bestätigt.</Text> : rows.map(entry => <View key={primitive(entry.original, 'id')} style={styles.evidence}><Text style={styles.body}>{primitive(entry.original, 'userDisplayName')}</Text><Text selectable style={styles.secondary}>Personkennung: {primitive(entry.original, 'userId')}</Text><Text selectable style={styles.secondary}>Bestätigungsmetadatum: {primitive(entry.original, 'confirmedAt')}</Text><Text selectable style={styles.secondary}>Versionsbezug: {primitive(entry.original, 'documentVersionId')}</Text><Text selectable style={styles.secondary}>Beleg-ID: {primitive(entry.original, 'id')}</Text><Text selectable style={styles.secondary}>Erfasst: {primitive(entry.original, 'createdAt')} · Geändert: {primitive(entry.original, 'updatedAt')}</Text>{entry.relation === 'unresolved' ? <Text style={styles.secondary}>{entry.reason === 'version_not_supplied' ? 'Die Versionszeile ist nicht geliefert.' : 'Die aktuelle Headerreferenz ist ungeklärt.'}</Text> : null}</View>)}</NativeDiv></NativeDetails>;
    if (runtime.loading)
        return <ScreenShell title="QM-Dokument"><LoadingState message="Die aktuellen Zugriffsrechte werden geprüft…"/></ScreenShell>;
    if (runtime.error)
        return <ScreenShell title="QM-Dokument"><ErrorState presentation="inline" message={runtime.error} onRetry={runtime.refreshPermissions}/></ScreenShell>;
    if (!runtime.can('qm.view') || !runtime.can('qm.view_versions') || !auth.profile || auth.profile.tenantId !== tenant)
        return <ScreenShell title="QM-Dokument"><LockedActionBanner message="Der aktuelle eigene Zugriff auf Dokument und Fassungen ist nicht bestätigt." roleLabel={runtime.roleLabel}/></ScreenShell>;
    const pending = Object.values(read.states).some(state => state.state === 'loading' || state.state === 'refreshing');
    if (pending)
        return <ScreenShell title="QM-Dokument"><LoadingState message="Die getrennten Dokument- und Belegausschnitte werden gelesen…"/></ScreenShell>;
    if (!view)
        return <ScreenShell title="QM-Dokument"><ErrorState presentation="inline" message={Object.values(read.states).find(state => state.error)?.error ?? 'Der gelieferte Dokument- oder Belegausschnitt ist ungeklärt. Ein leerer Lesebelegbestand ist dadurch nicht bestätigt.'} onRetry={read.refresh}/></ScreenShell>;
    if (!read.isCurrent())
        return <ScreenShell title="QM-Dokument"><LockedActionBanner message="Dieser eigene Lesezugriff ist nicht mehr aktuell." roleLabel={runtime.roleLabel}/></ScreenShell>;
    return <NativeWorkspaceStyleScope css={[qmWorkspaceCss + qmDocumentWorkspaceCss]}>{<ScreenShell title={textValue(view.originals.document, 'title') ?? 'QM-Dokument'} subtitle="Gespeicherte Referenz und gelieferte Belege" contentOwnsHeader showBack={false}><NativeStyle>{qmWorkspaceCss + qmDocumentWorkspaceCss}</NativeStyle><NativeDiv className="qm-workspace">
  <QmDocumentDetailHeader title={textValue(view.originals.document, 'title') ?? 'QM-Dokument'} refresh={read.refresh}/>
  <NativeDiv className="qm-notice" data-tone="warning"><NativeDiv><NativeStrong>Gespeicherter Dokumentauszug</NativeStrong><NativeP>Vollständigkeit, Aktualität und fachliche Gültigkeit der Anweisung sind damit nicht nachgewiesen. Eine Lesebestätigung bestätigt keine Durchführung.</NativeP></NativeDiv></NativeDiv>
  <NativeSection className="qm-panel"><NativeHeader className="qm-panel-head"><NativeH2>Dokumentangaben</NativeH2><NativeSpan className="qm-status">{primitive(view.originals.document, 'documentNumber')}</NativeSpan></NativeHeader><NativeDiv className="qmd-meta"><NativeSpan>Headerstatus: <NativeStrong>{primitive(view.originals.document, 'status')}</NativeStrong></NativeSpan><NativeSpan>Gespeicherte Verantwortung: <NativeStrong>{primitive(view.originals.document, 'ownerRole')}</NativeStrong></NativeSpan><NativeSpan>Reviewfrist: <NativeStrong>{primitive(view.originals.document, 'reviewDueAt')}</NativeStrong></NativeSpan></NativeDiv><NativeDetails className="qmd-detail-fold"><NativeSummary>Gespeicherte Kennungen und Zeitangaben</NativeSummary><NativeDiv className="qm-panel-body"><Text selectable style={styles.secondary}>Dokument-ID: {primitive(view.originals.document, 'id')}</Text><Text selectable style={styles.secondary}>Header erfasst: {primitive(view.originals.document, 'createdAt')} · geändert: {primitive(view.originals.document, 'updatedAt')}</Text><Text selectable style={styles.secondary}>Gespeicherte Referenz: {primitive(view.originals.document, 'currentVersionId')}</Text></NativeDiv></NativeDetails></NativeSection>
  <NativeSection className="qm-panel"><NativeHeader className="qm-panel-head"><NativeDiv><NativeSpan className="qm-eyebrow">Im Dokument referenzierte Fassung</NativeSpan><NativeH2>{version ? `Fassung ${version.number}` : 'Fassungsreferenz ungeklärt'}</NativeH2></NativeDiv>{version ? <NativeSpan className="qm-status">{version.status}</NativeSpan> : null}</NativeHeader>{version ? <><NativeDiv className="qmd-paper"><Text selectable style={styles.content}>{version.content ?? 'Der Inhalt besitzt kein bestätigtes Textformat.'}</Text></NativeDiv><NativeDetails className="qmd-detail-fold"><NativeSummary>Fassungs- und Freigabemetadaten</NativeSummary><NativeDiv className="qm-panel-body"><Text selectable style={styles.body}>Fassungs-ID: {version.id}</Text><Text style={styles.body}>Gespeicherte Nummer: {version.number} · Status: {version.status}</Text><Text style={styles.body}>Freigabemetadatum: {version.approvedBy}</Text><Text selectable style={styles.secondary}>Freigabezeit: {version.approvedAt}</Text><Text selectable style={styles.secondary}>Publikationszeit: {version.publishedAt}</Text><Text selectable style={styles.secondary}>Fassung erfasst: {version.createdAt} · geändert: {version.updatedAt}</Text></NativeDiv></NativeDetails></> : <NativeDiv className="qm-panel-body"><Text style={styles.secondary}>{states[view.reference.state] ?? 'Die Fassungsreferenz ist ungeklärt.'} Es wird keine andere Fassung als Ersatz angezeigt.</Text></NativeDiv>}</NativeSection>
  {hygiene ? <NativeDetails className="qm-panel qmd-detail-fold"><NativeSummary><NativeStrong>Hygieneplan- und Anweisungszuordnung</NativeStrong></NativeSummary><NativeDiv className="qm-panel-body"><Text style={styles.secondary}>Dieser Abschnitt zeigt nur die ausgewählte native QM-Referenz. Titel, Typ, Tags, Status und Verantwortungsbezeichnung klassifizieren keinen Hygieneplan und bestätigen keine beim Einsatz gültige Anweisung.</Text><Text style={styles.body}>Dokumenttyp: {evidenceField(hygiene.document.documentType)}</Text><Text style={styles.body}>Originaltags: {evidenceTags(hygiene.document.tags)}</Text><Text style={styles.body}>Gespeicherte Verantwortungsbezeichnung: {evidenceField(hygiene.document.storedResponsibleLabel)}</Text><Text selectable style={styles.body}>Gespeicherte Reviewfrist: {evidenceField(hygiene.document.reviewDueAt)}</Text><Text style={styles.secondary}>Keine native Zuordnung zu Tätigkeit, Schutzbedarf oder Einsatzstelle geliefert. Gültigkeit beim tatsächlichen Einsatz, verantwortliche Personenidentität, Freigabe, Kenntnisnahme und Durchführung werden nicht abgeleitet.</Text></NativeDiv></NativeDetails> : null}
  {evidence('Zur gespeicherten Referenz', view.evidence.current)}{evidence('Zu anderen gelieferten Fassungen', view.evidence.other)}{evidence('Ungeklärter Versionsbezug', view.evidence.unresolved)}
  <NativeDetails className="qm-panel qmd-detail-fold"><NativeSummary><NativeStrong>Gelieferte Fassungen</NativeStrong><NativeSpan className="qm-status">{view.originals.versions.length}</NativeSpan></NativeSummary><NativeDiv className="qm-panel-body"><Text style={styles.secondary}>Die Reihenfolge bleibt geliefert; sie legt keine gültige oder aktuelle Fassung fest.</Text>{view.originals.versions.map(row => <View key={primitive(row, 'id')} style={styles.evidence}><Text style={styles.body}>Nummer: {primitive(row, 'versionNumber')} · gespeicherter Status: {primitive(row, 'status')}</Text><Text style={styles.secondary}>{primitive(row, 'changeSummary')}</Text><Text selectable style={styles.secondary}>Fassungs-ID: {primitive(row, 'id')}</Text><Text selectable style={styles.secondary}>Erfasst: {primitive(row, 'createdAt')} · geändert: {primitive(row, 'updatedAt')}</Text></View>)}</NativeDiv></NativeDetails>
 </NativeDiv></ScreenShell>}</NativeWorkspaceStyleScope>;
}
/** Explicit physical shared file delegation preserves the existing non-UUID demo dataset and its prepared workflows. */
export function QmDocumentDetailScreen() { return getServiceMode() === 'demo' ? <LegacyQmDocumentDetailScreen key="legacy-demo"/> : <NativeQmDocumentDetail key="native-supabase"/>; }
function createStyles(_c: ReturnType<typeof useCareLightPalette>['c']) { const size = webScaledFontMetric; return StyleSheet.create({ body: { fontSize: size(15), lineHeight: size(24), color: '#203c58', flexShrink: 1 }, secondary: { fontSize: size(13), lineHeight: size(22), color: '#52677d', flexShrink: 1 }, content: { fontSize: size(16), lineHeight: size(28), color: '#203c58' }, evidence: { gap: careSpacing.xs, paddingVertical: careSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d6e3ef' } }); }
