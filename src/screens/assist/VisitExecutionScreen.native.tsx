// Generated native presentation from src/screens/assist/VisitExecutionScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeH2,NativeP,NativeButton,NativeStyle,NativeDl,NativeDt,NativeDd,NativeSpan,NativeSmall,NativeSection,NativeAside,NativeNav,NativeA,NativeDetails,NativeSummary,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter as useRouter } from "../../hooks/useFlowRouter.ts";
import { AssignmentsWorkspaceShell, AssignmentWorkspaceIcon } from "../../components/assist/AssignmentsWorkspaceShell.native.tsx";
import { AdministrativeVisitFollowUpPanel } from "../../components/assist/AdministrativeVisitFollowUpPanel.native.tsx";
import { VisitProofPreviewPanel } from "../../components/assist/VisitProofPreviewPanel.native.tsx";
import { DocumentModuleTemplatesPanel } from "../../components/documents/DocumentModuleTemplatesPanel.native.tsx";
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
    if (!value)
        return 'Noch nicht erfasst';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return 'Keine gültige Zeitangabe';
    return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}
export function VisitExecutionScreen() {
    const params = useLocalSearchParams<{
        id?: string | string[];
    }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can, roleKey } = usePermissions();
    const router = useRouter();
    const allowed = Boolean(roleKey && !isPortalOnlyRole(roleKey) && can('assist.assignments.view') && can('assist.execution.view'));
    const scope = JSON.stringify([tenantId, id, profile?.id, profile?.roleKey, roleKey, allowed, can('assist.execution.manage')]);
    if (!allowed || !tenantId || !id)
        return <NativeWorkspaceStyleScope css={[css]}>{<AssignmentsWorkspaceShell title="Einsatz durchführen" description="Einsatzakte und Nachbearbeitung" onBack={() => router.back()}><NativeDiv className="aw-alert" data-tone="warning" role="alert">{!allowed ? 'Sie haben keine Berechtigung, diese Einsatzdurchführung anzusehen.' : !tenantId ? 'Bitte wählen Sie zuerst ein Unternehmen aus.' : 'Es wurde kein Einsatz ausgewählt.'}</NativeDiv></AssignmentsWorkspaceShell>}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope css={[css]}>{<ExecutionWorkspace key={scope} id={id} tenantId={tenantId}/>}</NativeWorkspaceStyleScope>;
}
function ExecutionWorkspace({ id, tenantId }: {
    id: string;
    tenantId: string;
}) {
    const router = useRouter();
    const { can, check, roleKey } = usePermissions();
    const { profile } = useAuth();
    const actor = usePortalActor();
    const { data: visit, loading, error, refreshError, refresh, refreshAfterSave, notFound } = useVisitDispositionDetail(id);
    const [drafts, setDrafts] = useState<Record<string, VisitTaskStatus>>({});
    const [state, setState] = useState({ dirty: false, busy: false });
    const canManage = Boolean(roleKey && !isPortalOnlyRole(roleKey) && can('assist.assignments.view') && can('assist.execution.manage'));
    // The scoped query may resolve a legacy/series ID to its concrete visit ID.
    const safeVisit = visit?.tenantId === tenantId ? visit : null;
    const [preparing, setPreparing] = useState(false);
    const [prepareError, setPrepareError] = useState<string | null>(null);
    const mounted = useRef(true), prepareLock = useRef(false);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const pending = safeVisit?.tasks.filter(task => drafts[task.id] != null && drafts[task.id] !== task.status).length ?? 0;
    const preview = useMemo(() => safeVisit ? buildVisitProofPreview({ ...safeVisit, tasks: safeVisit.tasks.map(task => ({ ...task, status: drafts[task.id] ?? task.status })) }, safeVisit.documentationNotes ?? null) : null, [safeVisit, drafts]);
    if (loading && !safeVisit)
        return <NativeWorkspaceStyleScope css={[css]}>{<AssignmentsWorkspaceShell title="Einsatz durchführen" description="Die Einsatzakte wird geladen." onBack={() => router.back()}><NativeDiv className="aw-skeleton" role="status" aria-label="Einsatzdaten werden geladen"/></AssignmentsWorkspaceShell>}</NativeWorkspaceStyleScope>;
    if (notFound || error || !safeVisit)
        return <NativeWorkspaceStyleScope css={[css]}>{<AssignmentsWorkspaceShell title="Einsatz durchführen" description="Einsatzakte und Nachbearbeitung" onBack={() => router.back()}><NativeDiv className="aw-empty"><AssignmentWorkspaceIcon name="alert" size={30}/><NativeH2>Einsatz konnte nicht geladen werden</NativeH2><NativeP role="alert">{error ?? 'Dieser Einsatz ist nicht verfügbar oder gehört zu einem anderen Unternehmen.'}</NativeP><NativeButton type="button" className="aw-button" onClick={refresh}>Erneut laden</NativeButton></NativeDiv></AssignmentsWorkspaceShell>}</NativeWorkspaceStyleScope>;
    const completed = safeVisit.assignmentStatus === 'abgeschlossen';
    const ownVisit = actor.employeeId && safeVisit.employeeId === actor.employeeId && actor.tenantId === tenantId;
    const signature = Boolean(safeVisit.persistedSignature) || safeVisit.proofStatus === 'signed' || safeVisit.proofStatus === 'verified';
    const virtual = isVirtualRecurringOccurrenceId(safeVisit.id);
    const prepareOccurrence = async () => {
        if (prepareLock.current || !canManage)
            return;
        prepareLock.current = true;
        setPreparing(true);
        setPrepareError(null);
        try {
            const result = await resolveExecutableVisitId(tenantId, safeVisit.id, profile?.roleKey);
            if (!mounted.current)
                return;
            if (!result.ok) {
                setPrepareError(result.error);
                return;
            }
            if (isVirtualRecurringOccurrenceId(result.data.visitId)) {
                setPrepareError('Der Einzeltermin konnte noch nicht geöffnet werden. Bitte erneut versuchen.');
                return;
            }
            router.replace(`/assist/assignments/${result.data.visitId}/execute` as never);
        }
        catch {
            if (mounted.current)
                setPrepareError('Der Einzeltermin konnte nicht geöffnet werden. Bitte erneut versuchen.');
        }
        finally {
            if (mounted.current) {
                prepareLock.current = false;
                setPreparing(false);
            }
        }
    };
    const phaseLabel = visitWorkflowLabel(safeVisit.assignmentStatus, safeVisit.proofStatus);
    return <NativeWorkspaceStyleScope css={[css, css]}>{<SurfaceContrastProvider tone="light"><AssignmentsWorkspaceShell title={safeVisit.title || 'Einsatz durchführen'} description={`${safeVisit.clientName} · Zeiten, Aufgaben und Abschluss gemeinsam prüfen.`} eyebrow="EINSÄTZE · DURCHFÜHRUNG" onBack={() => router.back()} actions={<><NativeButton type="button" className="aw-button" disabled={state.dirty || state.busy || preparing || loading} onClick={refresh}><AssignmentWorkspaceIcon name="refresh" size={16}/>Aktualisieren</NativeButton><NativeButton type="button" className="aw-button" disabled={state.busy || preparing} onClick={() => router.push(`/assist/assignments/${safeVisit.id}` as never)}>Einsatzdetails<AssignmentWorkspaceIcon name="arrow" size={16}/></NativeButton></>}>
    <NativeStyle>{css}</NativeStyle>
    {refreshError ? <NativeDiv className="aw-alert" data-tone="warning" role="alert">Die Aktualisierung ist fehlgeschlagen. Der zuletzt geladene Stand bleibt sichtbar. {refreshError}<NativeButton type="button" className="aw-button" disabled={state.dirty || state.busy} onClick={refresh}>Erneut laden</NativeButton></NativeDiv> : null}
    {safeVisit.errorMessage ? <NativeDiv className="aw-alert" data-tone="warning" role="alert">{safeVisit.errorMessage}</NativeDiv> : null}
    <NativeDl className="aex-overview" style={{ margin: 0 }}>
      <NativeDiv className="aex-stat"><NativeDt><AssignmentWorkspaceIcon name="play" size={15}/>Einsatzstatus</NativeDt><NativeDd><NativeSpan className="aw-chip" data-tone={completed ? 'green' : 'blue'}>{phaseLabel}</NativeSpan></NativeDd></NativeDiv>
      <NativeDiv className="aex-stat"><NativeDt><AssignmentWorkspaceIcon name="check" size={15}/>Aufgaben</NativeDt><NativeDd>{safeVisit.tasks.filter(task => task.status !== 'open').length} von {safeVisit.tasks.length} geprüft<NativeSmall>{pending ? `${pending} Änderungen vorgemerkt` : 'Gespeicherter Stand'}</NativeSmall></NativeDd></NativeDiv>
      <NativeDiv className="aex-stat"><NativeDt><AssignmentWorkspaceIcon name="clipboard" size={15}/>Dokumentation</NativeDt><NativeDd>{VISIT_DOCUMENTATION_STATUS_LABELS[safeVisit.documentationStatus]}<NativeSmall>{safeVisit.documentationNotes?.trim() ? 'Eintrag vorhanden' : 'Noch kein Eintrag'}</NativeSmall></NativeDd></NativeDiv>
      <NativeDiv className="aex-stat"><NativeDt><AssignmentWorkspaceIcon name="edit" size={15}/>Unterschrift</NativeDt><NativeDd>{signature ? 'Vorhanden' : VISIT_PROOF_STATUS_LABELS[safeVisit.proofStatus]}<NativeSmall>{signature ? 'Dem Nachweis zugeordnet' : 'Für die Abrechnung erforderlich'}</NativeSmall></NativeDd></NativeDiv>
    </NativeDl>
    <NativeSection className="aw-panel aex-context"><NativeDiv><NativeH2>Einsatz im Überblick</NativeH2><NativeDl>
      {[['Klient:in', safeVisit.clientName], ['Mitarbeitende:r', safeVisit.employeeName || 'Noch nicht zugeordnet'], ['Leistung', safeVisit.serviceName || safeVisit.title], ['Einsatzort', safeVisit.addressSnapshot || safeVisit.location || 'Noch nicht hinterlegt'], ['Geplanter Beginn', dateTime(safeVisit.scheduledStart)], ['Geplantes Ende', dateTime(safeVisit.scheduledEnd)]].map(([label, value]) => <NativeDiv key={label}><NativeDt>{label}</NativeDt><NativeDd>{value}</NativeDd></NativeDiv>)}
    </NativeDl></NativeDiv><NativeAside><NativeH2>Erfasste Zeiten</NativeH2><NativeDl>{[['Unterwegs seit', dateTime(safeVisit.onTheWayAt)], ['Angekommen', dateTime(safeVisit.arrivedAt)], ['Einsatzbeginn', dateTime(safeVisit.actualStartAt)], ['Einsatzende', dateTime(safeVisit.actualEndAt)]].map(([label, value]) => <NativeDiv key={label}><NativeDt>{label}</NativeDt><NativeDd>{value}</NativeDd></NativeDiv>)}</NativeDl>
      {ownVisit ? <NativeButton type="button" className="aw-button aw-button--primary" disabled={state.busy || preparing} onClick={() => router.push(`/portal/employee/assignments/${safeVisit.id}/execute` as never)}><AssignmentWorkspaceIcon name="play" size={16}/>Eigene Durchführung öffnen</NativeButton> : <NativeP className="aw-hint">Die laufende Zeiterfassung erfolgt im Mitarbeiterportal. Hier können Sie den Einsatz prüfen und nachbearbeiten.</NativeP>}
    </NativeAside></NativeSection>
    {safeVisit.employeeInternalNotes?.trim() ? <NativeSection className="aw-panel"><NativeH2>Interne Mitarbeitenden-Notiz</NativeH2><NativeP className="aex-note">{safeVisit.employeeInternalNotes}</NativeP></NativeSection> : null}
    {canManage && virtual ? <NativeSection className="aw-panel"><NativeH2>Einzeltermin der Serie</NativeH2><NativeP className="aw-hint">Für die Nachbearbeitung wird dieser Termin als eigene Einsatzakte geöffnet. Die übrigen Serientermine bleiben unverändert.</NativeP>{prepareError ? <NativeP className="aw-alert" data-tone="warning" role="alert">{prepareError}</NativeP> : null}<NativeDiv className="aw-actions"><NativeButton type="button" className="aw-button aw-button--primary" disabled={preparing} onClick={prepareOccurrence}>{preparing ? 'Einzeltermin wird geöffnet…' : 'Einzeltermin zur Nachbearbeitung öffnen'}</NativeButton></NativeDiv></NativeSection> : canManage ? <><NativeNav className="aex-jump" aria-label="Schritte der Nachbearbeitung">{[['execution-times', 'Arbeitszeit'], ['execution-tasks', 'Aufgaben'], ['execution-documentation', 'Dokumentation'], ['execution-completion', 'Abschluss']].map(([anchor, label], index) => <NativeA key={anchor} href={`#${anchor}`}><NativeSpan>{index + 1}</NativeSpan>{label}</NativeA>)}</NativeNav><AdministrativeVisitFollowUpPanel visit={safeVisit} tenantId={tenantId} onSaved={refreshAfterSave} onMessage={() => undefined} onTaskDraftsChange={setDrafts} onStateChange={setState}/></> : <NativeDiv className="aw-alert" data-tone="info">{check('assist.execution.manage').reason ?? 'Sie können diesen Einsatz ansehen. Änderungen sind für Ihre Rolle nicht freigegeben.'}</NativeDiv>}
    {preview ? <NativeDiv className="aex-proof-area"><VisitProofPreviewPanel preview={preview} pendingChanges={pending}/></NativeDiv> : null}
    {canManage && !virtual ? <NativeDetails className="aw-panel aex-documents"><NativeSummary>Weitere Einsatzdokumente</NativeSummary><DocumentModuleTemplatesPanel tenantId={tenantId} targetModule="assist" targetArea="visit_complete" clientId={safeVisit.clientId} assignmentId={safeVisit.id} employeeId={safeVisit.employeeId ?? profile?.id} assistOnly title="Einsatz-Dokumente" subtitle="Leistungsnachweise und ergänzende Vorlagen"/></NativeDetails> : null}
  </AssignmentsWorkspaceShell></SurfaceContrastProvider>}</NativeWorkspaceStyleScope>;
}
