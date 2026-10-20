import { getPortalSyncStateForVisit } from '@/lib/portal/portalVisibilityService';
import { ASSIST_PROOF_PORTAL_RELEASE_LABELS, ASSIST_PROOF_STATUS_LABELS } from '@/lib/assist/assistProofLabels';

type SyncRow = { visitId: string; assignmentId?: string | null; employeePortalStatus?: string; assistProofStatus?: string | null; officeReleaseStatus?: string | null; portalVisible?: boolean; pdfStoragePath?: string | null; signatureComplete?: boolean; label?: string };
const STATUS_LABELS: Record<string, string> = { ...ASSIST_PROOF_STATUS_LABELS, ...ASSIST_PROOF_PORTAL_RELEASE_LABELS, unknown: 'Nicht bekannt', pending: 'Ausstehend', planned: 'Geplant', scheduled: 'Geplant', geplant: 'Geplant', confirmed: 'Bestätigt', bestaetigt: 'Bestätigt', in_progress: 'Läuft', gestartet: 'Läuft', completed: 'Abgeschlossen', abgeschlossen: 'Abgeschlossen', cancelled: 'Abgesagt', canceled: 'Abgesagt', storniert: 'Abgesagt' };
function label(value?: string | null) { return !value || value === '—' ? 'Nicht vorhanden' : STATUS_LABELS[value] ?? 'Status nicht verfügbar'; }

export function PortalSyncChainPanel({ rows = [] }: { rows?: SyncRow[] }) {
  if (!rows.length) return <div className="cs-portal-empty"><strong>Noch keine Nachweise vorhanden</strong><p>Sobald ein Einsatz dokumentiert wurde, sehen Sie hier den Stand von Unterschrift, Dokument und Freigabe.</p></div>;
  return <section aria-label="Freigabestatus der Leistungsnachweise">{rows.map((row) => {
    const state = getPortalSyncStateForVisit(row);
    return <article key={row.visitId} className="cs-portal-request"><div className="cs-portal-row"><h3>{row.label ?? 'Leistungsnachweis zum Einsatz'}</h3><span className={`cs-portal-pill${state.clientPortalVisible ? ' active' : ' warning'}`}>{state.clientPortalVisible ? 'Nachweis zur Portalansicht freigegeben' : 'Nachweis noch nicht zur Portalansicht freigegeben'}</span></div><div className="cs-portal-proof-grid"><div><small>Einsatz</small><strong>{label(state.employeePortalStatus)}</strong></div><div><small>Leistungsnachweis</small><strong>{label(state.assistProofStatus)}</strong></div><div><small>Prüfung durch die Verwaltung</small><strong>{label(state.officeReleaseStatus)}</strong></div><div><small>Unterlagen</small><strong>{state.pdfAvailable ? 'PDF vorhanden' : 'PDF fehlt'} · {state.signatureComplete ? 'Unterschrift vollständig' : 'Unterschrift fehlt'}</strong></div></div></article>;
  })}</section>;
}
