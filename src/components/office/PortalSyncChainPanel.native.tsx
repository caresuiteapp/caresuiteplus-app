// Generated native presentation from src/components/office/PortalSyncChainPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStrong,NativeP,NativeSection,NativeArticle,NativeH3,NativeSpan,NativeSmall} from '@/components/layout/NativeWorkspaceElements.native';
import { getPortalSyncStateForVisit } from '@/lib/portal/portalVisibilityService';
import { ASSIST_PROOF_PORTAL_RELEASE_LABELS, ASSIST_PROOF_STATUS_LABELS } from '@/lib/assist/assistProofLabels';
type SyncRow = {
    visitId: string;
    assignmentId?: string | null;
    employeePortalStatus?: string;
    assistProofStatus?: string | null;
    officeReleaseStatus?: string | null;
    portalVisible?: boolean;
    pdfStoragePath?: string | null;
    signatureComplete?: boolean;
    label?: string;
};
const STATUS_LABELS: Record<string, string> = { ...ASSIST_PROOF_STATUS_LABELS, ...ASSIST_PROOF_PORTAL_RELEASE_LABELS, unknown: 'Nicht bekannt', pending: 'Ausstehend', planned: 'Geplant', scheduled: 'Geplant', geplant: 'Geplant', confirmed: 'Bestätigt', bestaetigt: 'Bestätigt', in_progress: 'Läuft', gestartet: 'Läuft', completed: 'Abgeschlossen', abgeschlossen: 'Abgeschlossen', cancelled: 'Abgesagt', canceled: 'Abgesagt', storniert: 'Abgesagt' };
function label(value?: string | null) { return !value || value === '—' ? 'Nicht vorhanden' : STATUS_LABELS[value] ?? 'Status nicht verfügbar'; }
export function PortalSyncChainPanel({ rows = [] }: {
    rows?: SyncRow[];
}) {
    if (!rows.length)
        return <NativeDiv className="cs-portal-empty"><NativeStrong>Noch keine Nachweise vorhanden</NativeStrong><NativeP>Sobald ein Einsatz dokumentiert wurde, sehen Sie hier den Stand von Unterschrift, Dokument und Freigabe.</NativeP></NativeDiv>;
    return <NativeSection aria-label="Freigabestatus der Leistungsnachweise">{rows.map((row) => {
            const state = getPortalSyncStateForVisit(row);
            return <NativeArticle key={row.visitId} className="cs-portal-request"><NativeDiv className="cs-portal-row"><NativeH3>{row.label ?? 'Leistungsnachweis zum Einsatz'}</NativeH3><NativeSpan className={`cs-portal-pill${state.clientPortalVisible ? ' active' : ' warning'}`}>{state.clientPortalVisible ? 'Nachweis zur Portalansicht freigegeben' : 'Nachweis noch nicht zur Portalansicht freigegeben'}</NativeSpan></NativeDiv><NativeDiv className="cs-portal-proof-grid"><NativeDiv><NativeSmall>Einsatz</NativeSmall><NativeStrong>{label(state.employeePortalStatus)}</NativeStrong></NativeDiv><NativeDiv><NativeSmall>Leistungsnachweis</NativeSmall><NativeStrong>{label(state.assistProofStatus)}</NativeStrong></NativeDiv><NativeDiv><NativeSmall>Prüfung durch die Verwaltung</NativeSmall><NativeStrong>{label(state.officeReleaseStatus)}</NativeStrong></NativeDiv><NativeDiv><NativeSmall>Unterlagen</NativeSmall><NativeStrong>{state.pdfAvailable ? 'PDF vorhanden' : 'PDF fehlt'} · {state.signatureComplete ? 'Unterschrift vollständig' : 'Unterschrift fehlt'}</NativeStrong></NativeDiv></NativeDiv></NativeArticle>;
        })}</NativeSection>;
}
