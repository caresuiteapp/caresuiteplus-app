import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter as useRouter } from '@/hooks/useFlowRouter';
import { AssignmentsWorkspaceShell, AssignmentWorkspaceIcon } from '@/components/assist/AssignmentsWorkspaceShell.web';
import { AdministrativeVisitFollowUpPanel } from '@/components/assist/AdministrativeVisitFollowUpPanel.web';
import { VisitProofPreviewPanel } from '@/components/assist/VisitProofPreviewPanel.web';
import { DocumentModuleTemplatesPanel } from '@/components/documents/DocumentModuleTemplatesPanel.web';
import { useVisitDispositionDetail } from '@/hooks/useVisitDispositionDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePortalActor } from '@/hooks/usePortalActor';
import { resolveExecutableVisitId } from '@/lib/assist/visitService';
import { isVirtualRecurringOccurrenceId } from '@/lib/assist/visitRecurrenceExecution';
import { buildVisitProofPreview } from '@/lib/assist/visitProofPreviewService';
import { visitWorkflowLabel } from '@/lib/assist/administrativeFollowUpState';
import { VISIT_DOCUMENTATION_STATUS_LABELS, VISIT_PROOF_STATUS_LABELS, type VisitTaskStatus } from '@/lib/assist/visitTypes';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';

const css = `
.aex-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.aex-stat{padding:17px 18px;border:1px solid #d9e7f3;border-radius:17px;background:linear-gradient(140deg,#fff,#f5faff);box-shadow:0 4px 15px #21538305;min-width:0}.aex-stat dt{display:flex;align-items:center;gap:7px;color:#59738a;font-size:12px;margin-bottom:8px}.aex-stat dd{margin:0;color:#204766;font-size:15px;line-height:1.5;font-weight:650;overflow-wrap:anywhere}.aex-stat small{display:block;color:#708397;font-size:11px;font-weight:400;margin-top:3px}.aex-context{display:grid;grid-template-columns:1.3fr 1fr;gap:22px}.aex-context dl{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px}.aex-context dt{color:#647b91;font-size:11px;margin-bottom:4px}.aex-context dd{color:#244664;margin:0;font-size:13px;overflow-wrap:anywhere}.aex-context aside{border-left:1px solid #dce7f1;padding-left:22px;display:grid;align-content:start;gap:11px}.aex-context p{margin:0}.aex-note{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;color:#3f5b71;font-size:13px}.aex-jump{display:flex;flex-wrap:wrap;gap:9px}.aex-jump a{display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:#41617f;border:1px solid #d5e3ef;background:#ffffffb8;border-radius:12px;padding:9px 13px;font-size:12px;font-weight:600;transition:background .16s,box-shadow .16s}.aex-jump a:hover{background:#edf5ff;box-shadow:0 5px 16px #297bc814}.aex-jump span{background:#e9f2fd;width:21px;height:21px;border-radius:7px;display:grid;place-items:center;color:#2869b4;font-size:10px}.aex-scope{display:grid;gap:20px}.aex-proof-area{min-width:0}.aex-documents{min-width:0}.aex-documents>summary{cursor:pointer;font-size:15px;font-weight:650;color:#264b6c}.aex-documents[open]>summary{margin-bottom:20px}.aex-empty-title{font-size:17px}.aex-context>div>h2{margin-bottom:18px}
@container(max-width:980px){.aex-overview{grid-template-columns:repeat(2,minmax(0,1fr))}.aex-context{grid-template-columns:1fr}.aex-context aside{border-left:0;padding-left:0;padding-top:18px;border-top:1px solid #dce7f1}}
@container(max-width:520px){.aex-overview{grid-template-columns:1fr 1fr;gap:9px}.aex-stat{padding:13px}.aex-stat dd{font-size:13px}.aex-context dl{grid-template-columns:1fr}.aex-jump a{flex:1 1 140px}}
`.replace(/font-size:(\d+(?:\.\d+)?)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
function dateTime(value?: string | null) {
  if (!value) return 'Noch nicht erfasst'; const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Keine gültige Zeitangabe';
  return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}
export function VisitExecutionScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const tenantId = useServiceTenantId(); const { profile } = useAuth(); const { can, roleKey } = usePermissions(); const router = useRouter();
  const allowed = Boolean(roleKey && !isPortalOnlyRole(roleKey) && can('assist.assignments.view') && can('assist.execution.view'));
  const scope = JSON.stringify([tenantId, id, profile?.id, profile?.roleKey, roleKey, allowed, can('assist.execution.manage')]);
  if (!allowed || !tenantId || !id) return <AssignmentsWorkspaceShell title="Einsatz durchführen" description="Einsatzakte und Nachbearbeitung" onBack={() => router.back()}><div className="aw-alert" data-tone="warning" role="alert">{!allowed ? 'Sie haben keine Berechtigung, diese Einsatzdurchführung anzusehen.' : !tenantId ? 'Bitte wählen Sie zuerst ein Unternehmen aus.' : 'Es wurde kein Einsatz ausgewählt.'}</div></AssignmentsWorkspaceShell>;
  return <ExecutionWorkspace key={scope} id={id} tenantId={tenantId} />;
}
function ExecutionWorkspace({ id, tenantId }: { id: string; tenantId: string }) {
  const router = useRouter(); const { can, check, roleKey } = usePermissions(); const { profile } = useAuth(); const actor = usePortalActor();
  const { data: visit, loading, error, refreshError, refresh, refreshAfterSave, notFound } = useVisitDispositionDetail(id);
  const [drafts, setDrafts] = useState<Record<string, VisitTaskStatus>>({});
  const [state, setState] = useState({ dirty: false, busy: false });
  const canManage = Boolean(roleKey && !isPortalOnlyRole(roleKey) && can('assist.assignments.view') && can('assist.execution.manage'));
  // The scoped query may resolve a legacy/series ID to its concrete visit ID.
  const safeVisit = visit?.tenantId === tenantId ? visit : null;
  const [preparing, setPreparing] = useState(false); const [prepareError, setPrepareError] = useState<string | null>(null);
  const mounted = useRef(true), prepareLock = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const pending = safeVisit?.tasks.filter(task => drafts[task.id] != null && drafts[task.id] !== task.status).length ?? 0;
  const preview = useMemo(() => safeVisit ? buildVisitProofPreview({ ...safeVisit, tasks: safeVisit.tasks.map(task => ({ ...task, status: drafts[task.id] ?? task.status })) }, safeVisit.documentationNotes ?? null) : null, [safeVisit, drafts]);
  if (loading && !safeVisit) return <AssignmentsWorkspaceShell title="Einsatz durchführen" description="Die Einsatzakte wird geladen." onBack={() => router.back()}><div className="aw-skeleton" role="status" aria-label="Einsatzdaten werden geladen" /></AssignmentsWorkspaceShell>;
  if (notFound || error || !safeVisit) return <AssignmentsWorkspaceShell title="Einsatz durchführen" description="Einsatzakte und Nachbearbeitung" onBack={() => router.back()}><div className="aw-empty"><AssignmentWorkspaceIcon name="alert" size={30} /><h2>Einsatz konnte nicht geladen werden</h2><p role="alert">{error ?? 'Dieser Einsatz ist nicht verfügbar oder gehört zu einem anderen Unternehmen.'}</p><button type="button" className="aw-button" onClick={refresh}>Erneut laden</button></div></AssignmentsWorkspaceShell>;
  const completed = safeVisit.assignmentStatus === 'abgeschlossen';
  const ownVisit = actor.employeeId && safeVisit.employeeId === actor.employeeId && actor.tenantId === tenantId;
  const signature = Boolean(safeVisit.persistedSignature) || safeVisit.proofStatus === 'signed' || safeVisit.proofStatus === 'verified';
  const virtual = isVirtualRecurringOccurrenceId(safeVisit.id);
  const prepareOccurrence = async () => {
    if (prepareLock.current || !canManage) return; prepareLock.current = true; setPreparing(true); setPrepareError(null);
    try {
      const result = await resolveExecutableVisitId(tenantId, safeVisit.id, profile?.roleKey);
      if (!mounted.current) return;
      if (!result.ok) { setPrepareError(result.error); return; }
      if (isVirtualRecurringOccurrenceId(result.data.visitId)) { setPrepareError('Der Einzeltermin konnte noch nicht geöffnet werden. Bitte erneut versuchen.'); return; }
      router.replace(`/assist/assignments/${result.data.visitId}/execute` as never);
    } catch { if (mounted.current) setPrepareError('Der Einzeltermin konnte nicht geöffnet werden. Bitte erneut versuchen.'); }
    finally { if (mounted.current) { prepareLock.current = false; setPreparing(false); } }
  };
  const phaseLabel = visitWorkflowLabel(safeVisit.assignmentStatus, safeVisit.proofStatus);
  return <SurfaceContrastProvider tone="light"><AssignmentsWorkspaceShell title={safeVisit.title || 'Einsatz durchführen'} description={`${safeVisit.clientName} · Zeiten, Aufgaben und Abschluss gemeinsam prüfen.`} eyebrow="EINSÄTZE · DURCHFÜHRUNG" onBack={() => router.back()} actions={<><button type="button" className="aw-button" disabled={state.dirty || state.busy || preparing || loading} onClick={refresh}><AssignmentWorkspaceIcon name="refresh" size={16} />Aktualisieren</button><button type="button" className="aw-button" disabled={state.busy || preparing} onClick={() => router.push(`/assist/assignments/${safeVisit.id}` as never)}>Einsatzdetails<AssignmentWorkspaceIcon name="arrow" size={16} /></button></>}>
    <style>{css}</style>
    {refreshError ? <div className="aw-alert" data-tone="warning" role="alert">Die Aktualisierung ist fehlgeschlagen. Der zuletzt geladene Stand bleibt sichtbar. {refreshError}<button type="button" className="aw-button" disabled={state.dirty || state.busy} onClick={refresh}>Erneut laden</button></div> : null}
    {safeVisit.errorMessage ? <div className="aw-alert" data-tone="warning" role="alert">{safeVisit.errorMessage}</div> : null}
    <dl className="aex-overview" style={{ margin: 0 }}>
      <div className="aex-stat"><dt><AssignmentWorkspaceIcon name="play" size={15} />Einsatzstatus</dt><dd><span className="aw-chip" data-tone={completed ? 'green' : 'blue'}>{phaseLabel}</span></dd></div>
      <div className="aex-stat"><dt><AssignmentWorkspaceIcon name="check" size={15} />Aufgaben</dt><dd>{safeVisit.tasks.filter(task => task.status !== 'open').length} von {safeVisit.tasks.length} geprüft<small>{pending ? `${pending} Änderungen vorgemerkt` : 'Gespeicherter Stand'}</small></dd></div>
      <div className="aex-stat"><dt><AssignmentWorkspaceIcon name="clipboard" size={15} />Dokumentation</dt><dd>{VISIT_DOCUMENTATION_STATUS_LABELS[safeVisit.documentationStatus]}<small>{safeVisit.documentationNotes?.trim() ? 'Eintrag vorhanden' : 'Noch kein Eintrag'}</small></dd></div>
      <div className="aex-stat"><dt><AssignmentWorkspaceIcon name="edit" size={15} />Unterschrift</dt><dd>{signature ? 'Vorhanden' : VISIT_PROOF_STATUS_LABELS[safeVisit.proofStatus]}<small>{signature ? 'Dem Nachweis zugeordnet' : 'Für die Abrechnung erforderlich'}</small></dd></div>
    </dl>
    <section className="aw-panel aex-context"><div><h2>Einsatz im Überblick</h2><dl>
      {[['Klient:in', safeVisit.clientName], ['Mitarbeitende:r', safeVisit.employeeName || 'Noch nicht zugeordnet'], ['Leistung', safeVisit.serviceName || safeVisit.title], ['Einsatzort', safeVisit.addressSnapshot || safeVisit.location || 'Noch nicht hinterlegt'], ['Geplanter Beginn', dateTime(safeVisit.scheduledStart)], ['Geplantes Ende', dateTime(safeVisit.scheduledEnd)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl></div><aside><h2>Erfasste Zeiten</h2><dl>{[['Unterwegs seit', dateTime(safeVisit.onTheWayAt)], ['Angekommen', dateTime(safeVisit.arrivedAt)], ['Einsatzbeginn', dateTime(safeVisit.actualStartAt)], ['Einsatzende', dateTime(safeVisit.actualEndAt)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {ownVisit ? <button type="button" className="aw-button aw-button--primary" disabled={state.busy || preparing} onClick={() => router.push(`/portal/employee/assignments/${safeVisit.id}/execute` as never)}><AssignmentWorkspaceIcon name="play" size={16} />Eigene Durchführung öffnen</button> : <p className="aw-hint">Die laufende Zeiterfassung erfolgt im Mitarbeiterportal. Hier können Sie den Einsatz prüfen und nachbearbeiten.</p>}
    </aside></section>
    {safeVisit.employeeInternalNotes?.trim() ? <section className="aw-panel"><h2>Interne Mitarbeitenden-Notiz</h2><p className="aex-note">{safeVisit.employeeInternalNotes}</p></section> : null}
    {canManage && virtual ? <section className="aw-panel"><h2>Einzeltermin der Serie</h2><p className="aw-hint">Für die Nachbearbeitung wird dieser Termin als eigene Einsatzakte geöffnet. Die übrigen Serientermine bleiben unverändert.</p>{prepareError ? <p className="aw-alert" data-tone="warning" role="alert">{prepareError}</p> : null}<div className="aw-actions"><button type="button" className="aw-button aw-button--primary" disabled={preparing} onClick={prepareOccurrence}>{preparing ? 'Einzeltermin wird geöffnet…' : 'Einzeltermin zur Nachbearbeitung öffnen'}</button></div></section> : canManage ? <><nav className="aex-jump" aria-label="Schritte der Nachbearbeitung">{[['execution-times', 'Arbeitszeit'], ['execution-tasks', 'Aufgaben'], ['execution-documentation', 'Dokumentation'], ['execution-completion', 'Abschluss']].map(([anchor, label], index) => <a key={anchor} href={`#${anchor}`}><span>{index + 1}</span>{label}</a>)}</nav><AdministrativeVisitFollowUpPanel visit={safeVisit} tenantId={tenantId} onSaved={refreshAfterSave} onMessage={() => undefined} onTaskDraftsChange={setDrafts} onStateChange={setState} /></> : <div className="aw-alert" data-tone="info">{check('assist.execution.manage').reason ?? 'Sie können diesen Einsatz ansehen. Änderungen sind für Ihre Rolle nicht freigegeben.'}</div>}
    {preview ? <div className="aex-proof-area"><VisitProofPreviewPanel preview={preview} pendingChanges={pending} /></div> : null}
    {canManage && !virtual ? <details className="aw-panel aex-documents"><summary>Weitere Einsatzdokumente</summary><DocumentModuleTemplatesPanel tenantId={tenantId} targetModule="assist" targetArea="visit_complete" clientId={safeVisit.clientId} assignmentId={safeVisit.id} employeeId={safeVisit.employeeId ?? profile?.id} assistOnly title="Einsatz-Dokumente" subtitle="Leistungsnachweise und ergänzende Vorlagen" /></details> : null}
  </AssignmentsWorkspaceShell></SurfaceContrastProvider>;
}
