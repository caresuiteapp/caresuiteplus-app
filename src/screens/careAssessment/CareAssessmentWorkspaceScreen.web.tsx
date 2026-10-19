import {createCareAssessmentQueryAttempt,assertCareAssessmentQueryAttempt,assertCareAssessmentQueryLifetime,type CareAssessmentQueryAttempt} from '@/lib/careAssessment/careAssessmentQueryAttempt.web';
import {PlanEvaluationPanel} from './PlanEvaluationPanel.web';
import { useCareRuntimePermissions as usePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import {careAssessmentRuntimeAccess,assertCareAssessmentRuntimeReadAccess} from '@/lib/careAssessment/careAssessmentRuntimeAccess.web';
import {ContinenceProfilePanel} from './ContinenceProfilePanel.web';
import {assessmentReasonChoices,assertAssessmentLifecycleReceipt,type AssessmentLifecycleRequest} from '@/lib/careAssessment/assessmentLifecycleDomain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {sameWoundJson,woundUuid} from '@/lib/pflege/woundCareDomain';
import {createCareAssessmentReadBoundary,beginCareAssessmentRead,acceptCareAssessmentQueryRead,captureCareAssessmentPendingRead,acceptCareAssessmentConfirmedRead,isCurrentCareAssessmentReadEnvelope,type CareAssessmentReadScope,type CareAssessmentReadBoundary,type CareAssessmentReadEnvelope,type CareAssessmentPendingRead,type CareAssessmentReadTicket} from '@/lib/careAssessment/careAssessmentReadBoundary.web';
import {useMedicationSubmission} from '@/hooks/useMedicationSubmission.web';
import {makeAssessmentDraftRequest,assertAssessmentDraftStoredRead,type AssessmentDraftRequest} from '@/lib/careAssessment/assessmentDraftRequestDomain';
import {assessmentInstrumentPacketIssue,type AssessmentInstrumentPacket} from '@/lib/careAssessment/assessmentInstrumentPacket.web';
import {AssessmentInstrumentPanel} from './AssessmentInstrumentPanel.web';
import {planLifecyclePacketIssue,type PlanLifecyclePacket} from '@/lib/careAssessment/planLifecyclePacket.web';
import {PlanLifecyclePanel} from './PlanLifecyclePanel.web';
import {AssessmentPathWorkspace} from '@/components/careAssessment/AssessmentPathWorkspace.web';
import {CarePlanPathWorkspace} from '@/components/careAssessment/CarePlanPathWorkspace.web';
import {MentalHealthCarePathPanel} from '@/components/careAssessment/MentalHealthCarePathPanel.web';
import {PalliativeSpecialCarePathPanel} from '@/components/careAssessment/PalliativeSpecialCarePathPanel.web';
import {CounselingCoordinationPathPanel} from '@/components/careAssessment/CounselingCoordinationPathPanel.web';
import {adoptCareAssessmentDraftRead,careAssessmentDraftReadState,confirmCareAssessmentDraftWrite,type CareAssessmentDraftBaseline,type CareAssessmentDraftContext} from '@/lib/careAssessment/careAssessmentDraftReadState.web';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useResidentList } from '@/hooks/useResidentList';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { hasPermission } from '@/lib/permissions';
import {
  CARE_ASSESSMENT_TOPIC_LABELS,
  CARE_RISK_CATALOG,
  QPR_2026_CHECKS,
  addCareAssessmentEvaluation,
  calculateCareAssessmentCompleteness,
  createCareAssessment,
  fetchEligibleCareClients,
  fetchCareAssessment,
  getRiskLabel,
  saveCareAssessment,
  transitionCareAssessment,
  writeAmbulatoryAssessmentRequest,
  applyAmbulatoryAssessmentLifecycle,
} from '@/lib/careAssessment';
import type {
  CareAssessment,
  CareAssessmentMeasure,
  CareAssessmentRisk,
  CareAssessmentSubjectType,
  CareAssessmentTopicKey,
} from '@/types/modules/careAssessment';
import { colors, radius, spacing, typography } from '@/theme';

type Selectable = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  careLevel?: string | null;
};
const sections = [
  { key: 'person', label: 'Person & Originalton', short: '01' },
  { key: 'topics', label: 'Sechs Themenfelder', short: '02' },
  { key: 'mental', label: 'Psychosozial & Schutz', short: '03' },
  { key: 'palliative', label: 'Palliativ & besondere Lebenslagen', short: '04' },
  { key: 'coordination', label: 'Beratung & Koordination', short: '05' },
  { key: 'risks', label: 'Risikoeinschätzungen', short: '06' },
  { key: 'measures', label: 'Maßnahmenplanung', short: '07' },
  { key: 'quality', label: 'Prüfung & Freigabe', short: '08' },
  { key: 'evaluation', label: 'Evaluation', short: '09' },
  { key: 'history', label: 'Verlauf & Versionen', short: '10' },
] as const;
type Section = (typeof sections)[number]['key'];
const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

function CreateClient() {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const query = useAsyncQuery(
    () => tenantId
      ? fetchEligibleCareClients(tenantId, profile?.roleKey)
      : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );
  return <CreateForm key={`${tenantId}:${profile?.id}:${profile?.roleKey}`} subjectType="client" items={query.data ?? []} loading={query.loading} error={query.error} />;
}
function CreateResident() {
  const list = useResidentList();
  return <CreateForm subjectType="resident" items={list.allItems} loading={list.loading} error={list.error} />;
}

function CreateForm({ subjectType, items, loading, error }: {
  subjectType: CareAssessmentSubjectType;
  items: Selectable[];
  loading: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [subjectId, setSubjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const resident = subjectType === 'resident';
  const [reason,setReason]=useState('');
  const [reasonDetail,setReasonDetail]=useState('');
  const [createdId,setCreatedId]=useState<string|null>(null);
  const confirmedId=useRef<string|null>(null);
  const creation=useMedicationSubmission<AssessmentLifecycleRequest>(!resident&&(!!subjectId||!!reason||!!reasonDetail),async(requestId,payload)=>{
    if(!tenantId||payload.action!=='create')return {ok:false,error:'Aufnahmebezug fehlt.'};
    const result=await applyAmbulatoryAssessmentLifecycle(tenantId,requestId,payload,profile?.roleKey);
    if(result.ok)confirmedId.current=result.id;return result;
  },()=>{setCreatedId(confirmedId.current);setSubjectId('');setReason('');setReasonDetail('');});
  const creationLocked=!resident&&(creation.locked||!!createdId);
  const base = resident ? '/stationaer/assessment' : '/pflege/sis';
  const canManage = hasPermission(profile?.roleKey, resident ? 'stationaer.assessments.manage' : 'pflege.assessments.manage');
  useEffect(() => { if (resident && !subjectId && items[0]) setSubjectId(items[0].id); }, [items, subjectId, resident]);
  async function create() {
    if (!tenantId || !subjectId || creationLocked) return;
    if(!resident){await creation.submit({action:'create',subjectId,assessmentId:'',expectedRevision:'',expectedVersion:'',reason,reasonDetail,returnReason:''});return;}
    const selected = items.find((item) => item.id === subjectId);
    if (!selected) return;
    setSaving(true);
    const result = await createCareAssessment(tenantId, {
      subjectType,
      subjectId,
      subjectName: `${selected.firstName} ${selected.lastName}`,
      variant: resident ? 'stationaer' : 'ambulant',
      reason: 'initial',
      assessorName: profile?.displayName ?? '',
    }, profile?.roleKey);
    setSaving(false);
    if (!result.ok) return setActionError(result.error);
    router.replace(`${base}/${result.data.id}` as never);
  }
  return (
    <ScreenShell title={resident ? 'Stationäres Assessment starten' : 'Pflegeassessment starten'} subtitle="Personenzentrierter Pflegeprozess">
      {loading ? <LoadingState message="Personen werden geladen…" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {!resident&&creation.error ? <ErrorState message={creation.error} /> : null}
      {!resident&&creation.uncertain ? <SectionPanel title="Erstellung noch nicht bestätigt"><InfoBanner variant="warning" title="Anfrage prüfen" message="Der Datensatz kann bereits angelegt sein. Auswahl und Anlass bleiben gesperrt; dieselbe Anfrage wird wiederholt." /><PremiumButton title="Dieselbe Anfrage erneut prüfen" loading={creation.busy} disabled={creation.busy} onPress={creation.retry} /></SectionPanel> : null}
      {!resident&&createdId ? <SectionPanel title="Assessment angelegt"><InfoBanner variant="success" title="Entwurf bestätigt" message="Der neue Pflegeassessment-Entwurf wurde mit seinen Themenfeldern angelegt." /><PremiumButton title="Bestätigten Entwurf öffnen" disabled={creation.busy} onPress={()=>router.replace(`${base}/${createdId}` as never)} /></SectionPanel> : null}
      {!loading && !items.length ? (
        <EmptyState
          title={resident ? 'Keine aktive Bewohnerin oder kein aktiver Bewohner' : 'Kein aktiver Pflegefall'}
          message={resident
            ? 'Vorher muss eine Person im stationären Fachbereich aufgenommen werden.'
            : 'Die Auswahl zeigt ausschließlich Personen mit aktiver Pflege-Zuordnung. Assist-Klient:innen werden nicht übernommen.'}
        />
      ) : (
        <SectionPanel title={resident ? 'Bewohner:in' : 'Klient:in'}>
          <InfoBanner
            variant="info"
            title={resident ? 'Stationärer Aufnahmebestand' : 'Eigenständiger Pflege-Klientenstamm'}
            message={resident
              ? 'Es werden ausschließlich aktive Bewohner:innen angeboten.'
              : 'Es werden ausschließlich ausdrücklich in Pflege aufgenommene Personen angeboten. Keine Assist-Übernahme.'}
          />
          <FilterChipGroup
            wrap
            options={items.map((item) => ({
              key: item.id,
              label: `${item.lastName}, ${item.firstName}${item.careLevel ? ` · ${item.careLevel}` : ''}`,
            }))}
            value={subjectId}
            onChange={(next)=>{if(!creationLocked)setSubjectId(next);}}
          />
          {!resident ? <><FilterChipGroup wrap options={[...assessmentReasonChoices]} value={reason} onChange={(next)=>{if(!creationLocked)setReason(next);}} /><PremiumInput label="Konkreter Anlass der Erhebung" value={reasonDetail} onChangeText={setReasonDetail} multiline maxLength={2000} editable={!creationLocked} /></> : null}
          <PremiumInput label={resident?"Verantwortliche Pflegefachperson":"Dokumentierende Person"} value={profile?.displayName ?? ''} editable={false} />
          <PremiumButton title="Pflegeprozess starten" disabled={!subjectId || !canManage || saving || creationLocked || (!resident&&!reason)} loading={saving || creation.busy} onPress={create} />
        </SectionPanel>
      )}
    </ScreenShell>
  );
}

export function CareAssessmentWorkspaceScreen({ subjectType, mode }: {
  subjectType: CareAssessmentSubjectType;
  mode: 'create' | 'workspace';
}) {
  const tenantId=useServiceTenantId();
  const {profile}=useAuth();
  const {id}=useLocalSearchParams<{id?:string}>();
  if (mode === 'create') return subjectType === 'resident' ? <CreateResident /> : <CreateClient />;
  return subjectType==='resident'?<Workspace key={`${tenantId}:${profile?.id}:${profile?.roleKey}:${subjectType}:${id}`} subjectType={subjectType} />:<AmbulantRuntimeWorkspace key={`${tenantId}:${profile?.id}:${profile?.roleKey}:${subjectType}:${id}`} />;
}

function AmbulantRuntimeWorkspace(){
 const tenantId=useServiceTenantId(),{profile}=useAuth(),permissions=usePermissions();
 const runtimeAccess=careAssessmentRuntimeAccess({tenantId:tenantId??'',profileId:profile?.id??'',profileRole:profile?.roleKey??'',runtimeTenantId:permissions.tenantId??'',runtimeRole:permissions.roleKey??'',canView:permissions.can('pflege.plans.view'),canManage:permissions.can('pflege.assessments.manage')});
 const mentalAccess={canRead:runtimeAccess.canRead&&permissions.can('pflege.risks.view')&&permissions.can('office.clients.view_sensitive'),canWrite:runtimeAccess.canManage&&permissions.can('pflege.risks.manage')&&permissions.can('office.clients.view_sensitive'),canRelease:runtimeAccess.canManage&&permissions.can('pflege.risks.manage')&&permissions.can('pflege.audit.view')&&permissions.can('office.clients.view_sensitive'),canReview:runtimeAccess.canManage&&permissions.can('pflege.documentation.sign')&&permissions.can('pflege.audit.view')&&permissions.can('office.clients.view_sensitive')};
 const palliativeAccess={canRead:runtimeAccess.canRead&&permissions.can('pflege.orders.view')&&permissions.can('office.documents.view')&&permissions.can('office.clients.view_sensitive'),canWrite:runtimeAccess.canManage&&permissions.can('pflege.orders.manage')&&permissions.can('office.documents.view')&&permissions.can('office.clients.view_sensitive'),canRelease:runtimeAccess.canManage&&permissions.can('pflege.orders.manage')&&permissions.can('pflege.audit.view')&&permissions.can('office.documents.view')&&permissions.can('office.clients.view_sensitive'),canReview:runtimeAccess.canManage&&permissions.can('pflege.documentation.sign')&&permissions.can('pflege.audit.view')&&permissions.can('office.documents.view')&&permissions.can('office.clients.view_sensitive')};
 const coordinationAccess={canRead:runtimeAccess.canRead&&permissions.can('beratung.cases.view')&&permissions.can('office.appointments.view')&&permissions.can('office.documents.view')&&permissions.can('communication.view_center')&&permissions.can('communication.view_client_threads')&&permissions.can('office.clients.view_sensitive'),canWrite:runtimeAccess.canManage&&permissions.can('pflege.orders.manage')&&permissions.can('beratung.cases.view')&&permissions.can('office.appointments.view')&&permissions.can('office.documents.view')&&permissions.can('communication.view_center')&&permissions.can('communication.view_client_threads')&&permissions.can('office.clients.view_sensitive'),canRelease:runtimeAccess.canManage&&permissions.can('pflege.orders.manage')&&permissions.can('pflege.audit.view')&&permissions.can('beratung.cases.view')&&permissions.can('office.documents.view')&&permissions.can('communication.view_client_threads')&&permissions.can('office.clients.view_sensitive'),canReview:runtimeAccess.canManage&&permissions.can('pflege.documentation.sign')&&permissions.can('pflege.audit.view')&&permissions.can('beratung.cases.view')&&permissions.can('office.documents.view')&&permissions.can('communication.view_client_threads')&&permissions.can('office.clients.view_sensitive')};
 return <Workspace subjectType="client" runtimeAccess={runtimeAccess} mentalAccess={mentalAccess} palliativeAccess={palliativeAccess} coordinationAccess={coordinationAccess}/>;
}

function Workspace({ subjectType,runtimeAccess,mentalAccess,palliativeAccess,coordinationAccess }: { subjectType: CareAssessmentSubjectType;runtimeAccess?:ReturnType<typeof careAssessmentRuntimeAccess>;mentalAccess?:{canRead:boolean;canWrite:boolean;canRelease:boolean;canReview:boolean};palliativeAccess?:{canRead:boolean;canWrite:boolean;canRelease:boolean;canReview:boolean};coordinationAccess?:{canRead:boolean;canWrite:boolean;canRelease:boolean;canReview:boolean} }) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const [value, setValue] = useState<CareAssessment | null>(null);
  const evaluationLeave=useRef<()=>Promise<boolean>>(async()=>true);
  const navigationAlive=useRef(true),readBoundary=useRef<CareAssessmentReadBoundary|null>(null),queryAttempt=useRef<CareAssessmentQueryAttempt|null>(null),lastSavedPlan=useRef<CareAssessment|null>(null);
  useEffect(()=>{navigationAlive.current=true;return()=>{navigationAlive.current=false;readBoundary.current=null;queryAttempt.current=null;};},[]);
  const [section, setSection] = useState<Section>('person');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [evaluationOutcome, setEvaluationOutcome] = useState<'' | 'effective' | 'partly_effective' | 'not_effective' | 'deteriorated' | 'not_assessable'>(subjectType==='resident'?'effective':'');
  const [observedEffect, setObservedEffect] = useState('');
  const [personFeedback, setPersonFeedback] = useState('');
  const [professionalConclusion, setProfessionalConclusion] = useState('');
  const [changesRequired, setChangesRequired] = useState('');
  const resident = subjectType === 'resident';
  const compact = width < 1060;
  const canManage=resident?hasPermission(profile?.roleKey,'stationaer.assessments.manage'):runtimeAccess?.canManage===true;
  const canReadPlan=runtimeAccess?.canRead===true;
  const readScope:CareAssessmentReadScope={tenantId:tenantId??'',profileId:profile?.id??'',roleKey:profile?.roleKey??'',assessmentId:id??'',subjectType,canRead:canReadPlan};
  if(resident||!canReadPlan||!woundUuid(id)){readBoundary.current=null;queryAttempt.current=null;}
  else if(!readBoundary.current||!sameWoundJson(readBoundary.current.scope,readScope)){readBoundary.current=createCareAssessmentReadBoundary(readScope,lastSavedPlan.current);queryAttempt.current=null;}
  const queryLifetime=readBoundary.current?.lifetime??null;
  const query = useAsyncQuery<CareAssessment|CareAssessmentReadEnvelope>(
    async()=>{
      if(!tenantId||!id)return {ok:false as const,error:'Assessment-ID fehlt.'};
      if(resident)return fetchCareAssessment(tenantId,id,subjectType,profile?.roleKey);
      if(!navigationAlive.current)throw Error('Der ursprüngliche Pflegeplan-Lesekontext ist nicht mehr zugänglich.');
      assertCareAssessmentQueryLifetime(readBoundary.current?.lifetime??null,queryLifetime);
      const boundary=readBoundary.current;if(!boundary)throw Error('Aktueller nativer Pflegeplan-Lesekontext fehlt.');
      const attempt=createCareAssessmentQueryAttempt();queryAttempt.current=attempt;
      const ticket=beginCareAssessmentRead(boundary),loaded=await fetchCareAssessment(tenantId,id,subjectType,profile?.roleKey);
      assertCareAssessmentQueryAttempt(queryAttempt.current,attempt);
      const current=readBoundary.current;if(!navigationAlive.current||!current)throw Error('Der ursprüngliche Pflegeplan-Lesekontext ist nicht mehr zugänglich.');
      if(!loaded.ok)return loaded;
      const accepted=acceptCareAssessmentQueryRead(current,ticket,loaded.data,current.scope);readBoundary.current=accepted.boundary;
      return {ok:true as const,data:accepted.envelope};
    },
    [tenantId, id, subjectType, profile?.roleKey, resident?undefined:profile?.id],
    { enabled: !!tenantId && !!id&&(resident||canReadPlan),queryKey:resident?undefined:`${tenantId}:${profile?.id}:${profile?.roleKey}:${subjectType}:${id}:${canReadPlan}:saved-assessment` },
  );
  const queryEnvelope=!resident&&query.data&&'receipt' in query.data?query.data:null;
  const envelopeCurrent=!!queryEnvelope&&!!readBoundary.current&&isCurrentCareAssessmentReadEnvelope(readBoundary.current,queryEnvelope);
  const queryAssessment=resident?query.data as CareAssessment|null:envelopeCurrent?queryEnvelope!.assessment:null;
  const staleEnvelope=!resident&&!!query.data&&!envelopeCurrent;
  const [baseline,setBaseline]=useState<CareAssessmentDraftBaseline|null>(null);
  const [instrumentState,setInstrumentState]=useState<{packet:AssessmentInstrumentPacket|null;issue:string|null;dirty:boolean;loading:boolean}>({packet:null,issue:'Instrumenten- und Modellbestand vollständig laden.',dirty:false,loading:true});
  const [instrumentGeneration,setInstrumentGeneration]=useState(0);
  const [planState,setPlanState]=useState<{packet:PlanLifecyclePacket|null;issue:string|null;dirty:boolean;loading:boolean}>({packet:null,issue:'Planlebenszyklus vollständig laden.',dirty:false,loading:true});
  const [planGeneration,setPlanGeneration]=useState(0);
  const [needsReload,setNeedsReload]=useState(false),[lifecycleBusy,setLifecycleBusy]=useState(false);
  const lifecyclePending=useRef(false);
  const changeLifecyclePending=useCallback((pending:boolean)=>{lifecyclePending.current=pending;if(navigationAlive.current)setLifecycleBusy(pending);},[]);
  const intentRef=useRef<'save'|'review'>('save');
  const draftContext:CareAssessmentDraftContext={tenantId:tenantId??'',profileId:profile?.id??'',roleKey:profile?.roleKey??'',assessmentId:id??'',subjectType,subjectId:baseline?.context.subjectId??value?.subjectId??queryAssessment?.subjectId??''};
  const persistedContextValid=!!queryAssessment&&queryAssessment.tenantId===draftContext.tenantId&&queryAssessment.id===draftContext.assessmentId&&queryAssessment.subjectType===subjectType&&queryAssessment.subjectId===draftContext.subjectId;
  const readBlocked=!canReadPlan||query.loading||query.refreshing||!!query.error||!!query.refreshError||!persistedContextValid;
  const persisted=persistedContextValid?queryAssessment:null;
  if(!resident&&!readBlocked&&persisted)lastSavedPlan.current=persisted;
  const panelAssessment=persisted??lastSavedPlan.current;
  const readState=useMemo(()=>{if(resident)return {data:{dirty:false,diverged:false,mayAdoptRead:false,writeBlocked:false},error:''};try{return {data:careAssessmentDraftReadState(baseline,value,readBlocked?null:persisted,draftContext),error:''};}catch(error){return {data:{dirty:!!value,diverged:true,mayAdoptRead:false,writeBlocked:true},error:error instanceof Error?error.message:'Gespeicherten Formularbezug prüfen.'};}},[resident,baseline,value,persisted,readBlocked,draftContext.tenantId,draftContext.profileId,draftContext.roleKey,draftContext.assessmentId,draftContext.subjectType,draftContext.subjectId]);
  const dirty=!resident&&readState.data.dirty;
  const workspaceState=useRef({context:draftContext,baseline,value,persisted,envelope:queryEnvelope,readBlocked,canReadPlan,writeLocked:true,pending:false});
  const pendingDraft=useRef<{request:AssessmentDraftRequest;context:CareAssessmentDraftContext;baseline:CareAssessmentDraftBaseline|null;editable:CareAssessment;requestId:string;provenance:CareAssessmentPendingRead}|null>(null);
  function acceptConfirmed(loaded:CareAssessment,captured:CareAssessmentDraftContext,ticket:CareAssessmentReadTicket,provenance:CareAssessmentPendingRead){const current=workspaceState.current;assertCurrentReadContext(captured);const boundary=readBoundary.current;if(!boundary)throw Error('Aktuellen Pflegeplan-Lesestand erneut bestätigen.');const published=acceptCareAssessmentConfirmedRead(boundary,ticket,provenance,loaded,current.context);const accepted=confirmCareAssessmentDraftWrite(loaded,captured,current.context);readBoundary.current=published.boundary;query.setData(published.envelope);setBaseline(accepted.baseline);setValue(accepted.value);setNeedsReload(false);}
  async function reloadConfirmedDraft(){const pending=pendingDraft.current;if(!pending)throw Error('Ursprüngliche bestätigte Schreibanfrage fehlt. Der Formularstand bleibt erhalten.');assertCurrentReadContext(pending.context);const ticket=currentReadTicket();const loaded=await fetchCareAssessment(pending.context.tenantId,pending.context.assessmentId,pending.context.subjectType,pending.context.roleKey as NonNullable<typeof profile>['roleKey']);assertCurrentReadContext(pending.context);if(!loaded.ok)throw Error(loaded.error);assertAssessmentDraftStoredRead(pending.request,{assessmentId:loaded.data.id,draftRevision:loaded.data.draftRevision,status:loaded.data.status});const current=workspaceState.current;if(!sameDraftContext(pending.context,current.context)||!sameWoundJson(current.value,pending.editable)||!sameWoundJson(current.baseline,pending.baseline))throw Error('Ursprünglicher Schreib- oder Formularbezug inzwischen geändert. Bestätigten Stand gesondert laden.');acceptConfirmed(loaded.data,pending.context,ticket,pending.provenance);}
  const submission=useMedicationSubmission<AssessmentDraftRequest>(dirty||instrumentState.dirty||planState.dirty,async(requestId,payload,replay)=>{
    const current=workspaceState.current;
    if(!current.canReadPlan||!navigationAlive.current||!tenantId||payload.assessmentId!==current.context.assessmentId)return {ok:false,error:'Der Aktenbezug hat sich geändert.',uncertain:replay};
    if(pendingDraft.current?.requestId!==requestId){if(replay)return {ok:false,error:'Der ursprüngliche Lesestand der ungewissen Schreibanfrage fehlt.',uncertain:true};if(current.writeLocked||!current.value)return {ok:false,error:'Aktuellen gespeicherten Bearbeitungsstand zuerst bestätigen.'};try{const provenance=captureOriginalRead();pendingDraft.current={request:structuredClone(payload),context:structuredClone(current.context),baseline:current.baseline?structuredClone(current.baseline):null,editable:structuredClone(current.value),requestId,provenance};}catch(error){return {ok:false,error:error instanceof Error?error.message:'Ursprünglichen Lesestand prüfen.'};}}
    if(!sameDraftContext(pendingDraft.current.context,current.context))return {ok:false,error:'Der ursprüngliche Benutzer- oder Pflegefallbezug hat sich geändert.',uncertain:replay};
    intentRef.current=payload.intent;
    return writeAmbulatoryAssessmentRequest(current.context.tenantId,requestId,payload,profile?.roleKey);
  },async()=>{
    setNeedsReload(true);await reloadConfirmedDraft();
    setInstrumentState({packet:null,issue:'Instrumenten- und Modellbestand nach dem Speichern erneut vollständig laden.',dirty:false,loading:true});setInstrumentGeneration(current=>current+1);
    setPlanState({packet:null,issue:'Planlebenszyklus nach dem Speichern erneut vollständig laden.',dirty:false,loading:true});setPlanGeneration(current=>current+1);
    setMessage(intentRef.current==='review'?'Gespeichert und zur fachlichen Prüfung übergeben.':'Zwischenstand gespeichert.');
  });
  const pending=busy||submission.locked||needsReload||lifecycleBusy||lifecyclePending.current;
  const completeness = useMemo(() => value ? calculateCareAssessmentCompleteness(value) : null, [value]);
  const locked = !canManage || busy || (!resident && (submission.locked || needsReload || lifecycleBusy || readState.data.writeBlocked || !!readState.error || value?.status==='professional_review')) || ['approved', 'superseded', 'archived'].includes(value?.status ?? '');
  const evaluationLocked = !canManage || busy || (!resident && (submission.locked || needsReload || lifecycleBusy || readState.data.writeBlocked || !!readState.error || dirty || value?.status==='professional_review')) || ['superseded', 'archived'].includes(value?.status ?? '');
  workspaceState.current={context:draftContext,baseline,value,persisted,envelope:queryEnvelope,readBlocked:readBlocked||!!readState.error,canReadPlan,writeLocked:locked,pending};
  useEffect(()=>{if(resident){if(queryAssessment)setValue(queryAssessment);return;}const current=workspaceState.current;if(current.readBlocked||!readBoundary.current||!isCurrentCareAssessmentReadEnvelope(readBoundary.current,current.envelope))return;try{const adopted=adoptCareAssessmentDraftRead(current.baseline,current.value,current.persisted,current.context,current.pending||lifecyclePending.current);if(adopted&&(!current.value||!current.baseline||!sameWoundJson(current.baseline.assessment,adopted.baseline.assessment))){setBaseline(adopted.baseline);setValue(adopted.value);}}catch(error){setMessage(error instanceof Error?error.message:'Gespeicherten Formularbezug prüfen.');}},[resident,query.data,readBlocked,pending]);
  function sameDraftContext(a:CareAssessmentDraftContext,b:CareAssessmentDraftContext){return a.tenantId===b.tenantId&&a.profileId===b.profileId&&a.roleKey===b.roleKey&&a.assessmentId===b.assessmentId&&a.subjectType===b.subjectType&&a.subjectId===b.subjectId;}
  function assertCurrentReadContext(captured:CareAssessmentDraftContext){assertCareAssessmentRuntimeReadAccess({canRead:workspaceState.current.canReadPlan,canManage:false});if(!navigationAlive.current||!sameDraftContext(captured,workspaceState.current.context))throw Error('Der ursprüngliche Lesekontext hat sich geändert.');}
  function currentReadTicket(){const boundary=readBoundary.current;if(!boundary)throw Error('Aktuellen Pflegeplan-Lesekontext zuerst bestätigen.');return beginCareAssessmentRead(boundary);}
  function captureOriginalRead(){const current=workspaceState.current;assertCurrentReadContext(current.context);const boundary=readBoundary.current;if(!boundary||!current.persisted||!sameWoundJson(boundary.saved,current.persisted)||!current.baseline||!sameWoundJson(current.baseline.assessment,current.persisted))throw Error('Den vollständig gesicherten ursprünglichen Lesestand vor einer neuen Schreibanfrage bestätigen.');return captureCareAssessmentPendingRead(boundary);}
  function beginAmendmentRead(_requestId:string,target:import('@/lib/careAssessment/planEvaluationDomain').EvaluationPlan){const provenance=captureOriginalRead(),saved=provenance.saved;if(target.tenantId!==saved.tenantId||target.assessmentId!==saved.id||target.clientId!==saved.subjectId||target.version!==saved.version||target.draftRevision!==saved.draftRevision||target.updatedAt!==saved.updatedAt)throw Error('Ursprünglichen gesicherten Änderungsstand erneut bestätigen.');return provenance;}
  async function readPlanReload(){const captured=workspaceState.current.context;assertCurrentReadContext(captured);await query.refresh();assertCurrentReadContext(captured);}
  async function reloadReturnedPlan(payload:AssessmentLifecycleRequest,captured:CareAssessmentDraftContext,capturedBaseline:CareAssessmentDraftBaseline|null,capturedValue:CareAssessment,provenance:CareAssessmentPendingRead){assertCurrentReadContext(captured);const ticket=currentReadTicket();const loaded=await fetchCareAssessment(captured.tenantId,captured.assessmentId,captured.subjectType,captured.roleKey as NonNullable<typeof profile>['roleKey']);assertCurrentReadContext(captured);if(!loaded.ok)throw Error(loaded.error);assertAssessmentLifecycleReceipt(payload,{assessmentId:loaded.data.id,subjectId:loaded.data.subjectId,action:'return',draftRevision:loaded.data.draftRevision,version:loaded.data.version,status:loaded.data.status});const current=workspaceState.current;if(!sameWoundJson(current.baseline,capturedBaseline)||!sameWoundJson(current.value,capturedValue))throw Error('Ursprünglicher Rückgabe- oder Formularbezug inzwischen geändert. Bestätigten Stand gesondert laden.');acceptConfirmed(loaded.data,captured,ticket,provenance);}
  async function reloadAmendedPlan(target:import('@/lib/careAssessment/planEvaluationDomain').EvaluationPlan,captured:CareAssessmentDraftContext,provenance:CareAssessmentPendingRead){assertCurrentReadContext(captured);const ticket=currentReadTicket();if(!sameDraftContext(captured,workspaceState.current.context)||target.tenantId!==captured.tenantId||target.assessmentId!==captured.assessmentId||target.clientId!==captured.subjectId)throw Error('Ursprünglichen Maßnahmenänderungsbezug prüfen.');const loaded=await fetchCareAssessment(captured.tenantId,captured.assessmentId,captured.subjectType,captured.roleKey as NonNullable<typeof profile>['roleKey']);assertCurrentReadContext(captured);if(!loaded.ok)throw Error(loaded.error);const current=workspaceState.current;if(!navigationAlive.current||!sameDraftContext(captured,current.context)||loaded.data.tenantId!==captured.tenantId||loaded.data.id!==captured.assessmentId||loaded.data.subjectId!==captured.subjectId||loaded.data.subjectType!==captured.subjectType||!Number.isSafeInteger(loaded.data.draftRevision)||Number(loaded.data.draftRevision)<=target.draftRevision||loaded.data.version!==target.version)throw Error('Frisch bestätigten passenden Änderungsstand erneut laden.');const boundary=readBoundary.current;if(!boundary)throw Error('Aktuellen Pflegeplan-Lesestand erneut bestätigen.');const published=acceptCareAssessmentConfirmedRead(boundary,ticket,provenance,loaded.data,current.context);readBoundary.current=published.boundary;query.setData(published.envelope);const adopted=adoptCareAssessmentDraftRead(current.baseline,current.value,loaded.data,current.context,current.pending||lifecyclePending.current);if(adopted){setBaseline(adopted.baseline);setValue(adopted.value);}}
  const navigationContext=`${tenantId}:${profile?.id}:${profile?.roleKey}:${subjectType}:${id}:${value?.subjectId}`;
  const navigationState=useRef({context:navigationContext,section,resident,busy,storageLocked:submission.locked,queryBlocked:query.loading||query.refreshing||!!query.error||!!query.refreshError});
  navigationState.current={context:navigationContext,section,resident,busy,storageLocked:submission.locked,queryBlocked:query.loading||query.refreshing||!!query.error||!!query.refreshError};
  async function changeSection(next:Section){const before=navigationState.current;if(next===before.section)return;if(before.section!=='evaluation'||before.resident){setSection(next);return;}const confirm=evaluationLeave.current;if(before.busy||before.storageLocked||!await confirm())return;const current=navigationState.current;if(!navigationAlive.current||current.context!==before.context||current.section!==before.section||current.resident!==before.resident||evaluationLeave.current!==confirm||current.busy||current.storageLocked||current.queryBlocked!==before.queryBlocked)return;setSection(next);}
  const patch = (next: Partial<CareAssessment>) => {if(!resident&&workspaceState.current.writeLocked)return;setValue((current) => current ? ({ ...current, ...next }) : current);};
  const patchTopic = (key: CareAssessmentTopicKey, field: string, next: string) => {if(!resident&&workspaceState.current.writeLocked)return;setValue((current) => current ? ({
    ...current,
    topics: current.topics.map((item) => item.topicKey === key ? ({ ...item, [field]: next }) : item),
  }) : current);};
  const patchRisk = (index: number, next: Partial<CareAssessmentRisk>) => {if(!resident&&workspaceState.current.writeLocked)return;setValue((current) => current ? ({
    ...current,
    risks: current.risks.map((item, i) => i === index ? ({ ...item, ...next }) : item),
  }) : current);};
  const patchMeasure = (index: number, next: Partial<CareAssessmentMeasure>) => {if(!resident&&workspaceState.current.writeLocked)return;setValue((current) => current ? ({
    ...current,
    measures: current.measures.map((item, i) => i === index ? ({ ...item, ...next }) : item),
  }) : current);};
  function addRisk() {
    if (!value) return;
    const item = CARE_RISK_CATALOG.find((candidate) => !value.risks.some((risk) => risk.riskKey === candidate.key)) ?? CARE_RISK_CATALOG[0];
    patch({ risks: [...value.risks, {
      riskKey: item.key, state: 'unclear', urgency: 'timely', evidence: '', protectiveFactors: '',
      professionalRationale: '', counselingProvided: '', personDecision: '', refusalDocumented: false,
      focusedAssessmentKey: item.focusedAssessment, focusedAssessmentResult: {}, linkedBodyMapMarkerIds: [],
      nextReviewAt: resident ? inDays(30) : null,
    }] });
  }
  function addMeasure() {
    if (!value) return;
    const risk = resident ? value.risks.find((item) => item.state === 'present' || item.state === 'unclear') : undefined;
    patch({ measures: [...value.measures, {
      title: risk ? `Maßnahme: ${getRiskLabel(risk.riskKey)}` : 'Neue Pflegemaßnahme',
      relatedTopicKey: null, relatedRiskKey: risk?.riskKey ?? null, personalGoal: '', intervention: '',
      timing: '', frequency: '', responsibleRole: resident ? 'Pflegefachperson' : '', personContribution: '',
      relativesContribution: '', warningSigns: '', escalationPath: '', evaluationCriteria: '',
      nextEvaluationAt: resident ? inDays(30) : null, status: 'planned',
    }] });
  }
  async function save(nextStatus?: 'professional_review' | 'approved') {
    if (!value || !tenantId || locked) return;
    const check = calculateCareAssessmentCompleteness(value);
    if (nextStatus && !(nextStatus === 'approved' ? check.canApprove : check.canSubmitForReview)) { setMessage('Fachliche Prüfung erst nach Behebung der angezeigten offenen Angaben möglich.'); return; }
    if (value.subjectType === 'client' && nextStatus === 'approved') { setMessage('Fachliche Freigabe bleibt bis zum Nachweis von Qualifikation und serverseitiger Prüfung gesperrt.'); return; }
    if(!resident){
      const current=workspaceState.current;if(current.writeLocked||!current.value)return;
      const packetIssue=instrumentState.loading?'Instrumenten- und Modellbestand wird noch geladen.':assessmentInstrumentPacketIssue(instrumentState.packet,current.value.risks.map(item=>item.riskKey),nextStatus==='professional_review')??instrumentState.issue;
      if(packetIssue){setMessage(packetIssue);return;}
      const planIssue=planState.loading?'Planlebenszyklus wird noch geladen.':planLifecyclePacketIssue(planState.packet,current.value.measures,nextStatus==='professional_review')??planState.issue;
      if(planIssue){setMessage(planIssue);return;}
      if(nextStatus==='professional_review'&&!calculateCareAssessmentCompleteness(current.value).canSubmitForReview){setMessage('Fachliche Prüfung erst nach Behebung der angezeigten offenen Angaben möglich.');return;}
      setMessage(null);
      try{await submission.submit(makeAssessmentDraftRequest(current.value,nextStatus==='professional_review'?'review':'save',instrumentState.packet,planState.packet));}
      catch(error){setMessage(error instanceof Error?error.message:'Assessmentangaben prüfen.');}
      return;
    }
    setBusy(true); setMessage(null);
    const saved = await saveCareAssessment(tenantId, value, profile?.roleKey);
    if (!saved.ok) { setBusy(false); return setMessage(saved.error); }
    if (!nextStatus) { setBusy(false); setValue(saved.data); return setMessage('Zwischenstand gespeichert.'); }
    const transitioned = await transitionCareAssessment(tenantId, saved.data, nextStatus, profile?.displayName ?? '', profile?.roleKey);
    setBusy(false);
    if (!transitioned.ok) return setMessage(transitioned.error);
    setValue(transitioned.data);
    setMessage(nextStatus === 'approved' ? 'Fachlich freigegeben und versioniert.' : 'Zur fachlichen Prüfung übergeben.');
  }
  async function addEvaluation() {
    if (!value || !tenantId || evaluationLocked || !evaluationOutcome || !professionalConclusion.trim() || (!resident && (!observedEffect.trim() || !personFeedback.trim()))) return;
    setBusy(true); setMessage(null);
    const result = await addCareAssessmentEvaluation(tenantId, value, {
      outcome: evaluationOutcome,
      observedEffect,
      personFeedback,
      professionalConclusion,
      changesRequired,
      evaluatedAt: new Date().toISOString(),
      evaluatorName: profile?.displayName ?? '',
    }, profile?.roleKey);
    setBusy(false);
    if (!result.ok) return setMessage(result.error);
    query.setData(result.data);setValue(result.data);
    setEvaluationOutcome(resident?'effective':''); setObservedEffect(''); setPersonFeedback(''); setProfessionalConclusion(''); setChangesRequired('');
    setMessage('Evaluation gespeichert.');
  }
  if (!resident&&!canReadPlan&&!value) return <ScreenShell title="Pflegeassessment"><ErrorState message="Pflegeplan-Leserecht für den gespeicherten Pflegefall erforderlich." /></ScreenShell>;
  if (query.loading && !value) return <ScreenShell title="Pflegeassessment"><LoadingState message="Pflegeprozess wird geladen…" /></ScreenShell>;
  if (query.error && !value) return <ScreenShell title="Pflegeassessment"><ErrorState message={query.error} onRetry={query.refresh} /></ScreenShell>;
  if (!value || !completeness) return null;
  const bodyMap = resident ? `/stationaer/bewohner/${value.subjectId}/bodymap` : `/pflege/bodymap?clientId=${value.subjectId}`;
  const topicLabel = (key: CareAssessmentTopicKey) => {
    if (key === 'living_environment') return resident ? 'Wohnen und Häuslichkeit' : 'Haushaltsführung';
    return CARE_ASSESSMENT_TOPIC_LABELS[key];
  };
  const assessmentBody=(<>
      {value.reassessmentRequired ? <InfoBanner variant="danger" title="Neubewertung erforderlich" message={value.destabilizationSummary || 'Relevantes Ereignis vorhanden.'} /> : null}
      {locked ? <InfoBanner variant="info" title="Bearbeitung gesperrt" message="Rechte, Bearbeitungsstatus oder eine laufende Speicherprüfung verhindern Änderungen. Übergebene Assessments benötigen einen gesonderten Rückgabe- oder Fortschreibungsablauf." /> : null}
      {message ? <InfoBanner variant="info" title="Status" message={message} /> : null}

      {!resident&&staleEnvelope?<ErrorState message="Diese frühere Leseantwort wurde bereits durch einen anderen bestätigten Planstand abgelöst. Gespeicherten Pflegeplan erneut laden; lokale Eingaben bleiben erhalten." onRetry={readPlanReload}/>:null}
      {!resident&&readState.error?<InfoBanner variant="warning" message={readState.error}/>:null}
      {!resident&&(query.error||query.refreshError)?<InfoBanner variant="warning" message={query.refreshError??query.error!}/>:null}
      {!resident&&readState.data.diverged?<InfoBanner variant="warning" message="Der gespeicherte Planstand wurde geändert. Ihre lokalen Eingaben bleiben mit ihrer ursprünglichen Formularfassung erhalten. Neue Schreibaktionen bleiben bis zum erneuten Öffnen einer bestätigten Bearbeitungsfassung gesperrt; die Evaluation zeigt den getrennten gespeicherten Lesestand."/>:null}
      {!resident&&section==='evaluation'?<InfoBanner variant="info" message="Diese Originalübersicht verwendet ausschließlich den gespeicherten Planstand. Lokale Planeingaben und ungewisse Schreibanfragen werden durch eine Leseaktualisierung nicht übernommen oder verworfen."/>:null}
      {!resident && submission.error ? <InfoBanner variant="warning" title="Speicherprüfung" message={submission.error} /> : null}
      {!resident && submission.uncertain ? <View style={{gap:spacing.md}}><InfoBanner variant="warning" title="Speicherstand unklar" message="Der Server kann bereits gespeichert haben. Änderungen bleiben gesperrt; dieselbe Anfrage wird erneut geprüft." /><PremiumButton title="Dieselbe Anfrage erneut prüfen" loading={submission.busy} disabled={submission.busy} onPress={submission.retry} /></View> : null}
      {!resident && needsReload ? <View style={{gap:spacing.md}}><InfoBanner variant="warning" title="Gespeicherten Stand laden" message="Die Schreibanfrage ist bestätigt. Vor weiteren Änderungen muss der aktuelle Datensatz geladen werden." /><PremiumButton title="Aktuellen Stand laden" disabled={submission.locked} onPress={async()=>{try{await reloadConfirmedDraft();submission.setError(null);}catch(error){setMessage(error instanceof Error?error.message:'Bestätigten ursprünglichen Stand erneut laden.');}}} /></View> : null}

      {!resident&&value.status==='professional_review' ? <ReturnAssessmentForm key={`${value.id}:${value.draftRevision}`} value={value} baseline={baseline} canManage={canManage} canRead={canReadPlan} onWriteBegin={captureOriginalRead} startBlocked={readBlocked||!!readState.error||!baseline||dirty||readState.data.diverged||busy||submission.locked||needsReload} tenantId={tenantId??''} role={profile?.roleKey} context={draftContext} onPendingChange={changeLifecyclePending} onConfirmed={async(payload,captured,capturedBaseline,capturedValue,provenance)=>{await reloadReturnedPlan(payload,captured,capturedBaseline,capturedValue,provenance);setMessage('Zur Bearbeitung zurückgegeben. Bisherige Prüffassung bleibt im Verlauf erhalten.');}} /> : null}

      <View style={styles.focusHero}>
        <View style={styles.focusHeroCopy}>
          {!resident ? <InfoBanner variant="warning" title="CareSuite-Pflegeassessment" message="Die Abbildung des EinSTEP-Strukturmodells und die fachliche Freigabe sind noch in Prüfung. Die Prozentanzeige bewertet ausschließlich technische Vollständigkeit und ersetzt keine fachliche Beurteilung." /> : null}
          <Text style={styles.eyebrow}>{resident ? 'STATIONÄRES PFLEGEASSESSMENT' : 'AMBULANTES PFLEGEASSESSMENT'}</Text>
          <Text style={styles.focusTitle}>{value.subjectName}</Text>
          <Text style={styles.focusMeta}>
            Version {value.version} · {value.assessorName || 'Pflegefachperson offen'} · {completeness.percent} % technisch vollständig
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completeness.percent}%` }]} />
        </View>
        <View style={styles.focusMetrics}>
          <View style={styles.metric}><Text style={styles.metricValue}>{value.risks.filter((risk) => risk.state === 'present').length}</Text><Text style={styles.metricLabel}>aktive Risiken</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{value.measures.filter((measure) => ['planned', 'active'].includes(measure.status)).length}</Text><Text style={styles.metricLabel}>Maßnahmen</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{completeness.blocking.length}</Text><Text style={styles.metricLabel}>Freigabesperren</Text></View>
        </View>
      </View>

      <View style={[styles.workspaceGrid, compact && styles.workspaceGridCompact]}>
        <ScrollView
          horizontal={compact}
          showsHorizontalScrollIndicator={false}
          style={[styles.sectionRail, compact && styles.sectionRailCompact]}
          contentContainerStyle={compact ? styles.sectionRailContentCompact : undefined}
        >
          {sections.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: section === item.key }}
              onPress={() => changeSection(item.key)}
              style={[styles.navItem, section === item.key && styles.navItemActive]}
            >
              <Text style={[styles.navNumber, section === item.key && styles.navNumberActive]}>{item.short}</Text>
              <Text style={[styles.navLabel, section === item.key && styles.navLabelActive]}>{item.label}</Text>
            </Pressable>
          ))}
          {!compact ? (
            <View style={styles.legalNote}>
              <Text style={styles.legalNoteTitle}>Fachbereich Pflege</Text>
              <Text style={styles.legalNoteText}>Eigenständiger Pflegefall · keine Assist-Übernahme · Pflegefachfreigabe erforderlich.</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.documentCanvas}>

      {section === 'person' ? (
        <SectionPanel title="Was bewegt Sie im Augenblick?" subtitle="Originalton getrennt von der Fachperspektive">
          <FilterChipGroup
            wrap
            options={[
              { key: 'person', label: 'Person selbst' }, { key: 'relative', label: 'An-/Zugehörige' },
              { key: 'representative', label: 'Vertretung' }, { key: 'professional', label: 'Fachperson' },
              { key: 'not_possible', label: 'Aussage nicht möglich' },
            ]}
            value={value.statementSource}
            onChange={(next) => { if (!locked) patch({ statementSource: next }); }}
          />
          <PremiumInput label="Originalton / geäußerte Sichtweise" value={value.personStatement} onChangeText={(next) => patch({ personStatement: next })} multiline editable={!locked} />
          <PremiumInput label="Quelle beziehungsweise Name" value={value.statementSourceName} onChangeText={(next) => patch({ statementSourceName: next })} editable={!locked} />
          <PremiumInput label="Gesprächsbeteiligte" value={value.conversationParticipants.join(', ')} onChangeText={(next) => patch({ conversationParticipants: next.split(',').map((item) => item.trim()).filter(Boolean) })} editable={!locked} />
          <PremiumInput label="Kommunikationsunterstützung" value={value.communicationSupport} onChangeText={(next) => patch({ communicationSupport: next })} multiline editable={!locked} />
          <PremiumInput label="Informationsquellen und offene Rückfragen" value={value.informationSourceSummary} onChangeText={(next) => patch({ informationSourceSummary: next })} multiline editable={!locked} />
        </SectionPanel>
      ) : null}

      {section === 'topics' ? value.topics.map((item, index) => (
        <SectionPanel key={item.topicKey} title={`${index + 1}. ${topicLabel(item.topicKey)}`}>
          <PremiumInput label="Perspektive der Person" value={item.personPerspective} onChangeText={(next) => patchTopic(item.topicKey, 'personPerspective', next)} multiline editable={!locked} />
          <PremiumInput label="Ressourcen und Fähigkeiten" value={item.resources} onChangeText={(next) => patchTopic(item.topicKey, 'resources', next)} multiline editable={!locked} />
          <PremiumInput label="Beeinträchtigungen und Belastungen" value={item.impairments} onChangeText={(next) => patchTopic(item.topicKey, 'impairments', next)} multiline editable={!locked} />
          <PremiumInput label="Wünsche, Ziele und Prioritäten" value={item.wishes} onChangeText={(next) => patchTopic(item.topicKey, 'wishes', next)} multiline editable={!locked} />
          <PremiumInput label="Gewohnheiten und Biografie" value={item.habitsBiography} onChangeText={(next) => patchTopic(item.topicKey, 'habitsBiography', next)} multiline editable={!locked} />
          <PremiumInput label="Pflegefachliche Einschätzung" value={item.professionalAssessment} onChangeText={(next) => patchTopic(item.topicKey, 'professionalAssessment', next)} multiline editable={!locked} />
          <PremiumInput label="Handlungs- oder Assessmentbedarf" value={item.actionNeeded} onChangeText={(next) => patchTopic(item.topicKey, 'actionNeeded', next)} multiline editable={!locked} />
        </SectionPanel>
      )) : null}

      {section === 'mental' ? (!resident&&mentalAccess?<MentalHealthCarePathPanel tenantId={draftContext.tenantId} clientId={draftContext.subjectId} assessmentId={draftContext.assessmentId} actorId={draftContext.profileId} canRead={mentalAccess.canRead&&!readBlocked} canWrite={mentalAccess.canWrite&&!locked} canRelease={mentalAccess.canRelease&&!locked} canReview={mentalAccess.canReview&&!locked}/>:<InfoBanner variant="warning" message="Der geschützte psychosoziale Gesamtweg ist nur im ambulanten Pflegefall mit aktuellen Plan-, Risiko- und Sensitivitätsrechten verfügbar."/>) : null}

      {section === 'palliative' ? (!resident&&palliativeAccess?<PalliativeSpecialCarePathPanel tenantId={draftContext.tenantId} clientId={draftContext.subjectId} assessmentId={draftContext.assessmentId} actorId={draftContext.profileId} canRead={palliativeAccess.canRead&&!readBlocked} canWrite={palliativeAccess.canWrite&&!locked} canRelease={palliativeAccess.canRelease&&!locked} canReview={palliativeAccess.canReview&&!locked}/>:<InfoBanner variant="warning" message="Der Palliativ- und Spezialversorgungsweg ist nur im ambulanten Pflegefall mit aktuellen Plan-, Anordnungs-, Dokumenten-, Sensitivitäts- und Audit-Rechten verfügbar."/>) : null}

      {section === 'coordination' ? (!resident&&coordinationAccess?<CounselingCoordinationPathPanel tenantId={draftContext.tenantId} clientId={draftContext.subjectId} assessmentId={draftContext.assessmentId} actorId={draftContext.profileId} canRead={coordinationAccess.canRead&&!readBlocked} canWrite={coordinationAccess.canWrite&&!locked} canRelease={coordinationAccess.canRelease&&!locked} canReview={coordinationAccess.canReview&&!locked}/>:<InfoBanner variant="warning" message="Der Beratungs- und Koordinationsweg ist nur im ambulanten Pflegefall mit aktuellen Assessment-, Beratungs-, Termin-, Dokument-, Kommunikations-, Sensitivitäts- und Audit-Rechten verfügbar."/>) : null}

      {section === 'risks' ? (
        <SectionPanel title="Dynamische Risikoeinschätzungen">
          <View style={{gap:spacing.md}}>
            <PremiumButton title="+ Risiko / Phänomen" disabled={locked} onPress={addRisk} />
            <PremiumButton title="3D-BodyMap öffnen" variant="secondary" onPress={() => router.push(bodyMap as never)} />
          </View>
          {value.risks.map((item, index) => (
            <View key={`${item.riskKey}-${index}`} style={styles.card}>
              <Text style={styles.title}>{getRiskLabel(item.riskKey)}</Text>
              <FilterChipGroup wrap options={[
                { key: 'none', label: 'Kein Risiko' }, { key: 'unclear', label: 'Unklar' },
                { key: 'present', label: 'Vorhanden' }, { key: 'controlled', label: 'Kontrolliert' },
              ]} value={item.state} onChange={(next) => { if (!locked) patchRisk(index, { state: next }); }} />
              <Text style={styles.fieldCaption}>Dringlichkeit</Text>
              <FilterChipGroup wrap options={[
                { key: 'routine', label: 'Regulär' }, { key: 'timely', label: 'Zeitnah' },
                { key: 'urgent', label: 'Dringend' }, { key: 'immediate', label: 'Sofort' },
              ]} value={item.urgency} onChange={(next) => { if (!locked) patchRisk(index, { urgency: next }); }} />
              <PremiumInput label="Beobachtungen / Hinweise" value={item.evidence} onChangeText={(next) => patchRisk(index, { evidence: next })} multiline editable={!locked} />
              <PremiumInput label="Schutzfaktoren und Ressourcen" value={item.protectiveFactors} onChangeText={(next) => patchRisk(index, { protectiveFactors: next })} multiline editable={!locked} />
              <PremiumInput label="Pflegefachliche Begründung" value={item.professionalRationale} onChangeText={(next) => patchRisk(index, { professionalRationale: next })} multiline editable={!locked} />
              <PremiumInput label="Aufklärung und Beratung" value={item.counselingProvided} onChangeText={(next) => patchRisk(index, { counselingProvided: next })} multiline editable={!locked} />
              <PremiumInput label="Entscheidung der Person" value={item.personDecision} onChangeText={(next) => patchRisk(index, { personDecision: next })} multiline editable={!locked} />
              <PremiumInput label="Nächste fachliche Prüfung (ISO-Datum)" value={item.nextReviewAt ?? ''} onChangeText={(next) => patchRisk(index, { nextReviewAt: next || null })} editable={!locked} />
              {!resident && item.riskKey==='continence'?<ContinenceProfilePanel risk={item} locked={locked} onChange={next=>patchRisk(index,next)}/>:null}
              {!locked ? <PremiumButton title="Risiko entfernen" variant="ghost" onPress={() => patch({ risks: value.risks.filter((_, i) => i !== index) })} /> : null}
            </View>
          ))}
        </SectionPanel>
      ) : null}

      {section === 'measures' ? (
        <SectionPanel title="Individuelle Maßnahmenplanung">
          <PremiumButton title="+ Maßnahme" disabled={locked} onPress={addMeasure} />
          {value.measures.map((item, index) => (
            <View key={item.id??index} style={styles.card}>
              <PremiumInput label="Bezeichnung" value={item.title} onChangeText={(next) => patchMeasure(index, { title: next })} editable={!locked} />
              {!resident?<><Text style={styles.fieldCaption}>Tatsächlichen Risikobezug auswählen</Text><FilterChipGroup wrap options={[{key:'',label:'Kein Risikobezug'},...Array.from(new Set(value.risks.map(r=>r.riskKey))).map(key=>({key,label:getRiskLabel(key)}))]} value={item.relatedRiskKey??''} onChange={locked?undefined:next=>patchMeasure(index,{relatedRiskKey:next||null})}/><Text style={styles.fieldCaption}>Tatsächliches Themenfeld auswählen</Text><FilterChipGroup wrap options={[{key:'',label:'Kein Themenfeld'},...Array.from(new Set(value.topics.map(t=>t.topicKey))).map(key=>({key,label:topicLabel(key)}))]} value={item.relatedTopicKey??''} onChange={locked?undefined:next=>patchMeasure(index,{relatedTopicKey:(next||null) as CareAssessmentTopicKey|null})}/></>:null}
              <PremiumInput label="Persönliches Ziel" value={item.personalGoal} onChangeText={(next) => patchMeasure(index, { personalGoal: next })} multiline editable={!locked} />
              <PremiumInput label="Konkrete Durchführung" value={item.intervention} onChangeText={(next) => patchMeasure(index, { intervention: next })} multiline editable={!locked} />
              <PremiumInput label="Zeitpunkt / Situation" value={item.timing} onChangeText={(next) => patchMeasure(index, { timing: next })} editable={!locked} />
              <PremiumInput label="Häufigkeit" value={item.frequency} onChangeText={(next) => patchMeasure(index, { frequency: next })} editable={!locked} />
              <PremiumInput label="Verantwortliche Rolle" value={item.responsibleRole} onChangeText={(next) => patchMeasure(index, { responsibleRole: next })} editable={!locked} />
              <PremiumInput label="Mitwirkung der Person" value={item.personContribution} onChangeText={(next) => patchMeasure(index, { personContribution: next })} multiline editable={!locked} />
              <PremiumInput label="Mitwirkung von An- und Zugehörigen" value={item.relativesContribution} onChangeText={(next) => patchMeasure(index, { relativesContribution: next })} multiline editable={!locked} />
              <PremiumInput label="Warn- und Abbruchkriterien" value={item.warningSigns} onChangeText={(next) => patchMeasure(index, { warningSigns: next })} multiline editable={!locked} />
              <PremiumInput label="Eskalationsweg" value={item.escalationPath} onChangeText={(next) => patchMeasure(index, { escalationPath: next })} multiline editable={!locked} />
              <PremiumInput label="Woran erkennen wir Wirkung?" value={item.evaluationCriteria} onChangeText={(next) => patchMeasure(index, { evaluationCriteria: next })} multiline editable={!locked} />
              <PremiumInput label="Nächste Evaluation (ISO-Datum)" value={item.nextEvaluationAt ?? ''} onChangeText={(next) => patchMeasure(index, { nextEvaluationAt: next || null })} editable={!locked} />
              {!locked ? <PremiumButton title="Maßnahme entfernen" variant="ghost" onPress={() => patch({ measures: value.measures.filter((_, i) => i !== index) })} /> : null}
            </View>
          ))}
        </SectionPanel>
      ) : null}

      {section === 'quality' ? (
        <>
          {!resident?<AssessmentInstrumentPanel key={`${draftContext.tenantId}:${draftContext.assessmentId}:${draftContext.subjectId}:${draftContext.profileId}:${instrumentGeneration}`} tenantId={draftContext.tenantId} assessmentId={draftContext.assessmentId} subjectId={draftContext.subjectId} actorId={draftContext.profileId} role={profile?.roleKey??null} riskKeys={value.risks.map(item=>item.riskKey)} editable={!locked} reviewRequested={false} onState={setInstrumentState}/>:null}
          {!resident?<PlanLifecyclePanel key={`${draftContext.tenantId}:${draftContext.assessmentId}:${draftContext.subjectId}:${draftContext.profileId}:${planGeneration}`} tenantId={draftContext.tenantId} assessmentId={draftContext.assessmentId} subjectId={draftContext.subjectId} actorId={draftContext.profileId} role={profile?.roleKey??null} measures={value.measures} topicKeys={value.topics.map(item=>item.topicKey)} editable={!locked} reviewRequested={false} onState={setPlanState}/>:null}
          <SectionPanel title="Pflegefachliche Gesamteinschätzung">
            <PremiumInput label="Gesamtsituation, Ressourcen, Risiken und Prioritäten" value={value.professionalSummary} onChangeText={(next) => patch({ professionalSummary: next })} multiline editable={!locked} />
            <PremiumInput label="Veränderung seit der letzten Version" value={value.changeSummary} onChangeText={(next) => patch({ changeSummary: next })} multiline editable={!locked} />
            <PremiumInput label="Nächster Prüftermin (ISO-Datum)" value={value.nextReviewAt ?? ''} onChangeText={(next) => patch({ nextReviewAt: next || null })} editable={!locked} />
          </SectionPanel>
          <SectionPanel title="Vollständigkeit und fachliche Prüfung" subtitle={`${completeness.percent} % technisch vollständig`}>
            {QPR_2026_CHECKS.map((check) => <Text key={check} style={styles.check}>• {check}</Text>)}
            {completeness.blocking.map((item) => <InfoBanner key={item} variant="danger" title="Freigabesperre" message={item} />)}
            {completeness.warnings.map((item) => <InfoBanner key={item} variant="warning" title="Prüfhinweis" message={item} />)}
          </SectionPanel>
          <View style={{gap:spacing.md}}>
            <PremiumButton title={resident?"Assessment speichern":"Entwurf, Instrumente und Pflegeplan speichern"} disabled={locked || busy || (!resident&&(instrumentState.loading||planState.loading||!!instrumentState.issue||!!planState.issue))} loading={busy} onPress={() => save()} />
            {value.status === 'professional_review' ? (
              <PremiumButton title={resident?"Fachlich freigeben":"Fachliche Freigabe noch gesperrt"} disabled={!resident || locked || busy || !completeness.canApprove} onPress={() => save('approved')} />
            ) : (
              <PremiumButton title="Zur fachlichen Prüfung" variant="secondary" disabled={locked || busy || !completeness.canSubmitForReview || (!resident&&(instrumentState.loading||planState.loading||!!assessmentInstrumentPacketIssue(instrumentState.packet,value.risks.map(item=>item.riskKey),true)||!!planLifecyclePacketIssue(planState.packet,value.measures,true)))} onPress={() => save('professional_review')} />
            )}
          </View>
        </>
      ) : null}

      {section === 'evaluation' ? (!resident?(panelAssessment?<PlanEvaluationPanel key={`${tenantId}:${profile?.id}:${profile?.roleKey}:${panelAssessment.id}:${panelAssessment.subjectId}`} assessment={panelAssessment} role={profile?.roleKey??null} readBlocked={readBlocked||!!readState.error} writeBlocked={evaluationLocked} registerLeave={fn=>{evaluationLeave.current=fn;}} onReadPlanReload={readPlanReload} onAmendmentWriteBegin={beginAmendmentRead} onPlanChanged={(target,provenance)=>reloadAmendedPlan(target,structuredClone(draftContext),provenance)}/>:<ErrorState message="Gespeicherten Planstand im aktuellen Pflegefall zuerst laden."/>):
        <>
          <SectionPanel title="Individuelle Evaluation" subtitle="Wirkung anhand der Ausgangssituation und der geplanten Maßnahmen bewerten">

            <Text style={styles.fieldCaption}>Ergebnis</Text>
            <FilterChipGroup wrap options={[
              { key: 'effective', label: 'Wirksam' },
              { key: 'partly_effective', label: 'Teilweise wirksam' },
              { key: 'not_effective', label: 'Nicht wirksam' },
              { key: 'deteriorated', label: 'Verschlechtert' },
              { key: 'not_assessable', label: 'Nicht beurteilbar' },
            ]} value={evaluationOutcome} onChange={resident?setEvaluationOutcome:evaluationLocked?undefined:setEvaluationOutcome} />
            <PremiumInput label={resident?"Beobachtete Wirkung":"Beobachtete Wirkung / konkrete Erhebungsgrenze"} value={observedEffect} onChangeText={setObservedEffect} multiline editable={!evaluationLocked} />
            <PremiumInput label={resident?"Rückmeldung der Person":"Rückmeldung der Person / konkreter Grund einer fehlenden Rückmeldung"} value={personFeedback} onChangeText={setPersonFeedback} multiline editable={!evaluationLocked} />
            <PremiumInput label="Pflegefachliche Schlussfolgerung" value={professionalConclusion} onChangeText={setProfessionalConclusion} multiline editable={!evaluationLocked} />
            <PremiumInput label="Erforderliche Anpassungen" value={changesRequired} onChangeText={setChangesRequired} multiline editable={!evaluationLocked} />
            <PremiumButton title="Evaluation dokumentieren" disabled={evaluationLocked || busy || !evaluationOutcome || !professionalConclusion.trim() || (!resident && (!observedEffect.trim() || !personFeedback.trim()))} loading={busy} onPress={addEvaluation} />
          </SectionPanel>
          <SectionPanel title="Bisherige Evaluationen" subtitle={`${value.evaluations.length} Eintrag/Einträge`}>
            {!value.evaluations.length ? <EmptyState title="Noch keine Evaluation" message="Evaluationen werden individuell und anlassbezogen dokumentiert." /> : value.evaluations.map((entry, index) => (
              <View key={entry.id || `${entry.evaluatedAt}-${index}`} style={styles.card}>
                <Text style={styles.title}>{entry.professionalConclusion}</Text>
                <Text style={styles.historyMeta}>{new Date(entry.evaluatedAt).toLocaleString('de-DE')} · {entry.evaluatorName || 'Pflegefachperson'}</Text>
                {entry.observedEffect ? <Text style={styles.historyText}>{entry.observedEffect}</Text> : null}
                {entry.changesRequired ? <InfoBanner variant="warning" title="Anpassung erforderlich" message={entry.changesRequired} /> : null}
              </View>
            ))}
          </SectionPanel>
        </>
      ) : null}

      {section === 'history' ? (
        <>
          {!resident ? <><AssessmentPathWorkspace assessmentId={draftContext.assessmentId} /><CarePlanPathWorkspace assessmentId={draftContext.assessmentId} /></> : null}
          <SectionPanel title="Versionsverlauf" subtitle="Freigaben und Statusübergänge bleiben unveränderbar nachvollziehbar">
            {!value.versionHistory.length ? <EmptyState title="Noch keine freigegebene Version" message="Beim Übergang zur fachlichen Prüfung und bei der Freigabe entsteht ein Snapshot." /> : value.versionHistory.map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <View style={styles.historyDot} />
                <View style={styles.historyCopy}>
                  <Text style={styles.historyTitle}>Version {entry.version} · {entry.transitionTo}</Text>
                  <Text style={styles.historyMeta}>{new Date(entry.createdAt).toLocaleString('de-DE')} · {entry.actorName || 'System'}</Text>
                </View>
              </View>
            ))}
          </SectionPanel>
          <SectionPanel title="Fachereignisse" subtitle="Anlassbezogene Veränderungen und Verknüpfungen">
            {!value.events.length ? <EmptyState title="Keine offenen Fachereignisse" message="Relevante Ereignisse erscheinen hier und können eine Fortschreibung auslösen." /> : value.events.map((entry, index) => (
              <Text key={String(entry.id ?? index)} style={styles.historyText}>• {String(entry.summary ?? entry.event_type ?? 'Fachereignis')}</Text>
            ))}
          </SectionPanel>
        </>
      ) : null}
      {!locked && section !== 'quality' ? <PremiumButton title="Zwischenstand speichern" loading={busy} onPress={() => save()} /> : null}
        </View>
      </View>
  </>);
  return <ScreenShell
    title={!resident&&!canReadPlan?'Pflegeassessment':`${value.subjectName} · Pflegeassessment`}
    subtitle={!resident&&!canReadPlan?undefined:`Version ${value.version} · ${completeness.percent} % technisch vollständig`}
    rightSlot={!resident&&!canReadPlan?undefined:<PremiumBadge label={value.status} variant={value.status==='approved'?'green':'cyan'} />}
  >{resident?assessmentBody:<>
    {!canReadPlan?<ErrorState message="Aktuelles Pflegeplan-Leserecht im eigenen Benutzer- und Mandantenbezug erforderlich. Angefangene Formulare und ursprüngliche Speicheranfragen bleiben erhalten."/>:null}
    <View style={[{gap:spacing.md},!canReadPlan?{display:'none'}:undefined]}>{assessmentBody}</View>
  </>}</ScreenShell>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.lg,
    padding: spacing.md, gap: spacing.sm, backgroundColor: 'rgba(255,255,255,0.88)',
  },
  title: { ...typography.h3 },
  check: { ...typography.body, color: colors.textMuted },
  focusHero: {
    borderWidth: 1,
    borderColor: 'rgba(69,160,255,0.38)',
    borderRadius: 26,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#168BFF',
    shadowOpacity: 0.22,
    shadowRadius: 28,
  },
  focusHeroCopy: { gap: 4 },
  eyebrow: { ...typography.caption, color: colors.cyan, letterSpacing: 1.2 },
  focusTitle: { ...typography.h1, color: colors.textPrimary },
  focusMeta: { ...typography.body, color: colors.textSecondary },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: 'rgba(151,188,235,0.16)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.cyan },
  focusMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { minWidth: 132, padding: spacing.sm, borderRadius: 16, backgroundColor: 'rgba(22,131,255,0.08)' },
  metricValue: { ...typography.h2, color: colors.textPrimary },
  metricLabel: { ...typography.caption, color: colors.textMuted },
  workspaceGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  workspaceGridCompact: { flexDirection: 'column' },
  sectionRail: {
    width: 250,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: spacing.sm,
  },
  sectionRailCompact: { width: '100%', padding: spacing.xs },
  sectionRailContentCompact: { flexDirection: 'row', gap: spacing.xs },
  navItem: { minHeight: 58, minWidth: 190, borderRadius: 16, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  navItemActive: { backgroundColor: 'rgba(13,119,255,0.2)', borderWidth: 1, borderColor: 'rgba(68,166,255,0.55)' },
  navNumber: { ...typography.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  navNumberActive: { color: colors.cyan },
  navLabel: { ...typography.label, color: colors.textSecondary, flexShrink: 1 },
  navLabelActive: { color: colors.textPrimary },
  legalNote: { marginTop: spacing.md, padding: spacing.sm, borderRadius: 16, backgroundColor: 'rgba(28,75,118,0.26)' },
  legalNoteTitle: { ...typography.label, color: colors.cyan },
  legalNoteText: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  documentCanvas: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(130,177,226,0.22)',
    borderRadius: 26,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  fieldCaption: { ...typography.caption, color: colors.textMuted },
  historyRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: colors.cyan },
  historyCopy: { flex: 1, gap: 3 },
  historyTitle: { ...typography.label },
  historyMeta: { ...typography.caption, color: colors.textMuted },
  historyText: { ...typography.body, color: colors.textSecondary },
});

function ReturnAssessmentForm({value,baseline,tenantId,role,canManage,canRead,startBlocked,context,onPendingChange,onWriteBegin,onConfirmed}:{value:CareAssessment;baseline:CareAssessmentDraftBaseline|null;tenantId:string;role?:import('@/types').RoleKey|null;canManage:boolean;canRead:boolean;startBlocked:boolean;context:CareAssessmentDraftContext;onPendingChange:(pending:boolean)=>void;onWriteBegin:()=>CareAssessmentPendingRead;onConfirmed:(payload:AssessmentLifecycleRequest,captured:CareAssessmentDraftContext,capturedBaseline:CareAssessmentDraftBaseline|null,capturedValue:CareAssessment,provenance:CareAssessmentPendingRead)=>Promise<void>}){
 const [reason,setReason]=useState('');const [needsReload,setNeedsReload]=useState(false);
 const formState=useRef({value,baseline,context,canManage,canRead,startBlocked,reason});formState.current={value,baseline,context,canManage,canRead,startBlocked,reason};
 const originalRequest=useRef<{payload:AssessmentLifecycleRequest;context:CareAssessmentDraftContext;baseline:CareAssessmentDraftBaseline|null;value:CareAssessment;id:string;provenance:CareAssessmentPendingRead}|null>(null);
 const request=useMedicationSubmission<AssessmentLifecycleRequest>(!!reason.trim(),async(requestId,payload,replay)=>{
  const current=formState.current;
  if(!current.canRead||(!replay&&(!current.canManage||current.startBlocked))||payload.action!=='return'||payload.assessmentId!==current.value.id||payload.subjectId!==current.context.subjectId)return {ok:false,error:'Aktuellen zugänglichen Rückgabebezug zuerst bestätigen.',uncertain:replay};
  if(originalRequest.current?.id!==requestId){if(replay)return {ok:false,error:'Der ursprüngliche Lesestand der ungewissen Rückgabe fehlt.',uncertain:true};try{const provenance=onWriteBegin();originalRequest.current={payload:structuredClone(payload),context:structuredClone(current.context),baseline:current.baseline?structuredClone(current.baseline):null,value:structuredClone(current.value),id:requestId,provenance};}catch(error){return {ok:false,error:error instanceof Error?error.message:'Ursprünglichen Rückgabestand prüfen.'};}}
  const original=originalRequest.current;
  if(!sameWoundJson(original.context,current.context)||!sameWoundJson(original.value,current.value)||!sameWoundJson(original.baseline,current.baseline))return {ok:false,error:'Der ursprüngliche Rückgabe- oder Formularbezug hat sich geändert.',uncertain:replay};
  onPendingChange(true);
  return applyAmbulatoryAssessmentLifecycle(tenantId,requestId,payload,role);
 },async()=>{setNeedsReload(true);const original=originalRequest.current;if(!original)throw Error('Ursprüngliche Rückgabeanfrage fehlt.');await onConfirmed(original.payload,original.context,original.baseline,original.value,original.provenance);});
 useEffect(()=>{onPendingChange(request.locked||needsReload||reason!=='');},[onPendingChange,request.locked,needsReload,reason]);
 useEffect(()=>()=>onPendingChange(false),[onPendingChange]);
 function submit(){const current=formState.current;if(!current.canManage||current.startBlocked||request.locked||needsReload||!current.reason.trim())return;if(!Number.isSafeInteger(current.value.draftRevision))return request.setError('Änderungsstand fehlt. Den gespeicherten Stand neu laden.');return request.submit({action:'return',subjectId:current.value.subjectId,assessmentId:current.value.id,expectedRevision:String(current.value.draftRevision),expectedVersion:String(current.value.version),reason:'',reasonDetail:'',returnReason:current.reason});}
 return <SectionPanel title="Zur Bearbeitung zurückgeben">
  <InfoBanner variant="info" title="Neue Bearbeitungsfassung" message="Die übergebene Prüffassung wird mit Rückgabegrund gesichert. Die neue Bearbeitungsfassung behält die vorhandenen Inhalte; sie ist keine fachliche Freigabe." />
  <PremiumInput label="Grund der Rückgabe" value={reason} onChangeText={next=>{if(formState.current.canManage&&!formState.current.startBlocked&&!request.locked&&!needsReload){onPendingChange(next!=='');setReason(next);}}} multiline maxLength={2000} editable={canManage&&!startBlocked&&!request.locked&&!needsReload} />
  {request.error?<InfoBanner variant="warning" title="Rückgabe prüfen" message={request.error}/>:null}
  {request.uncertain?<PremiumButton title="Dieselbe Rückgabe erneut prüfen" loading={request.busy} disabled={request.busy||!canRead} onPress={request.retry}/>:null}
  {needsReload?<PremiumButton title="Bestätigten Bearbeitungsstand laden" disabled={request.busy} onPress={async()=>{try{const original=originalRequest.current;if(!original)throw Error();await onConfirmed(original.payload,original.context,original.baseline,original.value,original.provenance);}catch{request.setError('Rückgabe bestätigt. Aktuellen Datensatz erneut laden.');}}}/>:null}
  <PremiumButton title="Begründet zurückgeben" disabled={!canManage||startBlocked||request.locked||needsReload||!reason.trim()} loading={request.busy} onPress={submit}/>
 </SectionPanel>;
}
