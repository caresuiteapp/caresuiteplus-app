import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { DetailInfoRow } from '@/components/detail';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumBadge, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { MedicationEventTimeInput, currentMedicationEventTime, medicationEventInstant } from '@/components/pflege/MedicationEventTimeInput.web';
import { MedicationSourceComparison } from '@/components/pflege/MedicationSourceComparison.web';
import { MedicationSourceFileButton } from '@/components/pflege/MedicationSourceFileButton.web';
import { MedicationHistoricalPlan } from '@/components/pflege/MedicationHistoricalPlan.web';
import { recordMedicationEventWeb as recordMedicationEvent } from '@/lib/pflege/medicationEventWrite.web';
import { MedicationDailyPlanPanel } from '@/components/pflege/MedicationDailyPlanPanel.web';
import { MedicationOrderReviewPanel } from '@/components/pflege/MedicationOrderReviewPanel.web';
import { MedicationOrderRevisionPanel } from '@/components/pflege/MedicationOrderRevisionPanel.web';
import { MedicationSafetyWorkspacePanel } from '@/components/pflege/MedicationSafetyWorkspacePanel.web';
import { captureHistoricalMedicationPlans } from '@/lib/pflege/medicationHistoricalPlan.web';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useMedicationSubmission } from '@/hooks/useMedicationSubmission.web';
import { useCareRuntimePermissions as usePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { sameWoundJson, woundUuid } from '@/lib/pflege/woundCareDomain';
import { careAssessmentRuntimeAccess } from '@/lib/careAssessment/careAssessmentRuntimeAccess.web';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { fetchMedicationWitnessOptions } from '@/lib/pflege/medicationLiveService';
import { assertMedicationWitnessSelection, decodeMedicationWitnessPool, sameMedicationWitnessPool, type MedicationWitnessPoolOption } from '@/lib/pflege/medicationWitnessPool.web';
import { medicationTimeDisplay, validMedicationActualTime } from '@/lib/pflege/medicationTimeDisplay.web';
import { isMedicationGiven, validateMedicationAdministration, validateMedicationFollowUp, type AdministrationOutcome } from '@/lib/pflege/medicationAdministrationDomain';
import { archiveMedicationSourceCopy, changeMedicationStatus, fetchMedicationSourceFingerprint, fetchMedicationSources, fetchMedicationDocumentation, recordMedicationFollowUp, type FollowUpPayload, type MedicationDocumentation, type MedicationEvent, type MedicationEventPayload, type MedicationStatusPayload, type MedicationSourceLink } from '@/lib/pflege/medicationAdministrationService';
import type { RoleKey } from '@/types';
import { validateMedicationSource, type MedicationSourceDocument, type MedicationSourcePayload } from '@/lib/pflege/medicationSourceDomain';
import type { MedicationSourceFingerprint } from '@/lib/pflege/medicationSourceFile';
import { captureMedicationSourceWeb as linkMedicationSource } from '@/lib/pflege/medicationSourceCaptureService.web';
import { medicationSourceArchiveReadiness, medicationSourceCaptureProgress } from '@/lib/pflege/medicationSourceWorkflow.web';
import { spacing, typography } from '@/theme';

const outcomes = [{ key: 'administered', label: 'Verabreicht' }, { key: 'late', label: 'Verspätet verabreicht' }, { key: 'omitted', label: 'Ausgelassen' }, { key: 'refused', label: 'Abgelehnt' }, { key: 'held', label: 'Zurückgestellt' }];
const labels: Record<string, string> = { ...Object.fromEntries(outcomes.map(x => [x.key, x.label])), unknown: 'Status ungeklärt', scheduled: 'Geplant', active: 'Aktiv', paused: 'Pausiert', stopped: 'Beendet', archived: 'Archiviert' };
const formatTime = (value: string | null) => medicationTimeDisplay(value).display;
const painValue = (value: string) => value.trim() ? Number(value.trim().replace(',', '.')) : null;
type Context = { tenantId: string; actorId: string; role: RoleKey | null; profileRole: RoleKey | null; canView: boolean; canAdminister: boolean; canManage: boolean; canSources: boolean; unavailable: boolean; sourceUnavailable: boolean; order: MedicationDocumentation; currentSourceDocuments:MedicationSourceDocument[]; currentSourceLinks:MedicationSourceLink[]; isLeaving?():boolean; registerLeave(fn:(()=>Promise<boolean>)|null):void; refresh(): Promise<void>; close(): void; saved(message: string): void };

export function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth(); const tenantId = useServiceTenantId(); const permissions = usePermissions();
  const access=careAssessmentRuntimeAccess({tenantId,profileId:profile?.id,profileRole:profile?.roleKey,runtimeTenantId:permissions.tenantId,runtimeRole:permissions.roleKey,canView:permissions.can('pflege.medications.view'),canManage:permissions.can('pflege.medications.manage')});
  return <MedicationWorkspace key={`${tenantId}:${profile?.id}:${profile?.roleKey}:${id}`} id={id} tenantId={tenantId ?? ''} actorId={profile?.id ?? ''} role={permissions.roleKey} profileRole={profile?.roleKey??null} canView={access.canRead} canAdminister={access.canRead&&permissions.can('pflege.medications.administer')} canManage={access.canManage} canReview={access.canRead&&permissions.can('pflege.documentation.sign')} canSources={permissions.can('office.documents.view') && permissions.can('office.clients.view_sensitive')} />;
}

function MedicationWorkspace({ id, tenantId, actorId, role, profileRole, canView, canAdminister, canManage, canReview, canSources }: { id: string; tenantId: string; actorId: string; role: RoleKey | null; profileRole: RoleKey | null; canView: boolean; canAdminister: boolean; canManage: boolean; canReview:boolean; canSources: boolean }) {
  const router = useRouter(); const styles = useStyles();
  const editorLeave=useRef<(()=>Promise<boolean>)|null>(null),revisionLeave=useRef<(()=>Promise<boolean>)|null>(null),revisionEditing=useRef(false),planLeave=useRef<(()=>Promise<boolean>)|null>(null),reviewLeave=useRef<(()=>Promise<boolean>)|null>(null),planEditing=useRef(false),reviewEditing=useRef(false),activeEditor=useRef<string|null>(null);
  const [revisionActive,setRevisionActive]=useState(false),[planActive,setPlanActive]=useState(false),[reviewActive,setReviewActive]=useState(false);
  const leaveFlight=useRef(false),isLeaving=useCallback(()=>leaveFlight.current,[]);
  const registerLeave=useCallback((fn:(()=>Promise<boolean>)|null)=>{editorLeave.current=fn;},[]);
  const registerRevisionLeave=useCallback((fn:(()=>Promise<boolean>)|null)=>{revisionLeave.current=fn;},[]);
  const registerPlanLeave=useCallback((fn:(()=>Promise<boolean>)|null)=>{planLeave.current=fn;},[]);
  const registerReviewLeave=useCallback((fn:(()=>Promise<boolean>)|null)=>{reviewLeave.current=fn;},[]);
  const revisionEditingChange=useCallback((editing:boolean)=>{if(editing){try{const current=currentWorkspace();if(leaveFlight.current||revisionEditing.current||planEditing.current||reviewEditing.current||activeEditor.current!==null||current.editor!==null||current.unavailable||!current.fresh||!current.canManage||!current.canSources)return false;}catch{return false;}}revisionEditing.current=editing;setRevisionActive(editing);return true;},[]);
  const planEditingChange=useCallback((editing:boolean)=>{if(editing){try{const current=currentWorkspace();if(leaveFlight.current||planEditing.current||revisionEditing.current||reviewEditing.current||activeEditor.current!==null||current.editor!==null||current.unavailable||!current.fresh||!current.canSources||(!current.canManage&&!current.canAdminister))return false;}catch{return false;}}planEditing.current=editing;setPlanActive(editing);return true;},[]);
  const reviewEditingChange=useCallback((editing:boolean)=>{if(editing){try{const current=currentWorkspace();if(leaveFlight.current||reviewEditing.current||revisionEditing.current||planEditing.current||activeEditor.current!==null||current.editor!==null||current.unavailable||!current.fresh||!current.canManage||!current.canSources)return false;}catch{return false;}}reviewEditing.current=editing;setReviewActive(editing);return true;},[]);
  const [sourceDocuments,setSourceDocuments]=useState<MedicationSourceDocument[]>([]);
  const [archiveSourceId,setArchiveSourceId]=useState<string|null>(null);
  const [editor, setEditor] = useState<string | null>(null), [success, setSuccess] = useState<string | null>(null), [visible, setVisible] = useState(20);
  const query = useAsyncQuery(() => fetchMedicationDocumentation(id, tenantId, role), [tenantId, actorId, role, id, canView], { enabled: !!tenantId && !!id && canView, queryKey: `${tenantId}:${actorId}:${role}:${id}:${canView}` });
  const anchor=useRef<MedicationDocumentation|null>(null);
  const nativeRead=canView&&(!query.data||query.data.tenantId===tenantId&&query.data.id===id&&woundUuid(query.data.clientId)&&(!anchor.current||query.data.clientId===anchor.current.clientId));
  const fresh=query.data&&query.data.tenantId===tenantId&&query.data.id===id&&woundUuid(query.data.clientId)&&(!anchor.current||query.data.clientId===anchor.current.clientId)&&canView?query.data:null;
  if(fresh&&!query.loading&&!query.refreshing&&!query.error&&!query.refreshError)anchor.current=fresh;
  const order=fresh??anchor.current;
  const sources = useAsyncQuery(() => fresh ? fetchMedicationSources(fresh, tenantId, role) : Promise.resolve({ok:false as const,error:'Verordnung fehlt.'}), [tenantId,actorId,role,order?.id,order?.updatedAt,canSources,canView], {enabled:!!fresh && canSources && canView,queryKey:`${tenantId}:${actorId}:${role}:${id}:${order?.updatedAt}:${canSources}:${canView}:sources`});
  const heldFollowUp=useRef<MedicationEvent|null>(null),workspaceAlive=useRef(true),[workspaceOwner]=useState(()=>({tenantId,actorId,role:profileRole,profileRole,medicationId:id}));
  useEffect(()=>{workspaceAlive.current=true;return()=>{workspaceAlive.current=false;};},[]);
  const workspaceState=useRef({tenantId,actorId,role,profileRole,id,editor,canView:nativeRead,canAdminister,canManage,canSources,fresh,unavailable:query.loading||query.refreshing||!!query.error||!!query.refreshError,sourceUnavailable:sources.loading||sources.refreshing||!!sources.error||!!sources.refreshError||!sources.data,documents:sources.data?.documents??[],links:sources.data?.links??[]});workspaceState.current={tenantId,actorId,role,profileRole,id,editor,canView:nativeRead,canAdminister,canManage,canSources,fresh,unavailable:query.loading||query.refreshing||!!query.error||!!query.refreshError,sourceUnavailable:sources.loading||sources.refreshing||!!sources.error||!!sources.refreshError||!sources.data,documents:sources.data?.documents??[],links:sources.data?.links??[]};
  function currentWorkspace(requireRead=true){const current=workspaceState.current;if(!workspaceAlive.current||![workspaceOwner.tenantId,workspaceOwner.actorId,workspaceOwner.medicationId].every(woundUuid)||!workspaceOwner.role||workspaceOwner.role!==workspaceOwner.profileRole||current.tenantId!==workspaceOwner.tenantId||current.actorId!==workspaceOwner.actorId||current.role!==workspaceOwner.role||current.profileRole!==workspaceOwner.profileRole||current.id!==workspaceOwner.medicationId||requireRead&&!current.canView)throw Error('Eigene zugängliche Medikationsakte zuerst bestätigen.');return current;}
  function openEditor(kind:'administration'|'status'|'follow_up'|'source'|'archive',value?:string){try{const current=currentWorkspace();if(leaveFlight.current||revisionEditing.current||planEditing.current||reviewEditing.current||activeEditor.current!==null||current.editor!==null||current.unavailable||!current.fresh||(['administration','follow_up'].includes(kind)?!current.canAdminister:!current.canManage)||(['source','archive'].includes(kind)&&(!current.canSources||current.sourceUnavailable)))return;if(kind==='administration'&&(current.fresh.status!=='active'||!current.fresh.integrity.canRecord))return;if(kind==='status'&&!['active','paused'].includes(current.fresh.status))return;if(kind==='follow_up'){const event=current.fresh.administrations.find(e=>e.id===value);if(!validMedicationActualTime(event?.occurredAt)||!event||!isMedicationGiven(event.status))return;heldFollowUp.current=structuredClone(event);activeEditor.current=event.id;setEditor(event.id);}else{if(kind==='source')setSourceDocuments(structuredClone(current.documents));if(kind==='archive'){const source=current.links.find(link=>link.id===value);if(!medicationSourceArchiveReadiness(source,current.fresh.updatedAt).allowed||!value||!woundUuid(value))return;setArchiveSourceId(value);}activeEditor.current=kind;setEditor(kind);}setSuccess(null);}catch{}}
  function continueSourceArchive(sourceId:string){try{const current=currentWorkspace();if(leaveFlight.current||revisionEditing.current||planEditing.current||reviewEditing.current||activeEditor.current!=='source'||current.editor!=='source'||current.unavailable||current.sourceUnavailable||!current.fresh||!current.canManage||!current.canSources||!medicationSourceArchiveReadiness(current.links.find(link=>link.id===sourceId),current.fresh.updatedAt).allowed)return;setArchiveSourceId(sourceId);activeEditor.current='archive';setEditor('archive');}catch{}}
  function closeEditor(){if(currentWorkspace(false).editor!==editor)return;heldFollowUp.current=null;activeEditor.current=null;setEditor(null);}
  async function leaveWorkspace(){if(leaveFlight.current)return;leaveFlight.current=true;try{
    const before=currentWorkspace(false),leave=editorLeave.current,revision=revisionLeave.current,plan=planLeave.current,review=reviewLeave.current;
    const snapshot=(value:typeof before)=>({tenantId:value.tenantId,actorId:value.actorId,role:value.role,profileRole:value.profileRole,id:value.id,editor:value.editor,canView:value.canView,canAdminister:value.canAdminister,canManage:value.canManage,canSources:value.canSources,unavailable:value.unavailable,sourceUnavailable:value.sourceUnavailable,clientId:value.fresh?.clientId,orderVersion:value.fresh?.updatedAt,revisionActive:revisionEditing.current,planActive:planEditing.current,reviewActive:reviewEditing.current,activeEditor:activeEditor.current});
    const captured=snapshot(before);
    const guards=[{key:'revision',guard:revision},{key:'plan',guard:plan},{key:'review',guard:review},...(before.editor!==null?[{key:'editor',guard:leave}]:[])];
    const active=before.editor!==null?'editor':revisionEditing.current?'revision':planEditing.current?'plan':reviewEditing.current?'review':null;
    // Check idle panels first, so no other awaited prompt follows the active writer's final phase check.
    const ordered=[...guards.filter(item=>item.key!==active),...guards.filter(item=>item.key===active)];
    for(const item of ordered)if(!item.guard||!await item.guard())return;
    const after=currentWorkspace(false);
    if(editorLeave.current!==leave||revisionLeave.current!==revision||planLeave.current!==plan||reviewLeave.current!==review||!sameWoundJson(captured,snapshot(after)))return;
    router.back();
  }catch{}finally{leaveFlight.current=false;}}
  function confirmedEditor(message:string){if(currentWorkspace().editor!==editor)throw Error('Eigene Bearbeitung geändert.');setSuccess(message);heldFollowUp.current=null;activeEditor.current=null;setEditor(null);}
  if(!order)return <ScreenShell title="Medikation">{!canView?<ErrorState message="Für diese Medikationsakte fehlt die Leseberechtigung."/>:query.loading?<LoadingState message="Verordnung und vollständiger Medikationsverlauf werden geladen…"/>:<ErrorState message={query.error??'Verordnung nicht gefunden.'} onRetry={query.refresh}/>}</ScreenShell>;
  const context: Context = { tenantId, actorId, role, profileRole, canView:nativeRead, canAdminister, canManage, canSources, unavailable:!fresh||query.loading||query.refreshing||!!query.error||!!query.refreshError, sourceUnavailable:sources.loading||sources.refreshing||!!sources.error||!!sources.refreshError||!sources.data, order, currentSourceDocuments:sources.data?.documents??[],currentSourceLinks:sources.data?.links??[],isLeaving,registerLeave, refresh: query.refresh, close: closeEditor, saved: confirmedEditor };
  const followUpEvent = heldFollowUp.current?.id===editor?heldFollowUp.current:order.administrations.find(e=>e.id===editor);
  const historicalPlans = captureHistoricalMedicationPlans(order.administrations, { tenantId, medicationId: order.id, clientId: order.clientId });
  return <ScreenShell title="Medikation" subtitle={canView&&fresh?`${order.medicationName} · ${order.clientName}`:undefined}>
    <ScrollView contentContainerStyle={styles.content}>
      {!canView?<ErrorState message="Die Medikationsleseberechtigung fehlt. Angefangene und ungewisse Originalanfragen bleiben erhalten."/>:!fresh?<ErrorState message={query.error??'Verordnung wird unter dem aktuellen Lesebezug neu geladen. Angefangene Originalanfragen bleiben erhalten.'} onRetry={query.refresh}/>:null}
      {canView&&fresh?<View style={{gap:spacing.md}}>
      <SectionPanel title={order.medicationName} subtitle={order.clientName}>
        <View style={styles.actions}><PremiumBadge label={labels[order.status]} variant={order.status === 'active' ? 'green' : 'orange'} />{order.isPrn ? <PremiumBadge label="Bedarfsmedikation" variant="orange" /> : null}{order.isHighAlert ? <PremiumBadge label="Hochrisiko" variant="red" /> : null}{order.isControlledSubstance ? <PremiumBadge label="BtM · Gegenkontrolle" variant="red" /> : null}</View>
        <DetailInfoRow label="Letzte bestätigte tatsächliche Gabe" value={formatTime(order.lastAdministeredAt)} />
      </SectionPanel>
      {order.clientAllergies ? <InfoBanner variant="warning" title="Allergien / Unverträglichkeiten" message={order.clientAllergies} /> : <InfoBanner variant="info" title="Allergieangaben prüfen" message="Es sind keine Allergieangaben hinterlegt. Das bestätigt nicht, dass keine Allergie besteht." />}
      {order.interactionNotes ? <InfoBanner variant="warning" title="Wechselwirkungen beachten" message={order.interactionNotes} /> : null}
      {query.refreshError ? <ErrorState message={query.refreshError} onRetry={query.refresh} /> : null}
      {success ? <SuccessState message={success} /> : null}
      <SectionPanel title="Verordnung prüfen" subtitle={`Angezeigter Stand: ${formatTime(order.updatedAt)}`}>
        <DetailInfoRow label="Wirkstoff / Stärke / Form" value={[order.activeIngredient, order.strength, order.form].filter(Boolean).join(' · ') || 'Nicht angegeben'} />
        <DetailInfoRow label="Verordnete Dosierung" value={order.dosage} /><DetailInfoRow label="Applikation / Gabeplan" value={`${order.route} · ${order.schedule}`} />
        <DetailInfoRow label="Tageszeiten" value={`Morgens ${order.morningDose ?? '–'} · Mittags ${order.noonDose ?? '–'} · Abends ${order.eveningDose ?? '–'} · Nachts ${order.nightDose ?? '–'}`} />
        <DetailInfoRow label="Verordnet von" value={order.prescribedBy} /><DetailInfoRow label="Gültigkeit" value={`${order.startDate ?? 'Beginn nicht angegeben'} bis ${order.endDate ?? 'Ende nicht angegeben'}`} />
        <DetailInfoRow label="Indikation" value={order.indication ?? 'Nicht angegeben'} />{order.isPrn ? <DetailInfoRow label="Verordnete Bedarfsindikation" value={order.prnReason ?? 'Nicht angegeben – ärztliche Grundlage klären'} /> : null}
        <Text style={styles.body}>{order.instructions}</Text>
        {order.sideEffectNotes ? <DetailInfoRow label="Nebenwirkungen / Überwachung" value={order.sideEffectNotes} /> : null}{order.storageNotes ? <DetailInfoRow label="Lagerung" value={order.storageNotes} /> : null}
        {order.intensiveCareRelevant ? <><DetailInfoRow label="Pumpengabe" value={order.pumpRequired ? 'Ja' : 'Nein'} /><DetailInfoRow label="Infusionsrate" value={order.infusionRate ?? 'Nicht angegeben'} /><DetailInfoRow label="Verdünnung / Trägerlösung" value={order.dilution ?? 'Nicht angegeben'} /></> : null}
        {order.integrity.missing.length ? <InfoBanner variant="warning" title="Verordnungsangaben unvollständig" message={`Nicht hinterlegt: ${order.integrity.missing.join(', ')}. Die verantwortliche Fachperson muss die ärztliche Grundlage vor der Durchführung klären.`} /> : null}
        {order.integrity.errors.length ? <InfoBanner variant="warning" title="Verordnungsstand klären" message={order.integrity.errors.join(' ')} /> : null}
        <InfoBanner variant="info" title="Ärztlicher Nachweis" message="Die hinterlegten Angaben bestätigen keine geprüfte ärztliche Originalquelle. Quelle, aktuelle Fassung und erforderliche Qualifikation müssen fachlich geprüft werden. Die Bestätigung unten dokumentiert nur die Übernahme des angezeigten Datenstands." />
      </SectionPanel>
      <View style={styles.actions}>
        {canAdminister && actorId ? <PremiumButton title="Gabe / Abweichung dokumentieren" disabled={editor !== null || revisionActive || planActive || reviewActive || order.status !== 'active' || !order.integrity.canRecord} onPress={()=>openEditor('administration')} /> : null}
        {canManage && actorId && ['active', 'paused'].includes(order.status) ? <PremiumButton title="Verordnungsstatus ändern" variant="secondary" disabled={editor !== null || revisionActive || planActive || reviewActive} onPress={()=>openEditor('status')} /> : null}
        <PremiumButton title="Verlauf aktualisieren" variant="secondary" disabled={query.refreshing} onPress={query.refresh} />
      </View>
      <SectionPanel title="Gaben- und Abweichungsverlauf" subtitle={`${order.administrations.length} Dokumentationen · Zeitangaben für Deutschland`}>
        {!order.administrations.length ? <Text style={styles.note}>Noch keine Gaben oder Abweichungen dokumentiert.</Text> : order.administrations.slice(0, visible).map(event => <View key={event.id} style={styles.history}>
          <View style={styles.historyTop}><Text style={styles.title}>{formatTime(event.occurredAt)}</Text><PremiumBadge label={labels[event.status] ?? event.status} variant={isMedicationGiven(event.status) ? 'green' : 'orange'} /></View>
          <Text style={styles.note}>Erfasst: {formatTime(event.createdAt)} · {event.administeredByName ?? (event.recordedById ? `Historische Autor-ID: ${event.recordedById}` : 'Autor nicht hinterlegt')}</Text>
          {!validMedicationActualTime(event.occurredAt) ? <Text style={styles.warning}>Altbestand: Der tatsächliche Ereigniszeitpunkt ist nicht bestätigt. Historischer Zeitstempel: {formatTime(event.administeredAt)}. Kein Ersatz für den tatsächlichen Ereigniszeitpunkt.</Text> : null}
          {isMedicationGiven(event.status) ? <Text style={styles.body}>Dosis: {event.administeredDose ?? 'Nicht angegeben'} · Applikation: {event.route ?? 'Nicht angegeben'}</Text> : event.administeredDose || event.route ? <Text style={styles.warning}>Historische Dosis-/Applikationsangabe bei Nichtgabe: {[event.administeredDose, event.route].filter(Boolean).join(' · ')}. Keine bestätigte Verabreichung.</Text> : null}
          <MedicationHistoricalPlan history={historicalPlans} eventId={event.id} />
          {event.deviationReason ? <Text style={styles.body}>Begründung: {event.deviationReason}</Text> : null}{event.prnReason ? <Text style={styles.body}>Bedarfsindikation: {event.prnReason}</Text> : null}
          {event.painScoreBefore != null ? <Text style={styles.body}>Schmerzskala vor Gabe: {event.painScoreBefore}/10</Text> : null}{event.painScoreAfter != null ? <Text style={styles.body}>Historisch dokumentierte Schmerzskala nach Gabe: {event.painScoreAfter}/10</Text> : null}
          {event.witnessName || event.witnessedById ? <Text style={styles.note}>Angegebene Gegenkontrolle: {event.witnessName ?? event.witnessedById}. Keine separat authentifizierte Gegenzeichnung.</Text> : null}
          {event.effectEvaluation ? <Text style={styles.body}>Historische Wirksamkeitsangabe: {event.effectEvaluation}</Text> : null}{event.notes ? <Text style={styles.body}>Bemerkung: {event.notes}</Text> : null}
          {Object.entries(event.vitalContext).map(([name, value]) => <Text key={name} style={styles.note}>Historische Messangabe · {name}: {typeof value === 'string' || typeof value === 'number' ? String(value) : 'Strukturierte Angabe – Formatprüfung ausstehend'}</Text>)}
          {event.followUps.map(follow => <View key={follow.id} style={styles.followUp}><Text style={styles.title}>Wirkungskontrolle: {formatTime(follow.observedAt)}</Text><Text style={styles.body}>Beobachtung: {follow.observation}</Text><Text style={styles.body}>Maßnahme: {follow.action}</Text>{follow.painScore != null ? <Text style={styles.body}>Schmerzskala: {follow.painScore}/10</Text> : null}<Text style={styles.note}>Erfasst: {formatTime(follow.createdAt)} · {follow.recordedByName}</Text></View>)}
          {canAdminister && validMedicationActualTime(event.occurredAt) && isMedicationGiven(event.status) ? <PremiumButton title="Wirkungskontrolle ergänzen" variant="secondary" disabled={editor !== null || revisionActive || planActive || reviewActive} onPress={()=>openEditor('follow_up',event.id)} /> : null}
        </View>)}
        {visible < order.administrations.length ? <PremiumButton title={`Weitere Dokumentationen anzeigen (${order.administrations.length - visible} verbleibend)`} variant="secondary" onPress={() => setVisible(value => value + 20)} /> : null}
      </SectionPanel>
      <SectionPanel title="Verordnungsstatus und Änderungen" subtitle={labels[order.status]}>
        {order.statusEvents.length ? order.statusEvents.map(event => <View key={event.id} style={styles.history}><Text style={styles.title}>{labels[event.previousStatus]} → {labels[event.nextStatus]}</Text><Text style={styles.body}>{event.reason}</Text><Text style={styles.note}>{formatTime(event.createdAt)} · {event.recordedByName}</Text></View>) : <Text style={styles.note}>Keine begründete Statusänderung im neuen Verlauf vorhanden. Frühere Änderungen sind dadurch nicht ausgeschlossen.</Text>}
      </SectionPanel>
      <SectionPanel title="Quellen zur Verordnung" subtitle="Zuordnung ist noch keine fachliche Bestätigung">
        {!canSources ? <Text style={styles.note}>Für vertrauliche Quellen sind Dokumentenrechte und das Recht auf sensible Klientendaten erforderlich.</Text> : sources.loading && !sources.data ? <LoadingState message="Dokumente und Quellenzuordnungen werden geladen…" /> : sources.error ? <ErrorState message={sources.error} onRetry={sources.refresh} /> : <>
          {sources.refreshError ? <ErrorState message={sources.refreshError} onRetry={sources.refresh} /> : null}
          {(sources.data?.links ?? []).map(link => <View key={link.id} style={styles.history}>
            <Text style={styles.title}>{link.documentTitle}</Text><Text style={styles.body}>Datei: {link.fileName}</Text>
            <Text style={styles.note}>Dokumentstand: {formatTime(link.documentVersion)} · Verordnungsstand: {formatTime(link.orderVersion)}</Text>
            <Text style={styles.body}>{link.reason}</Text><Text style={styles.note}>Zugeordnet: {formatTime(link.createdAt)} · {link.recordedByName}</Text>
            <Text style={styles.warning}>{link.orderVersion === order.updatedAt ? 'Zuordnung zum angezeigten Datenstand. Eine fachliche Bestätigung ist noch nicht nachgewiesen.' : 'Historische Zuordnung zu einem anderen Verordnungsstand. Keine Bestätigung der aktuellen Verordnung.'}</Text>
            <Text style={styles.note}>{link.archive ? `Archivkopie bereitgestellt: ${formatTime(link.archive.finalizedAt)}. Beim Download wird der Inhalt erneut geprüft. Keine fachliche Freigabe.` : link.hasFingerprint ? 'Dateiinhalt beim Zuordnen erfasst. Keine bereitgestellte Archivkopie nachgewiesen.' : 'Historische Zuordnung ohne Inhaltsfingerabdruck. Der damalige Dateiinhalt ist nicht nachgewiesen.'}</Text>
            <MedicationSourceFileButton key={`${tenantId}:${actorId}:${role}:${link.id}`} order={order} linkId={link.id} tenantId={tenantId} role={role} />
            {canManage && actorId && medicationSourceArchiveReadiness(link,order.updatedAt).allowed ? <PremiumButton title={link.archive?'Archivkopie erneut prüfen':'Archivkopie sichern'} variant="secondary" disabled={editor !== null || revisionActive || planActive || reviewActive || !!sources.refreshError} onPress={()=>openEditor('archive',link.id)}/> : null}
          </View>)}
          {!sources.data?.links.length ? <Text style={styles.note}>Keine Quellenzuordnung in diesem Verlauf vorhanden.</Text> : null}
          {canManage && actorId && sources.data ? <PremiumButton title="Vorhandenes Dokument als Quelle zuordnen" variant="secondary" disabled={editor !== null || revisionActive || planActive || reviewActive || !!sources.refreshError} onPress={()=>openEditor('source')} /> : null}
        </>}
      </SectionPanel>
      <MedicationSourceComparison key={`${tenantId}:${actorId}:${profileRole}:${order.id}:${order.clientId}`} order={order} tenantId={tenantId} actorId={actorId} role={role} profileRole={profileRole} canView={nativeRead} canSources={canSources} readBlocked={context.unavailable}/>
      <MedicationSafetyWorkspacePanel key={`${tenantId}:${actorId}:${order.clientId}:${order.id}:safety`} tenantId={tenantId} clientId={order.clientId} medicationId={order.id} actorId={actorId} actorName={`Profil ${actorId}`} canView={nativeRead} canManage={canManage} canAdminister={canAdminister} canReview={canReview} onSaved={()=>{void query.refresh();}}/>
      <PflegeCrossModuleLinksPanel context="medication" />
      </View>:null}
      <MedicationOrderRevisionPanel key={`${tenantId}:${actorId}:${order.clientId}:${order.id}:revision`} tenantId={tenantId} clientId={order.clientId} medicationId={order.id} actorId={actorId} role={role} profileRole={profileRole} canView={nativeRead&&!!fresh} canSources={canSources} canManage={canManage} blocked={context.unavailable||editor!==null||planActive||reviewActive} currentOrderVersion={order.updatedAt} isLeaving={isLeaving} registerLeave={registerRevisionLeave} onEditingChange={revisionEditingChange}/>
      <MedicationDailyPlanPanel key={`${tenantId}:${actorId}:${order.clientId}:${order.id}:plan`} tenantId={tenantId} clientId={order.clientId} medicationId={order.id} actorId={actorId} role={role} profileRole={profileRole} canView={nativeRead&&!!fresh} canSources={canSources} canManage={canManage} canAdminister={canAdminister} canReview={canReview} sourceOrder={order} blocked={context.unavailable||editor!==null||revisionActive||reviewActive} currentOrderVersion={order.updatedAt} isLeaving={isLeaving} registerLeave={registerPlanLeave} onEditingChange={planEditingChange}/>
      <MedicationOrderReviewPanel key={`${tenantId}:${actorId}:${order.clientId}:${order.id}:review`} tenantId={tenantId} clientId={order.clientId} medicationId={order.id} actorId={actorId} role={role} profileRole={profileRole} canView={nativeRead&&!!fresh} canSources={canSources} canManage={canManage} canReview={canReview} blocked={context.unavailable||editor!==null||revisionActive||planActive} currentOrderVersion={order.updatedAt} isLeaving={isLeaving} registerLeave={registerReviewLeave} onEditingChange={reviewEditingChange} onApplied={()=>{void query.refresh();void sources.refresh();}}/>
      <View style={{gap:spacing.md}}>
       {editor==='administration'?<AdministrationForm {...context} refreshFailed={!!query.refreshError}/>:null}
       {editor==='status'?<MedicationStatusForm {...context}/>:null}
       {followUpEvent?<FollowUpForm {...context} event={followUpEvent}/>:null}
       {editor==='archive'&&archiveSourceId?<MedicationSourceArchiveForm {...context} sourceId={archiveSourceId} refreshSources={sources.refreshWithResult}/>:null}
       {editor==='source'?<MedicationSourceForm {...context} documents={sourceDocuments} refreshSources={sources.refreshWithResult} continueArchive={continueSourceArchive}/>:null}
      </View>
      <PremiumButton title="Zurück zur Liste" variant="secondary" onPress={leaveWorkspace} />
    </ScrollView>
  </ScreenShell>;
}

type MedicationFormKind='administration'|'follow_up'|'status'|'source'|'archive';
type MedicationFormOriginal={context:Context;related:object|null};
function useMedicationFormWrite<P extends object>(context:Context,dirty:boolean,kind:MedicationFormKind,draft:object,related:object|null,prepare:()=>P,execute:(id:string,payload:P,replay:boolean,original:MedicationFormOriginal)=>Promise<import('@/lib/pflege/medicationAdministrationService').MedicationWriteResult>,confirmed:(isCurrent:()=>boolean)=>void|Promise<void>){
 const [owner]=useState(()=>({tenantId:context.tenantId,actorId:context.actorId,role:context.profileRole,profileRole:context.profileRole,medicationId:context.order.id,clientId:context.order.clientId})),alive=useRef(true),original=useRef<{id:string;payload:P;value:MedicationFormOriginal;execute:typeof execute}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const flight=useRef(false),saved=useRef(false);
 const state=useRef({context,draft,related,prepare,execute,confirmed,busy:false,uncertain:false,confirmLeave:async()=>false});
 function sameLocalOwner(current:typeof state.current){const c=current.context;return alive.current&&[owner.tenantId,owner.actorId,owner.medicationId,owner.clientId].every(woundUuid)&&!!owner.role&&owner.role===owner.profileRole&&c.tenantId===owner.tenantId&&c.actorId===owner.actorId&&c.role===owner.role&&c.profileRole===owner.profileRole&&c.order.tenantId===owner.tenantId&&c.order.id===owner.medicationId&&c.order.clientId===owner.clientId;}
 function sameReadOwner(current:typeof state.current){return sameLocalOwner(current)&&current.context.canView&&(!['source','archive'].includes(kind)||current.context.canSources);}
 function editorAccess(current:typeof state.current){return !current.context.isLeaving?.()&&!saved.current&&sameReadOwner(current)&&!current.context.unavailable&&(['administration','follow_up'].includes(kind)?current.context.canAdminister:current.context.canManage)&&(!['source','archive'].includes(kind)||!current.context.sourceUnavailable);}
 function mayStart(current:typeof state.current){const relation=current.related as {tenantId?:string;clientId?:string;medicationId?:string;id?:string}|null;return editorAccess(current)&&(!relation||relation.tenantId===owner.tenantId&&relation.clientId===owner.clientId&&woundUuid(relation.id)&&(kind!=='follow_up'||relation.medicationId===owner.medicationId))&&(kind!=='follow_up'||!!current.related&&current.context.order.administrations.some(event=>sameWoundJson(event,current.related)))&&(kind!=='source'||!!current.related&&current.context.currentSourceDocuments.some(document=>sameWoundJson(document,current.related)))&&(kind!=='archive'||current.context.currentSourceLinks.some(link=>link.id===(current.draft as {sourceId?:string}).sourceId&&medicationSourceArchiveReadiness(link,current.context.order.updatedAt).allowed));}
 function snapshot(current:typeof state.current){const c=current.context;return structuredClone({draft:current.draft,related:current.related,context:{tenantId:c.tenantId,actorId:c.actorId,role:c.role,profileRole:c.profileRole,canView:c.canView,canAdminister:c.canAdminister,canManage:c.canManage,canSources:c.canSources,unavailable:c.unavailable,sourceUnavailable:c.sourceUnavailable,order:c.order,currentSourceDocuments:c.currentSourceDocuments,currentSourceLinks:c.currentSourceLinks},busy:current.busy,uncertain:current.uncertain,flight:flight.current,saved:saved.current,original:original.current?{id:original.current.id,payload:original.current.payload,order:original.current.value.context.order,related:original.current.value.related}:null});}
 function confirmationSnapshot(current:typeof state.current){const value=snapshot(current);delete (value.context as Partial<typeof value.context>).currentSourceLinks;return {draft:value.draft,related:value.related,context:value.context,flight:value.flight,saved:value.saved,original:value.original};}
 const write=useMedicationSubmission<P>(dirty,async(id,payload,replay)=>{
  const current=state.current;
  if(!sameReadOwner(current))return {ok:false as const,error:'Eigenen zugänglichen Medikationsbezug vor der Anfrage bestätigen.',uncertain:replay};
  if(replay){if(!original.current||original.current.id!==id||!sameWoundJson(original.current.payload,payload))return {ok:false as const,error:'Die unveränderte ursprüngliche Medikationsanfrage fehlt.',uncertain:true};}
  else{try{if(!mayStart(current)||!sameWoundJson(current.prepare(),payload))throw Error('Aktuelle vollständige Eingaben und Schreibberechtigung vor einer neuen Anfrage bestätigen.');}catch(e){return {ok:false as const,error:e instanceof Error?e.message:'Aktuelle Medikationsangaben prüfen.'};}original.current={id,payload:structuredClone(payload),value:{context:{...current.context,order:structuredClone(current.context.order)},related:current.related?structuredClone(current.related):null},execute:current.execute};}
  const frozen=original.current!;const result=await frozen.execute(id,payload,replay,frozen.value);
  if(!result.ok)return result;
  if(!sameReadOwner(state.current))return {ok:false as const,error:'Ursprüngliche Speicherbestätigung unter eigenem Lesebezug erneut prüfen.',uncertain:true};
  return result;
 },async()=>{saved.current=true;if(!sameReadOwner(state.current))throw Error('Eigener Lesebezug geändert.');const before=confirmationSnapshot(state.current);await state.current.confirmed(()=>sameReadOwner(state.current)&&sameWoundJson(before,confirmationSnapshot(state.current)));},()=>{const before=state.current;if(!sameLocalOwner(before)||flight.current||before.busy||before.uncertain||(kind==='source'&&(before.draft as {capturing?:boolean}).capturing))return null;const captured=snapshot(before);return()=>sameLocalOwner(state.current)&&!flight.current&&!state.current.busy&&!state.current.uncertain&&sameWoundJson(captured,snapshot(state.current));});
 state.current={context,draft,related,prepare,execute,confirmed,busy:write.busy,uncertain:write.uncertain,confirmLeave:write.confirmLeave};
 async function submit(payload?:P){if(state.current.context.isLeaving?.()||flight.current||saved.current)return;const current=state.current;if(!sameReadOwner(current)||(!current.uncertain&&!mayStart(current))){if(alive.current)write.setError('Aktuellen eigenen Lese- und Schreibbezug zuerst bestätigen.');return;}flight.current=true;try{await write.submit(payload);}finally{flight.current=false;}}
 const confirmLeave=useCallback(async()=>{const before=state.current;if(!sameLocalOwner(before)||flight.current||before.busy||before.uncertain||(kind==='source'&&(before.draft as {capturing?:boolean}).capturing))return false;const captured=snapshot(before);if(!await before.confirmLeave())return false;const after=state.current;return sameLocalOwner(after)&&!flight.current&&!after.busy&&!after.uncertain&&sameWoundJson(captured,snapshot(after));},[]);
 useEffect(()=>{context.registerLeave(confirmLeave);return()=>context.registerLeave(null);},[context.registerLeave,confirmLeave]);
 return {...write,locked:write.locked||!editorAccess(state.current),submit,retry:()=>submit(),confirmLeave,canReplay:sameReadOwner(state.current),canReadBody:sameReadOwner(state.current)&&!context.unavailable,mayEdit:(documents?:MedicationSourceDocument[])=>!flight.current&&editorAccess(state.current)&&!state.current.busy&&!state.current.uncertain&&(!documents||sameWoundJson(documents,state.current.context.currentSourceDocuments)),mayPrepare:()=>mayStart(state.current),isCurrentRead:()=>sameReadOwner(state.current),close:context.close};
}
function MedicationFormUnavailable({write}:{write:{uncertain:boolean;busy:boolean;canReplay:boolean;retry:()=>Promise<void>;confirmLeave:()=>Promise<boolean>;close:()=>void}}){return <SectionPanel title="Angefangene Medikationsbearbeitung"><InfoBanner variant="warning" message="Aktueller eigener Lese- oder Datenbezug fehlt. Eingaben und unveränderte Originalanfrage bleiben erhalten; eine neue Anfrage wird nicht gestartet."/>{write.uncertain?<PremiumButton title="Unveränderte Originalanfrage erneut prüfen" disabled={write.busy||!write.canReplay} loading={write.busy} onPress={write.retry}/>:null}<PremiumButton title="Bearbeitung schließen" variant="secondary" disabled={write.busy||write.uncertain} onPress={async()=>{if(await write.confirmLeave())write.close();}}/></SectionPanel>;}

function AdministrationForm(context: Context & { refreshFailed: boolean }) {
  const { order, tenantId, actorId, role } = context; const styles = useStyles();
  const [status, setStatus] = useState<AdministrationOutcome | ''>(''), [time, setTime] = useState(currentMedicationEventTime);
  const [dose, setDose] = useState(''), [route, setRoute] = useState(''), [reason, setReason] = useState(''), [prn, setPrn] = useState(''), [pain, setPain] = useState(''), [witness, setWitness] = useState(''), [notes, setNotes] = useState(''), [reviewedVersion, setReviewedVersion] = useState<string | null>(null);
  const [timeEdited, setTimeEdited] = useState(false);
  const given = isMedicationGiven(status);
  const write = useMedicationFormWrite<MedicationEventPayload>(context,!!(timeEdited || status || dose || route || reason || prn || pain || witness || notes || reviewedVersion),'administration',{status,time,dose,route,reason,prn,pain,witness,notes,reviewedVersion},null,preparePayload, (id,payload,replay,frozen)=>recordMedicationEvent(frozen.context.order,frozen.context.tenantId,frozen.context.actorId,id,payload,frozen.context.role,replay), async () => { context.saved('Die Gabe bzw. Abweichung wurde gespeichert.'); await context.refresh(); });
  const witnessRequired = given && (order.isControlledSubstance || !!witness);
  const witnessEnabled = context.canView === true && context.canAdminister === true && context.unavailable === false && witnessRequired;
  const witnessScope = JSON.stringify([tenantId, actorId, role, context.profileRole, order.id, order.clientId, context.canView, context.canAdminister, context.unavailable, order.isControlledSubstance, given, witnessRequired]);
  const witnesses = useAsyncQuery(() => fetchMedicationWitnessOptions(tenantId, actorId, role), [witnessScope], { enabled: witnessEnabled, queryKey: witnessScope });
  const witnessScopeRef = useRef(witnessScope), latestWitness = useRef<{data:unknown;ready:boolean}>({data:null,ready:false});
  const witnessScopeChanged = witnessScopeRef.current !== witnessScope; witnessScopeRef.current = witnessScope;
  const witnessData = witnessScopeChanged ? null : witnesses.data;
  const witnessReady = witnessEnabled && !witnessScopeChanged && !witnesses.loading && !witnesses.refreshing && !witnesses.error && !witnesses.refreshError && !witnesses.previewData && !witnesses.tableMissing && !witnesses.cacheMeta?.fromCache;
  let witnessOptions: MedicationWitnessPoolOption[] | null = null, witnessPoolError: string | null = null;
  if (witnessReady) { try { witnessOptions = decodeMedicationWitnessPool(witnessData); } catch (e) { witnessPoolError = e instanceof Error ? e.message : 'Den vollständigen Personenbestand prüfen.'; } }
  latestWitness.current = {data:witnessData,ready:witnessReady};
  function selectWitness(value: string) {
    const current = latestWitness.current;
    if (!write.mayEdit() || !current.ready || !witnessOptions || !sameMedicationWitnessPool(witnessOptions, current.data)) return;
    try { assertMedicationWitnessSelection(current.data, value, current.ready); setWitness(value); }
    catch (e) { write.setError(e instanceof Error ? e.message : 'Die aktuelle Personenauswahl prüfen.'); }
  }
  const changed = reviewedVersion !== null && reviewedVersion !== order.updatedAt;
  function selectOutcome(value: string) {
    if (!write.mayEdit() || order.isPrn && isMedicationGiven(value)) return;
    setStatus(value as AdministrationOutcome);
    if (!isMedicationGiven(value)) { setDose(''); setRoute(''); setPrn(''); setPain(''); setWitness(''); }
  }
  function preparePayload():MedicationEventPayload {
    if(reviewedVersion!==order.updatedAt||context.refreshFailed)throw Error('Aktuelle Verordnung neu laden, prüfen und ausdrücklich übernehmen.');
    if(!status)throw Error('Bitte das tatsächliche Ergebnis auswählen.');
    if(order.isPrn&&isMedicationGiven(status))throw Error('Eine Bedarfsgabe kann hier nicht gespeichert werden. Eine rechnerische Grenzenprüfung schaltet die Durchführung nicht frei.');
    if(given && (order.isControlledSubstance || !!witness))assertMedicationWitnessSelection(latestWitness.current.data,witness,latestWitness.current.ready);
    const payload:MedicationEventPayload={status,occurredAt:medicationEventInstant(time),expectedUpdatedAt:reviewedVersion,dose:given?dose:undefined,route:given?route:undefined,deviationReason:reason,prnReason:given?prn:undefined,witnessProfileId:given?witness||null:null,painScoreBefore:given?painValue(pain):null,notes};
    const error=validateMedicationAdministration(order,actorId,payload);if(error)throw Error(error);return payload;
  }
  async function save(){if(write.uncertain){await write.retry();return;}try{await write.submit(preparePayload());}catch(e){write.setError(e instanceof Error?e.message:'Medikationsangaben prüfen.');}}
  if(!write.canReadBody)return <MedicationFormUnavailable write={write}/>;
  return <SectionPanel title="Gabe / Abweichung dokumentieren" subtitle="Tatsächliches Ereignis und aktuelle Verordnung bestätigen">
    <View style={styles.form}>
      <SubmissionFeedback {...write} />
      {order.isPrn?<InfoBanner variant="info" title="Bedarfsgabe bleibt gesperrt" message="In diesem Formular können Nichtgaben, Ablehnungen und Zurückstellungen dokumentiert werden. Die getrennte rechnerische Grenzenprüfung speichert keine Gabe und schaltet deren Durchführung nicht frei."/>:null}
      {changed ? <InfoBanner variant="warning" title="Verordnung zwischenzeitlich geändert" message="Ihre Eingaben bleiben erhalten. Prüfen Sie zuerst die neu angezeigte Verordnung und übernehmen Sie deren Stand ausdrücklich." /> : null}
      <PremiumButton title={reviewedVersion === order.updatedAt ? 'Angezeigter Verordnungsstand übernommen' : 'Angezeigten Datenstand zur Dokumentation übernehmen'} variant="secondary" disabled={write.locked || context.refreshFailed || reviewedVersion === order.updatedAt} onPress={() => {if(write.mayEdit())setReviewedVersion(order.updatedAt);}} />
      <Text style={styles.label}>Tatsächliches Ergebnis *</Text><FilterChipGroup wrap options={order.isPrn?outcomes.filter(option=>!isMedicationGiven(option.key)):outcomes} value={status} onChange={write.locked ? undefined : selectOutcome} />
      <MedicationEventTimeInput value={time} onChange={value => { if(!write.mayEdit())return;setTimeEdited(true); setTime(value); }} disabled={write.locked} />
      {given ? <View style={styles.row}><View style={styles.field}><PremiumInput label="Tatsächlich verabreichte Dosis *" accessibilityLabel="Tatsächlich verabreichte Dosis" placeholder="Menge und Einheit ausdrücklich angeben" value={dose} editable={!write.locked} onChangeText={value=>{if(write.mayEdit())setDose(value);}} /></View><View style={styles.field}><PremiumInput label="Tatsächlicher Applikationsweg *" accessibilityLabel="Tatsächlicher Applikationsweg" value={route} editable={!write.locked} onChangeText={value=>{if(write.mayEdit())setRoute(value);}} /></View></View> : status ? <Text style={styles.note}>Es werden keine verabreichte Dosis und kein tatsächlicher Gabezeitpunkt eingetragen.</Text> : null}
      {status && status !== 'administered' ? <PremiumInput label="Begründung der Abweichung *" accessibilityLabel="Begründung der Abweichung" value={reason} editable={!write.locked} onChangeText={value=>{if(write.mayEdit())setReason(value);}} multiline /> : null}
      {given && order.isPrn ? <PremiumInput label="Aktuelle Bedarfsindikation *" accessibilityLabel="Aktuelle Bedarfsindikation" value={prn} editable={!write.locked} onChangeText={value=>{if(write.mayEdit())setPrn(value);}} multiline /> : null}
      {given ? <PremiumInput label="Schmerzskala vor Gabe (0–10, optional)" accessibilityLabel="Schmerzskala vor Gabe" value={pain} editable={!write.locked} onChangeText={value=>{if(write.mayEdit())setPain(value);}} /> : null}
      {witnessRequired ? <><Text style={styles.label}>{order.isControlledSubstance ? 'Person der Gegenkontrolle *' : 'Behaltene Personenauswahl'}</Text><Text style={styles.note}>Die Person wird im Nachweis angegeben. Diese Auswahl ersetzt keine separat authentifizierte Gegenzeichnung.</Text>{witnesses.error || witnesses.refreshError || witnessPoolError ? <ErrorState message={witnesses.error ?? witnesses.refreshError ?? witnessPoolError!} onRetry={witnesses.refresh} /> : !witnessReady ? <LoadingState message="Aktuelle Personen für Gegenkontrolle werden geladen…" /> : witnessOptions?.length ? <FilterChipGroup wrap options={witnessOptions.map(p => ({ key: p.id, label: p.label }))} value={witness} onChange={write.locked ? undefined : selectWitness} /> : <Text style={styles.note}>Im vollständig geladenen Bestand ist keine Person für die Gegenkontrolle benannt. Vor einer Dokumentation fachlich klären.</Text>}{witness ? <PremiumButton title="Personenauswahl verwerfen" variant="secondary" disabled={write.locked} onPress={()=>{if(write.mayEdit())setWitness('');}}/> : null}</> : null}
      <PremiumInput label="Bemerkung" accessibilityLabel="Bemerkung" value={notes} editable={!write.locked} onChangeText={value=>{if(write.mayEdit())setNotes(value);}} multiline />
      <View style={styles.actions}><PremiumButton title={write.busy ? 'Speicherbestätigung wird geprüft…' : write.uncertain ? 'Dieselbe Speicheranfrage erneut prüfen' : 'Dokumentation verbindlich speichern'} disabled={write.busy || (!write.uncertain && (write.locked || (order.isPrn&&given) || (witnessRequired && (!witnessReady || !witnessOptions || !witnessOptions.some(option=>option.id===witness))) || order.status !== 'active' || !order.integrity.canRecord || changed || !reviewedVersion || context.refreshFailed))} onPress={save} /><PremiumButton title="Bearbeitung schließen" variant="secondary" disabled={write.busy||write.uncertain} onPress={async () => { if (await write.confirmLeave()) context.close(); }} /></View>
    </View>
  </SectionPanel>;
}

function FollowUpForm(context: Context & { event: MedicationEvent }) {
  const styles = useStyles(); const [time, setTime] = useState(currentMedicationEventTime), [observation, setObservation] = useState(''), [action, setAction] = useState(''), [pain, setPain] = useState('');
  const [timeEdited, setTimeEdited] = useState(false);
  const write = useMedicationFormWrite<FollowUpPayload>(context,!!(timeEdited || observation || action || pain),'follow_up',{time,observation,action,pain},context.event,preparePayload,(id,payload,replay,frozen)=>recordMedicationFollowUp(frozen.related as MedicationEvent,frozen.context.tenantId,id,payload,frozen.context.role), async () => { context.saved('Die Wirkungskontrolle wurde als eigener Eintrag ergänzt.'); await context.refresh(); });
  function preparePayload():FollowUpPayload{const payload={observedAt:medicationEventInstant(time),observation,action,painScore:painValue(pain)};const error=validateMedicationFollowUp(context.event.occurredAt,payload.observedAt,observation,action,payload.painScore);if(error)throw Error(error);return payload;}
  async function save(){if(write.uncertain){await write.retry();return;}try{await write.submit(preparePayload());}catch(e){write.setError(e instanceof Error?e.message:'Wirkungskontrolle prüfen.');}}
  if(!write.canReadBody)return <MedicationFormUnavailable write={write}/>;
  return <SectionPanel title="Wirkungskontrolle ergänzen" subtitle={`Bezug: ${labels[context.event.status]} am ${formatTime(context.event.occurredAt)}`}><View style={styles.form}>
    <SubmissionFeedback {...write} /><MedicationEventTimeInput label="Tatsächlicher Kontrollzeitpunkt" value={time} onChange={value => { if(!write.mayEdit())return;setTimeEdited(true); setTime(value); }} disabled={write.locked} />
    <PremiumInput label="Beobachtung / Wirkung *" accessibilityLabel="Beobachtung / Wirkung" value={observation} editable={!write.locked} onChangeText={value=>{if(write.mayEdit())setObservation(value);}} multiline /><PremiumInput label="Daraus folgende Maßnahme *" accessibilityLabel="Daraus folgende Maßnahme" value={action} editable={!write.locked} onChangeText={value=>{if(write.mayEdit())setAction(value);}} multiline /><PremiumInput label="Schmerzskala (0–10, optional)" accessibilityLabel="Schmerzskala der Wirkungskontrolle" value={pain} editable={!write.locked} onChangeText={value=>{if(write.mayEdit())setPain(value);}} />
    <View style={styles.actions}><PremiumButton title={write.uncertain ? 'Dieselbe Wirkungskontrolle erneut prüfen' : write.busy ? 'Wirkungskontrolle wird gespeichert…' : 'Wirkungskontrolle speichern'} disabled={write.busy||(!write.uncertain&&write.locked)} onPress={save} /><PremiumButton title="Bearbeitung schließen" variant="secondary" disabled={write.busy||write.uncertain} onPress={async () => { if (await write.confirmLeave()) context.close(); }} /></View>
  </View></SectionPanel>;
}

function MedicationStatusForm(context: Context) {
  const styles = useStyles(); const [next, setNext] = useState<'active' | 'paused' | 'stopped' | ''>(''), [reason, setReason] = useState('');
  const [version] = useState(context.order.updatedAt); const changed = version !== context.order.updatedAt;
  const write = useMedicationFormWrite<MedicationStatusPayload>(context,!!(next || reason),'status',{next,reason,version},null,preparePayload,(id,payload,replay,frozen)=>changeMedicationStatus(frozen.context.order,frozen.context.tenantId,id,payload,frozen.context.role), async () => { context.saved('Die begründete Statusänderung wurde gespeichert.'); await context.refresh(); });
  const options = context.order.status === 'active' ? [{ key: 'paused', label: 'Pausieren' }, { key: 'stopped', label: 'Beenden' }] : context.order.status === 'paused' ? [{ key: 'active', label: 'Wieder aktivieren' }, { key: 'stopped', label: 'Beenden' }] : [];
  function preparePayload():MedicationStatusPayload{if(!next||!reason.trim()||changed)throw Error('Gültigen Status, unveränderte Verordnung und Begründung prüfen.');return {status:next,reason,expectedUpdatedAt:version};}
  async function save(){if(write.uncertain){await write.retry();return;}try{await write.submit(preparePayload());}catch(e){write.setError(e instanceof Error?e.message:'Verordnungsstatus prüfen.');}}
  if(!write.canReadBody)return <MedicationFormUnavailable write={write}/>;
  return <SectionPanel title="Verordnungsstatus ändern" subtitle="Begründung und verantwortliche Person bleiben im Verlauf erhalten"><View style={styles.form}><SubmissionFeedback {...write} />{changed ? <InfoBanner variant="warning" title="Verordnung geändert" message="Diese Bearbeitung schließen und den aktuellen Verordnungsstand neu prüfen." /> : null}<FilterChipGroup wrap options={options} value={next} onChange={write.locked ? undefined : value => {if(write.mayEdit())setNext(value as typeof next);}} /><PremiumInput label="Begründung der Statusänderung *" accessibilityLabel="Begründung der Statusänderung" value={reason} editable={!write.locked} onChangeText={value=>{if(write.mayEdit())setReason(value);}} multiline /><View style={styles.actions}><PremiumButton title={write.uncertain ? 'Dieselbe Statusänderung erneut prüfen' : write.busy ? 'Statusänderung wird gespeichert…' : 'Begründete Statusänderung speichern'} disabled={write.busy || (!write.uncertain && (write.locked||changed))} onPress={save} /><PremiumButton title="Bearbeitung schließen" variant="secondary" disabled={write.busy||write.uncertain} onPress={async () => { if (await write.confirmLeave()) context.close(); }} /></View></View></SectionPanel>;
}

function MedicationSourceForm(context: Context & {documents:MedicationSourceDocument[];refreshSources():Promise<boolean>;continueArchive(sourceId:string):void}) {
  const styles=useStyles();const [document,setDocument]=useState<MedicationSourceDocument|null>(null),[reason,setReason]=useState('');
  const [version]=useState(context.order.updatedAt);
  const [fingerprint,setFingerprint]=useState<MedicationSourceFingerprint|null>(null),[capturing,setCapturing]=useState(false);
  const [confirmedId,setConfirmedId]=useState<string|null>(null),[refreshing,setRefreshing]=useState(false),[refreshFailed,setRefreshFailed]=useState(false);
  const confirmedSource=useRef<string|null>(null),refreshFlight=useRef(false);
  const progress=medicationSourceCaptureProgress(document,context.currentSourceDocuments,fingerprint,version,context.order.updatedAt);
  const changed=!progress.orderCurrent;
  const active=useRef(true),captureFlight=useRef(false),currentVersion=useRef(context.order.updatedAt),currentDocument=useRef(document);currentVersion.current=context.order.updatedAt;currentDocument.current=document;
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  async function refreshConfirmed(){
    if(refreshFlight.current||!write.isCurrentRead())return;refreshFlight.current=true;setRefreshing(true);setRefreshFailed(false);
    try{const ok=await context.refreshSources();if(active.current&&write.isCurrentRead())setRefreshFailed(!ok);}
    catch{if(active.current&&write.isCurrentRead())setRefreshFailed(true);}
    finally{refreshFlight.current=false;if(active.current)setRefreshing(false);}
  }
  const write=useMedicationFormWrite<MedicationSourcePayload>(context,!confirmedId&&(!!document||!!reason),'source',{document,reason,version,fingerprint,capturing},document,preparePayload,async(id,payload,replay,frozen)=>{
    if(!frozen.related)return {ok:false,error:'Dokument auswählen.'};
    const result=await linkMedicationSource(frozen.context.order,frozen.related as MedicationSourceDocument,frozen.context.tenantId,id,payload,frozen.context.role,replay,{actorId:frozen.context.actorId,isCurrent:():boolean=>write.isCurrentRead()});
    if(result.ok)confirmedSource.current=result.data.id;return result;
  },async(isCurrent)=>{
    if(!isCurrent()||!confirmedSource.current)throw Error('Bestätigten Quellenbezug erneut laden.');
    // A confirmed write is retained independently from a later list-refresh failure.
    setConfirmedId(confirmedSource.current);await refreshConfirmed();
  });
  async function capture(){
    if(!document||!sameWoundJson(document,currentDocument.current)||!write.mayEdit(context.currentSourceDocuments)||!write.mayPrepare()||captureFlight.current||changed)return;const capturedDocument=structuredClone(document);
    captureFlight.current=true;setCapturing(true);setFingerprint(null);write.setError(null);
    try {
      const result=await fetchMedicationSourceFingerprint(context.order,document,context.tenantId,context.role,()=>active.current&&write.isCurrentRead()&&write.mayPrepare()&&currentVersion.current===version&&sameWoundJson(currentDocument.current,capturedDocument));
      if(!active.current||!write.isCurrentRead()||!write.mayPrepare()||!sameWoundJson(currentDocument.current,capturedDocument))return;
      if(!result.ok){write.setError(result.error);return;}
      if(currentVersion.current!==version){write.setError('Verordnung geändert. Aktuellen Stand neu prüfen.');return;}
      setFingerprint(result.data);
    }catch{if(active.current&&write.isCurrentRead())write.setError('Der Dateiinhalt konnte nicht erfasst werden. Bitte erneut versuchen.');}
    finally{captureFlight.current=false;if(active.current)setCapturing(false);}
  }
  function preparePayload():MedicationSourcePayload{
    if(captureFlight.current||capturing||!document||changed||!progress.documentCurrent)throw Error(progress.issue??'Dokument und unveränderten Verordnungsstand prüfen.');
    if(!progress.bytesCurrent||!fingerprint)throw Error('Den Dateiinhalt für das ausgewählte Dokument zuerst erfassen.');
    const payload={documentId:document.id,documentUpdatedAt:document.updatedAt,expectedUpdatedAt:version,reason,contentSha256:fingerprint.sha256,contentSize:fingerprint.sizeBytes};const error=validateMedicationSource(context.order,document,payload);if(error)throw Error(error);return payload;
  }
  async function save(){if(captureFlight.current)return;if(write.uncertain){await write.retry();return;}try{await write.submit(preparePayload());}catch(e){write.setError(e instanceof Error?e.message:'Quellenzuordnung prüfen.');}}
  if(!write.canReadBody)return <MedicationFormUnavailable write={write}/>;
  if(confirmedId){const source=context.currentSourceLinks.find(link=>link.id===confirmedId);const archiveReady=medicationSourceArchiveReadiness(source,context.order.updatedAt);return <SectionPanel title="Quelle gespeichert" subtitle={document?.title}><View style={styles.form}>
    <SuccessState message="Die Quellenzuordnung wurde nach dem Speichern unter Ihren Zugriffsrechten zurückgelesen. Diese Zuordnung wird nicht noch einmal angelegt."/>
    {document?<Text style={styles.body}>{document.fileName} · Dokumentstand {formatTime(document.updatedAt)}</Text>:null}
    {refreshing?<LoadingState message="Gespeicherte Quelle wird in der Übersicht aktualisiert…"/>:refreshFailed||context.sourceUnavailable?<ErrorState message="Die Quelle ist gespeichert. Die Übersicht konnte noch nicht aktualisiert werden; erneutes Laden startet keine neue Quellenzuordnung." onRetry={refreshConfirmed}/>:null}
    {!refreshing&&!refreshFailed&&!context.sourceUnavailable?<InfoBanner variant="info" title={archiveReady.allowed?'Archivkopie als nächster Schritt':'Quellenstand prüfen'} message={archiveReady.reason}/>:null}
    <View style={styles.actions}><PremiumButton title="Weiter zur Archivkopie" accessibilityLabel="Die bestätigte gespeicherte Quelldatei im Archiv sichern" disabled={write.busy||refreshing||refreshFailed||context.sourceUnavailable||!context.canManage||!archiveReady.allowed} onPress={()=>context.continueArchive(confirmedId)}/><PremiumButton title="Übersicht aktualisieren" variant="secondary" disabled={write.busy||refreshing} onPress={refreshConfirmed}/><PremiumButton title="Schließen" accessibilityLabel="Quellenbearbeitung schließen" variant="secondary" disabled={write.busy||refreshing} onPress={async()=>{if(await write.confirmLeave())context.close();}}/></View>
  </View></SectionPanel>;}
  return <SectionPanel title="Dokument als Verordnungsquelle zuordnen" subtitle="Dokument auswählen, Dateiinhalt erfassen und gespeicherte Zuordnung bestätigen"><View style={styles.form}>
    <SubmissionFeedback {...write}/><SourceWorkflowSteps current={progress.step} labels={['Dokument auswählen','Dateiinhalt erfassen','Zuordnung speichern']}/>
    <InfoBanner variant="info" message="Verwenden Sie eine bereits in dieser Klientenakte hinterlegte Originalunterlage. Die Datei wird vor dem Speichern vollständig geladen. Die Zuordnung ersetzt keine fachliche Prüfung oder ärztliche Freigabe."/>
    {progress.issue?<InfoBanner variant="warning" title="Dokument- oder Verordnungsstand geändert" message={progress.issue}/>:null}
    {context.currentSourceDocuments.length ? <FilterChipGroup wrap options={context.currentSourceDocuments.map(d=>({key:d.id,label:`${d.title} · ${d.fileName}`}))} value={document?.id??''} onChange={write.locked||capturing?undefined:id=>{if(!write.mayEdit(context.currentSourceDocuments)||captureFlight.current)return;const selected=context.currentSourceDocuments.find(d=>d.id===id);setDocument(selected?structuredClone(selected):null);setFingerprint(null);write.setError(null);}}/> : <Text style={styles.note}>Keine aktiven Dokumente vorhanden. Die Originalunterlage zuerst über die bestehende Dokumentenablage der Klientenakte hinterlegen.</Text>}
    {document ? <View style={styles.sourceSummary}><Text style={styles.title}>{document.title}</Text><Text style={styles.body}>{document.fileName}</Text><Text style={styles.note}>Dokumentstand: {formatTime(document.updatedAt)}</Text><PremiumButton title={capturing?'Datei wird gelesen…':progress.bytesCurrent?'Dateiinhalt erneut erfassen':'Dateiinhalt erfassen'} variant="secondary" disabled={write.locked||capturing||changed||!progress.documentCurrent} onPress={capture}/></View> : null}
    {progress.bytesCurrent&&fingerprint ? <SuccessState message={`Dateiinhalt erfasst: ${fingerprint.sizeBytes.toLocaleString('de-DE')} Bytes. Er gehört zum ausgewählten Dokumentstand; eine Archivkopie wird erst im nächsten Schritt angelegt.`}/> : null}
    <PremiumInput label="Begründung und Bezug zur Verordnung *" accessibilityLabel="Begründung der Quellenzuordnung" value={reason} editable={!write.locked&&!capturing} onChangeText={value=>{if(write.mayEdit())setReason(value);}} maxLength={2000} multiline/>
    <View style={styles.actions}><PremiumButton title={write.uncertain?'Anfrage erneut prüfen':write.busy?'Quelle wird geprüft…':'Quelle speichern'} disabled={write.busy||capturing||(!write.uncertain&&(write.locked||!progress.bytesCurrent||!reason.trim()))} onPress={save}/><PremiumButton title="Schließen" accessibilityLabel="Quellenbearbeitung schließen" variant="secondary" disabled={write.busy||write.uncertain||capturing} onPress={async()=>{if(await write.confirmLeave())context.close();}}/></View>
  </View></SectionPanel>;
}

function MedicationSourceArchiveForm(context:Context & {sourceId:string;refreshSources():Promise<boolean>}) {
  const styles=useStyles();const [confirmed,setConfirmed]=useState(false),[refreshing,setRefreshing]=useState(false),[refreshFailed,setRefreshFailed]=useState(false);const active=useRef(true),refreshFlight=useRef(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  async function refreshConfirmed(){if(refreshFlight.current||!write.isCurrentRead())return;refreshFlight.current=true;setRefreshing(true);setRefreshFailed(false);try{const ok=await context.refreshSources();if(active.current&&write.isCurrentRead())setRefreshFailed(!ok);}catch{if(active.current&&write.isCurrentRead())setRefreshFailed(true);}finally{refreshFlight.current=false;if(active.current)setRefreshing(false);}}
  const write=useMedicationFormWrite<{sourceId:string}>(context,false,'archive',{sourceId:context.sourceId},null,()=>({sourceId:context.sourceId}),(id,payload,replay,frozen)=>archiveMedicationSourceCopy(frozen.context.order,payload.sourceId,frozen.context.tenantId,id,frozen.context.role,():boolean=>write.isCurrentRead()),async(isCurrent)=>{
    if(!isCurrent())throw Error('Bestätigten Archivbezug erneut laden.');setConfirmed(true);await refreshConfirmed();
  });
  if(!write.canReadBody)return <MedicationFormUnavailable write={write}/>;
  const source=context.currentSourceLinks.find(link=>link.id===context.sourceId);const readiness=medicationSourceArchiveReadiness(source,context.order.updatedAt);
  return <SectionPanel title={confirmed?'Archivkopie bestätigt':readiness.recheck?'Vorhandene Archivkopie erneut prüfen':'Quelldatei im Archiv sichern'} subtitle={source?.documentTitle}><View style={styles.form}>
    {confirmed?<><SuccessState message="Der Dateiinhalt wurde geprüft, der Archivabschluss gespeichert und die bereitgestellte Kopie unter Ihren aktuellen Zugriffsrechten bestätigt."/>{refreshing?<LoadingState message="Archivkopie wird in der Quellenübersicht aktualisiert…"/>:refreshFailed||context.sourceUnavailable?<ErrorState message="Die Archivkopie ist bestätigt. Die Quellenübersicht konnte noch nicht aktualisiert werden. Erneutes Laden legt keine weitere Archivkopie an." onRetry={refreshConfirmed}/>:null}<View style={styles.actions}><PremiumButton title="Übersicht aktualisieren" variant="secondary" disabled={write.busy||refreshing} onPress={refreshConfirmed}/><PremiumButton title="Schließen" accessibilityLabel="Quellenbearbeitung schließen" variant="secondary" disabled={write.busy||refreshing} onPress={async()=>{if(await write.confirmLeave())context.close();}}/></View></>:<>
    <SubmissionFeedback {...write}/>
    {source?<View style={styles.sourceSummary}><Text style={styles.title}>{source.documentTitle}</Text><Text style={styles.body}>{source.fileName}</Text><Text style={styles.note}>Dokumentstand: {formatTime(source.documentVersion)}</Text></View>:null}
    <InfoBanner variant={readiness.allowed?'info':'warning'} title="Inhalt und Quellenbezug prüfen" message={readiness.allowed?'Der Server liest die Datei, vergleicht ihren Inhalt und prüft den Quellenbezug vor dem gemeinsamen Archivabschluss erneut. Bei einer vorhandenen Kopie wird auch deren Dateiinhalt neu geprüft. Die Kopie ersetzt keine fachliche Freigabe.':readiness.reason}/>
    <View style={styles.actions}><PremiumButton title={write.busy?'Archiv wird geprüft…':write.uncertain?'Anfrage erneut prüfen':readiness.recheck?'Archivkopie prüfen':'Archivkopie sichern'} disabled={write.busy||(!write.uncertain&&(write.locked||!readiness.allowed))} onPress={()=>write.uncertain?write.retry():write.submit({sourceId:context.sourceId})}/><PremiumButton title="Schließen" accessibilityLabel="Quellenbearbeitung schließen" variant="secondary" disabled={write.busy||write.uncertain} onPress={async()=>{if(await write.confirmLeave())context.close();}}/></View>
    </>}
  </View></SectionPanel>;
}

function SourceWorkflowSteps({current,labels}:{current:number;labels:string[]}){const styles=useStyles();return <View style={styles.sourceSteps}>{labels.map((label,index)=><View key={label} style={styles.sourceStep}><Text style={styles.label}>{index+1}. {label}</Text><Text style={styles.note}>{index+1<current?'Abgeschlossen':index+1===current?'Aktueller Schritt':'Danach'}</Text></View>)}</View>;}

function SubmissionFeedback({ error, uncertain }: { error: string | null; uncertain: boolean }) {
  return <>{error ? <ErrorState message={error} /> : null}{uncertain ? <InfoBanner variant="warning" title="Speicherergebnis noch unklar" message="Ihre Anfrage bleibt unverändert erhalten. Bitte dieselbe Anfrage erneut prüfen. Weitere Änderungen und das Schließen sind bis zur Klärung gesperrt." /> : null}</>;
}

function useStyles() {
  const { c } = useCareLightPalette();
  return useMemo(() => StyleSheet.create({
    content: { gap: spacing.md, paddingBottom: spacing.xxl, minWidth: 0 }, form: { gap: spacing.md, minWidth: 0 },
    body: { ...typography.body, color: c.text }, note: { ...typography.caption, color: c.muted }, label: { ...typography.label, color: c.text }, title: { ...typography.bodyStrong, color: c.text, maxWidth: '100%' }, warning: { ...typography.caption, color: c.warning },
    sourceSummary: { borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: spacing.md, gap: spacing.sm, minWidth: 0 }, sourceSteps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 }, sourceStep: { flexGrow: 1, flexBasis: 180, minWidth: 0, borderLeftWidth: 2, borderLeftColor: c.border, paddingLeft: spacing.sm, gap: spacing.xs },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, field: { flex: 1, flexBasis: 240, minWidth: 0 },
    history: { borderTopWidth: 1, borderTopColor: c.border, paddingVertical: spacing.md, gap: spacing.sm, minWidth: 0 }, historyTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm }, followUp: { borderLeftWidth: 2, borderLeftColor: c.border, paddingLeft: spacing.md, gap: spacing.xs },
  }), [c]);
}
