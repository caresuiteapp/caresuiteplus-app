import {useEffect,useMemo,useRef,useState} from 'react';
import {ScrollView,StyleSheet,Text,View} from 'react-native';
import {useLocalSearchParams,useRouter} from 'expo-router';
import {ScreenShell} from '@/components/layout';
import {ErrorState,FilterChipGroup,InfoBanner,LoadingState,PremiumButton,PremiumInput,SectionPanel,SuccessState} from '@/components/ui';
import {VitalMeasurementArtwork} from '@/components/pflege/VitalMeasurementArtwork';
import {useAuth} from '@/lib/auth/context';
import { useCareRuntimePermissions as usePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import {useServiceTenantId} from '@/hooks/useTenantId';
import {useAsyncQuery} from '@/hooks/core/useAsyncQuery';
import {useCareLightPalette} from '@/design/tokens/carelightadaptive';
import {spacing,typography} from '@/theme';
import {getVitalDefinition} from '@/lib/pflege/vitalCatalog';
import {useMedicationSubmission} from '@/hooks/useMedicationSubmission.web';
import {MedicationEventTimeInput,currentMedicationEventTime,medicationEventInstant} from '@/components/pflege/MedicationEventTimeInput.web';
import {type VitalFollowUpPayload} from '@/lib/pflege/vitalMeasurementDomain';
import {type VitalInvalidationPayload} from '@/lib/pflege/vitalHistoryDomain';
import {VitalDetailWriteRuntimeWeb,captureVitalDetailWriteViewWeb,vitalDetailWriteActionsWeb,type VitalDetailWriteCaptureWeb,type VitalDetailOperationWeb} from '@/lib/pflege/vitalDetailWriteRuntime.web';
import {carePermissionOwner,sameCarePermissionOwner,type CarePermissionOwner} from '@/lib/permissions/carePermissionOwner.web';
import {isDemoMode} from '@/lib/supabase/config';
import {vitalTimeFieldDisplay} from '@/lib/pflege/vitalTimeDisplay.web';
import {VitalCarePathWorkspacePanel} from '@/components/pflege/VitalCarePathWorkspacePanel.web';
import {RespiratoryIntensiveCareWorkspacePanel} from '@/components/pflege/RespiratoryIntensiveCareWorkspacePanel.web';
type DisplayRow=Readonly<Record<string,unknown>>;
type PermissionFeedback=Pick<ReturnType<typeof usePermissions>,'loading'|'error'|'refreshPermissions'>;
const displayText=(value:unknown,fallback='Nicht bestätigt')=>typeof value==='string'?value:fallback;
const displayRow=(value:unknown):DisplayRow|null=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))?value as DisplayRow:null;
const displayHistory=(value:unknown):readonly DisplayRow[]|null=>Array.isArray(value)&&value.every(row=>!!displayRow(row))?value as readonly DisplayRow[]:null;
export function VitalReadingDetailScreen(){
  const {id}=useLocalSearchParams<{id:string}>(),auth=useAuth(),permissions=usePermissions(),tenantId=useServiceTenantId();
  const owner=carePermissionOwner(auth,tenantId,isDemoMode()),native=useRef({auth,permissions,tenantId});native.current={auth,permissions,tenantId};
  const live=useRef(()=>{const value=native.current;if(value.permissions.tenantId!==value.tenantId||value.permissions.roleKey!==value.auth.profile?.roleKey||!Object.isFrozen(value.permissions.permissions))throw Error('Aktueller eigener nativer Rechteursprung fehlt.');const descriptor=Object.getOwnPropertyDescriptor(value.permissions,'can');if(!descriptor||!Object.hasOwn(descriptor,'value')||typeof descriptor.value!=='function')throw Error('Nativer Rechtebezug fehlt.');return {auth:value.auth,owner:carePermissionOwner(value.auth,value.tenantId,isDemoMode()),permissions:value.permissions};});
  const held=useRef<{owner:CarePermissionOwner;id:string;actions:ReturnType<typeof vitalDetailWriteActionsWeb>;draft:string;capture:VitalDetailWriteCaptureWeb;attachment:number}|null>(null),attachment=useRef(0);
  if(!owner){held.current?.actions.dispose();held.current=null;}
  else if(!held.current||!sameCarePermissionOwner(held.current.owner,owner)||held.current.id!==id||held.current.draft!==held.current.actions.draftVersion()){held.current?.actions.dispose();try{const runtime=new VitalDetailWriteRuntimeWeb(owner,id,live.current);const capture=captureVitalDetailWriteViewWeb(runtime),actions=vitalDetailWriteActionsWeb(capture);held.current={owner,id,actions,draft:actions.draftVersion(),capture,attachment:++attachment.current};}catch{held.current=null;}}
  useEffect(()=>()=>held.current?.actions.dispose(),[]);
  const runtime=held.current?.actions??null;const [,setOriginalRevision]=useState(0);
  useEffect(()=>runtime?.subscribe(()=>setOriginalRevision(value=>value+1)),[runtime]);
  const permissionState={loading:permissions.loading||auth.isLoading||!auth.authReady,error:permissions.error,refreshPermissions:permissions.refreshPermissions};
  if(!runtime)return <ScreenShell title="Vitalwert">{permissionState.loading?<LoadingState message="Berechtigungen werden geprüft…"/>:permissionState.error?<ErrorState message={permissionState.error} onRetry={permissionState.refreshPermissions}/>:<ErrorState message="Eigener aktueller Benutzer- und Messungsbezug nicht bestätigt."/>}</ScreenShell>;
  return <VitalDetailWorkspace key={`${held.current?.attachment}:${runtime.draftVersion()}`} capture={held.current!.capture} actorId={held.current!.owner.profileId} canReview={permissions.can('pflege.documentation.sign')} permissionState={permissionState}/>;
}
function VitalDetailWorkspace({capture,actorId,canReview,permissionState}:{capture:VitalDetailWriteCaptureWeb;actorId:string;canReview:boolean;permissionState:PermissionFeedback}){
  const runtime=useMemo(()=>vitalDetailWriteActionsWeb(capture),[capture]);
  const router=useRouter(),styles=useStyles(),[editor,setEditor]=useState(false),[correcting,setCorrecting]=useState(false),[success,setSuccess]=useState<string|null>(null);
  const canView=runtime.canRead(),origin=runtime.captureReadOrigin();
  const query=useAsyncQuery(()=>runtime.fetch(origin),[runtime,origin,canView],{enabled:canView&&!!origin,queryKey:`${runtime.tenantId}:${runtime.role}:${runtime.id}:${runtime.readVersion()}:vital-detail-original`});
  const flags={loading:query.loading,refreshing:query.refreshing,error:!!query.error,refreshError:!!query.refreshError,previewData:query.previewData,tableMissing:query.tableMissing,fromCache:query.cacheMeta.fromCache,partialDetail:!!query.cacheMeta.partialDetail,usedDemoFallback:false};runtime.present(query.data,flags);
  const reading=runtime.view(query.data),definition=reading&&typeof reading.type==='string'?getVitalDefinition(reading.type):null,actualTime=vitalTimeFieldDisplay(reading,'occurredAt');
  const history=reading?displayHistory(reading.followUps):null,invalidation=reading?displayRow(reading.invalidation):null,original=runtime.pendingState();
  useEffect(()=>{runtime.mount();return()=>runtime.dispose();},[runtime]);
  const [,setOriginalRevision]=useState(0);useEffect(()=>runtime.subscribe(()=>setOriginalRevision(value=>value+1)),[runtime]);
  const currentRead=()=>runtime.view(query.data)===reading&&!!reading;
  const prepareFollow=()=>{if(!currentRead()||!runtime.canPrepare('follow_up'))return;setSuccess(null);setEditor(true);};
  const prepareInvalidation=()=>{if(!currentRead()||!runtime.canPrepare('invalidation'))return;setSuccess(null);setCorrecting(true);};
  const reload=async()=>{if(!runtime.canRead())return;await query.refresh();if(!runtime.canRead())return;};
  const saved=async(kind:VitalDetailOperationWeb)=>{if(!runtime.known(kind))return;if(!runtime.canRead())return;setSuccess(kind==='follow_up'?'Gespeicherte Original-Folgedokumentation bestätigt; aktueller Bestand wird erneut gelesen.':'Original-Ungültigkeitsvermerk bestätigt; aktueller Bestand wird erneut gelesen.');if(kind==='follow_up')setEditor(false);else setCorrecting(false);await reload();};
  const closeParent=()=>{const token=runtime.captureClose();if(token&&runtime.mayClose(token))router.back();};
  const newToken=runtime.captureNewFollowUp(),newFollow=()=>{if(runtime.newFollowUp(newToken)){setEditor(false);setCorrecting(false);setSuccess(null);}};
  if(!canView)return <ScreenShell title="Vitalwert">{permissionState.loading?<LoadingState message="Berechtigungen werden geprüft…"/>:permissionState.error?<ErrorState message={permissionState.error} onRetry={permissionState.refreshPermissions}/>:<ErrorState message="Aktuelle eigene Leseberechtigung fehlt."/>}</ScreenShell>;
  if(!reading)return <ScreenShell title="Vitalwert"><ScrollView contentContainerStyle={styles.content}>{query.loading||query.refreshing?<LoadingState message="Ganze Originalmessung und Belege werden geladen…"/>:<ErrorState message={query.error??query.refreshError??'Ganze Originalmessung oder vollständige Anzeige noch nicht bestätigt.'} onRetry={reload}/>}<VitalOriginalRequestStatus capture={capture}/>{original.pending&&runtime.canManage()?<View>{runtime.operationState('follow_up').pending?<VitalFollowUpForm key={`${runtime.readVersion()}:follow-up`} capture={capture} close={()=>setEditor(false)} saved={()=>saved('follow_up')}/>:null}{runtime.operationState('invalidation').pending?<VitalInvalidationForm key={`${runtime.readVersion()}:invalidation`} capture={capture} close={()=>setCorrecting(false)} saved={()=>saved('invalidation')}/>:null}</View>:null}</ScrollView></ScreenShell>;
  const values=Object.entries(displayRow(reading.values)??{}), context=displayRow(reading.context), conditions=Object.entries(context??{});
  return <ScreenShell title={definition?.label??displayText(reading.type)} subtitle="Gespeicherte Messung"><ScrollView contentContainerStyle={styles.content}>
    {success?<SuccessState message={success}/>:null}
    {query.refreshError?<ErrorState message={query.refreshError} onRetry={reload}/>:null}
    {invalidation?<InfoBanner variant="warning" title="Messung als ungültig gekennzeichnet" message={`${displayText(invalidation.reason)} · ${vitalTimeFieldDisplay(invalidation,'recordedAt').display} · ${displayText(invalidation.recordedByName)}. Die ursprünglichen Angaben und Folgedokumentationen bleiben erhalten.`}/>:null}
    <SectionPanel title="Originalmessung">
      <View style={styles.summary}>
        {definition?<VitalMeasurementArtwork measurementKey={definition.key} size={72}/>:null}
        <View style={styles.summaryText}>
          <Text style={styles.label}>Gespeicherter Messwert</Text>
          <Text style={styles.value}>{displayText(reading.value)} {displayText(reading.unit)}</Text>
        </View>
      </View>
      <View style={styles.metadata}>
        <View style={styles.metadataItem}>
          <Text style={styles.label}>Klient:in</Text>
          <Text style={styles.body}>{displayText(reading.clientName)}</Text>
          <Text style={styles.note}>{displayText(reading.clientId)}</Text>
        </View>
        <View style={styles.metadataItem}>
          <Text style={styles.label}>Tatsächlich gemessen</Text>
          {actualTime.state==='valid'?<Text style={styles.body}>{actualTime.display}</Text>:<Text style={styles.body}>Nicht bestätigt</Text>}
        </View>
        <View style={styles.metadataItem}>
          <Text style={styles.label}>Erfasst</Text>
          <Text style={styles.body}>{vitalTimeFieldDisplay(reading,'recordedAt').display}</Text>
          <Text style={styles.note}>{displayText(reading.recordedByName)}</Text>
        </View>
      </View>
      {actualTime.state!=='valid'?<InfoBanner variant="warning" message={`Gesonderter tatsächlicher Messzeitpunkt nicht bestätigt. ${actualTime.display}. Die Erfassungszeit wird nicht als Messzeit ausgegeben.`}/>:null}
      <View style={styles.originalNote}>
        <Text accessibilityRole="header" style={styles.subheading}>Notiz zur Messung</Text>
        <Text style={styles.body}>{displayText(reading.note,'Originalnotiz nicht bestätigt')||'Keine zusätzliche Notiz dokumentiert.'}</Text>
      </View>
      {reading.type==='fluid_balance'?<InfoBanner variant={context?.completeness==='complete'?'info':'warning'} message={context?.completeness==='complete'?'Dokumentierter Erfassungsumfang: vollständig. Der Saldo ist eine rechnerische Differenz und ersetzt keine klinische Beurteilung.':'Erfassungsumfang unvollständig oder unbekannt. Der rechnerische Saldo ist keine bestätigte Gesamtbilanz.'}/>:null}
      <View style={styles.detailGroup}>
        <Text style={styles.label}>Gespeicherter Grenzwertvergleich</Text>
        <Text style={styles.body}>{reading.flagStatus==='outside_configured_range'?'Außerhalb mindestens einer klientenbezogen konfigurierten Grenze. Fachliche Reaktion prüfen.':reading.flagStatus==='within_configured_range'?'Innerhalb der gespeicherten konfigurierten Grenzen. Dies ersetzt keine fachliche Beurteilung.':'Keine vollständige Bewertung anhand klientenbezogener Grenzen bestätigt.'}</Text>
      </View>
    </SectionPanel>
    {values.length||conditions.length?<SectionPanel title="Einzelwerte und Messbedingungen">
      {values.length?<View style={styles.detailGroup}>
        <Text accessibilityRole="header" style={styles.subheading}>Einzelwerte</Text>
        <View style={styles.metadata}>{values.map(([key,value])=><View key={key} style={styles.metadataItem}>
          <Text style={styles.label}>{definition?.components.find(c=>c.key===key)?.label??key}</Text>
          <Text style={styles.body}>{typeof value==='number'?value.toLocaleString('de-DE'):'Wert nicht bestätigt'}</Text>
        </View>)}</View>
      </View>:null}
      {conditions.length?<View style={styles.detailGroup}>
        <Text accessibilityRole="header" style={styles.subheading}>Messbedingungen</Text>
        <View style={styles.metadata}>{conditions.map(([key,value])=>{
          const field=definition?.contextFields?.find(item=>item.key===key);
          const label=field?.label??(key==='scale'?'Skala':key==='completeness'?'Erfassungsumfang':key==='incompleteReason'?'Fehlende Angaben':key);
          const extent=key==='completeness'&&typeof value==='string'?({complete:'Vollständig erfasst',incomplete:'Unvollständig erfasst',unknown:'Umfang unbekannt'} as Record<string,string>)[value]:undefined;
          return <View key={key} style={styles.metadataItem}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.body}>{typeof value==='string'?(field?.options.find(option=>option.key===value)?.label??extent??value):'Angabe nicht bestätigt'}</Text>
          </View>;
        })}</View>
      </View>:null}
    </SectionPanel>:null}
    <SectionPanel title="Reaktion und Verlaufskontrollen">
      <VitalOriginalRequestStatus capture={capture}/>
      {runtime.canManage()?<View style={styles.actions}>
        <PremiumButton title="Reaktion / Verlaufskontrolle ergänzen" disabled={editor||correcting||!runtime.canPrepare('follow_up')} onPress={prepareFollow}/>
        {runtime.known('follow_up')?<PremiumButton title="Neue Folgedokumentation bewusst vorbereiten" variant="secondary" disabled={!newToken} onPress={newFollow}/>:null}
      </View>:null}
      {(editor||runtime.operationState('follow_up').pending)&&runtime.canManage()?<VitalFollowUpForm key={`${runtime.readVersion()}:follow-up`} capture={capture} close={()=>setEditor(false)} saved={()=>saved('follow_up')}/>:null}
      {history?.length?history.map(f=><View key={displayText(f.id)} style={styles.history}>
        <Text style={styles.subheading}>{f.outcome==='resolved'?'Abschluss dokumentiert':f.outcome==='ongoing'?'Weitere Kontrolle erforderlich':'Ergebnis nicht bestätigt'}</Text>
        <Text style={styles.note}>Beobachtet: {vitalTimeFieldDisplay(f,'observedAt').display}</Text>
        <Text style={styles.body}>Beobachtung: {displayText(f.observation)}</Text><Text style={styles.body}>Tatsächliche Reaktion: {displayText(f.action)}</Text><Text style={styles.body}>Zuständig: {displayText(f.responsiblePerson)}</Text>
        {!['missing','undefined','null'].includes(vitalTimeFieldDisplay(f,'nextReviewAt').state)?<Text style={styles.note}>Nächste Kontrolle: {vitalTimeFieldDisplay(f,'nextReviewAt').display}</Text>:null}<Text style={styles.note}>Erfasst: {vitalTimeFieldDisplay(f,'recordedAt').display} · {displayText(f.recordedByName)}</Text>
      </View>):!history?<InfoBanner variant="warning" message="Vollständige Anzeige der Originalhistorie nicht bestätigt."/>:<Text style={styles.note}>Keine bestätigte Folgedokumentation vorhanden. Ein Grenzwert-Hinweis belegt keine erfolgte Reaktion.</Text>}
    </SectionPanel>
    {runtime.canManage()&&(!invalidation||runtime.operationState('invalidation').pending)?<SectionPanel title="Fehlerhafte Dokumentation korrigieren">
      <Text style={styles.body}>Ein fehlerhafter Eintrag wird mit einem begründeten Vermerk als ungültig gekennzeichnet. Originalmessung und Folgedokumentationen bleiben erhalten; keine neue Messung oder erledigte Kontrolle wird daraus abgeleitet.</Text>
      <View style={styles.actions}><PremiumButton title="Ungültigkeitsvermerk vorbereiten" variant="secondary" disabled={editor||correcting||!runtime.canPrepare('invalidation')} onPress={prepareInvalidation}/></View>
      {correcting||runtime.operationState('invalidation').pending?<VitalInvalidationForm key={`${runtime.readVersion()}:invalidation`} capture={capture} close={()=>setCorrecting(false)} saved={()=>saved('invalidation')}/>:null}
    </SectionPanel>:null}
    {typeof reading.clientId==='string'&&reading.vitalPathAvailable!==false?
      <VitalCarePathWorkspacePanel tenantId={runtime.tenantId} clientId={reading.clientId} measurementId={runtime.id}
        actorId={actorId} canRead={runtime.canRead()} canWrite={runtime.canManage()} canReview={canReview}/>:null}
    {typeof reading.clientId==='string'&&reading.respiratoryPathAvailable!==false?
      <RespiratoryIntensiveCareWorkspacePanel tenantId={runtime.tenantId} clientId={reading.clientId} measurementId={runtime.id}
        actorId={actorId} canRead={runtime.canRead()} canWrite={runtime.canManage()} canReview={canReview}/>:null}
    <View style={styles.actions}><PremiumButton title="Messung erneut laden" variant="secondary" disabled={editor||correcting||original.busy} onPress={reload}/><PremiumButton title="Zurück" variant="secondary" disabled={editor||correcting||original.pending} onPress={closeParent}/></View>
  </ScrollView></ScreenShell>;
}
function VitalOriginalRequestStatus({capture}:{capture:VitalDetailWriteCaptureWeb}){
  const runtime=useMemo(()=>vitalDetailWriteActionsWeb(capture),[capture]);
  const state=runtime.pendingState(),follow=runtime.known('follow_up'),invalid=runtime.known('invalidation'),[error,setError]=useState<string|null>(null);
  const styles=useStyles();
  const alive=useRef(true);useEffect(()=>()=>{alive.current=false;},[]);
  const reconcile=(kind:VitalDetailOperationWeb)=>{if(!alive.current||!runtime.canRead())return;if(!runtime.reconcile(kind))setError('Ganze gespeicherte Originalanfrage noch nicht bestätigt. Ihr bisheriger Auftrag bleibt unverändert erhalten.');else setError(null);};
  if(!error&&!state.pending&&!follow&&!invalid)return null;
  return <View style={styles.detailGroup}>
    {error?<ErrorState message={error}/>:null}
    {state.pending?<InfoBanner variant="warning" title={state.busy?'Ursprünglicher Transport noch offen':'Originales Speicherergebnis unklar'} message="Die ursprüngliche Kennung und alle Angaben bleiben erhalten. Ein fehlender Beleg beweist keine Nichtausführung."/>:null}
    {follow?<InfoBanner variant="info" message={`Original-Folgedokumentation bestätigt · Kennung ${follow.id}. Dies bestätigt keine weitere Pflegehandlung.`}/>:null}
    {invalid?<InfoBanner variant="info" message={`Original-Ungültigkeitsvermerk bestätigt · Kennung ${invalid.id}. Die ursprünglichen Angaben bleiben erhalten.`}/>:null}
    {state.pending?<View style={styles.actions}>
      <View style={styles.actionCell}><PremiumButton title="Original-Folgedokumentation anhand gespeicherter Belege prüfen" variant="secondary" fullWidth style={styles.wrapAction} onPress={()=>reconcile('follow_up')}/></View>
      <View style={styles.actionCell}><PremiumButton title="Original-Ungültigkeitsvermerk anhand gespeicherter Belege prüfen" variant="secondary" fullWidth style={styles.wrapAction} onPress={()=>reconcile('invalidation')}/></View>
    </View>:null}
  </View>;
}
function VitalFollowUpForm({capture,close,saved}:{capture:VitalDetailWriteCaptureWeb;close():void;saved():Promise<void>}){
  const runtime=useMemo(()=>vitalDetailWriteActionsWeb(capture),[capture]);
  const frame=useRef(runtime.captureForm('follow_up'));useEffect(()=>()=>runtime.closeForm(frame.current),[runtime]);
  const frameCurrent=()=>runtime.formCurrent('follow_up',frame.current);
  const styles=useStyles(),[observed,setObserved]=useState(currentMedicationEventTime),[next,setNext]=useState(currentMedicationEventTime),[timeEdited,setTimeEdited]=useState(false),[nextEdited,setNextEdited]=useState(false);
  const [observation,setObservation]=useState(''),[action,setAction]=useState(''),[responsiblePerson,setResponsiblePerson]=useState(''),[outcome,setOutcome]=useState<''|'ongoing'|'resolved'>('');
  const revision=useRef(0),renderRevision=revision.current;
  const write=useMedicationSubmission<VitalFollowUpPayload>(!!(observation||action||responsiblePerson||outcome||timeEdited||nextEdited)||runtime.operationState('follow_up').pending,(id,payload,replay)=>runtime.execute('follow_up',id,payload,replay,frame.current),async()=>{if(frameCurrent()&&runtime.known('follow_up')&&runtime.canRead())await saved();});
  const original=runtime.operationState('follow_up'),retry=runtime.captureRetry('follow_up'),locked=write.locked||original.pending,busy=write.busy||original.busy;
  const editable=()=>frameCurrent()&&renderRevision===revision.current&&!locked&&runtime.mayEdit('follow_up');
  const edit=(change:()=>void)=>{if(editable()){revision.current++;change();}};
  async function save(){if(!frameCurrent())return;if(!runtime.canManage()||original.busy||runtime.known('follow_up'))return;if(original.pending){if(write.uncertain){await write.retry();return;}const result=await runtime.retry('follow_up',retry,frame.current);if(!result.ok&&runtime.canRead())write.setError(result.error);return;}if(!editable()){write.setError('Aktuellen ganzen Originalbestand und eigene Rechte zuerst prüfen.');return;}if(!outcome){write.setError('Ergebnis ausdrücklich auswählen.');return;}const payload={measurementId:runtime.id,observedAt:medicationEventInstant(observed),observation,action,responsiblePerson,outcome,nextReviewAt:outcome==='ongoing'?medicationEventInstant(next):''};if(!runtime.prepare('follow_up',payload,frame.current)){write.setError('Tatsächlichen Zeitpunkt, ganze Originalmessung und dokumentierte Reaktion prüfen.');return;}await write.submit(payload);}
  async function closeAction(){if(!frameCurrent())return;if(renderRevision!==revision.current)return;const token=runtime.captureClose();if(!token)return;const leave=await write.confirmLeave();if(leave&&frameCurrent()&&renderRevision===revision.current&&runtime.mayClose(token))close();}
  return <View style={styles.form}>
    {write.error?<ErrorState message={write.error}/>:null}{original.uncertain?<InfoBanner variant="warning" message="Nur dieselbe unveränderte Originalkontrolle mit aktuellen eigenen Schreibrechten wiederholen."/>:null}
    <MedicationEventTimeInput label="Tatsächlicher Kontrollzeitpunkt" value={observed} disabled={locked} onChange={v=>edit(()=>{setObserved(v);setTimeEdited(true);})}/>
    <PremiumInput label="Beobachtung / Verlauf *" accessibilityLabel="Beobachtung der Kontrolle" value={observation} onChangeText={v=>edit(()=>setObservation(v))} editable={!locked} maxLength={2000} multiline/>
    <PremiumInput label="Tatsächlich erfolgte Reaktion *" accessibilityLabel="Tatsächliche Reaktion" value={action} onChangeText={v=>edit(()=>setAction(v))} editable={!locked} maxLength={2000} multiline/>
    <PremiumInput label="Zuständige Person / Kontakt *" accessibilityLabel="Zuständige Person" value={responsiblePerson} onChangeText={v=>edit(()=>setResponsiblePerson(v))} editable={!locked} maxLength={200}/>
    <FilterChipGroup wrap options={[{key:'ongoing',label:'Weitere Kontrolle erforderlich'},{key:'resolved',label:'Abschluss fachlich dokumentiert'}]} value={outcome} onChange={locked?undefined:key=>edit(()=>{setOutcome(key as 'ongoing'|'resolved');setNextEdited(false);})}/>
    {outcome==='ongoing'?<MedicationEventTimeInput label="Nächste Kontrolle" value={next} disabled={locked} onChange={v=>edit(()=>{setNext(v);setNextEdited(true);})}/>:null}
    <InfoBanner variant="info" message="Ihre Beobachtung und tatsächlich dokumentierte Reaktion bleiben eigene Angaben. Die Software leitet daraus keine Diagnose, Therapieentscheidung oder erledigte Pflegehandlung ab."/>
    <View style={styles.actions}><PremiumButton title={busy?'Originalkontrolle wird geprüft…':original.pending?'Dieselbe Originalkontrolle wiederholen':'Folgedokumentation speichern'} disabled={busy} onPress={save}/><PremiumButton title="Bearbeitung schließen" variant="secondary" disabled={locked} onPress={closeAction}/></View>
  </View>;
}
function VitalInvalidationForm({capture,close,saved}:{capture:VitalDetailWriteCaptureWeb;close():void;saved():Promise<void>}){
  const runtime=useMemo(()=>vitalDetailWriteActionsWeb(capture),[capture]);
  const frame=useRef(runtime.captureForm('invalidation'));useEffect(()=>()=>runtime.closeForm(frame.current),[runtime]);
  const frameCurrent=()=>runtime.formCurrent('invalidation',frame.current);
  const styles=useStyles(),[reason,setReason]=useState(''),revision=useRef(0),renderRevision=revision.current;
  const write=useMedicationSubmission<VitalInvalidationPayload>(!!reason||runtime.operationState('invalidation').pending,(id,payload,replay)=>runtime.execute('invalidation',id,payload,replay,frame.current),async()=>{if(frameCurrent()&&runtime.known('invalidation')&&runtime.canRead())await saved();});
  const original=runtime.operationState('invalidation'),retry=runtime.captureRetry('invalidation'),locked=write.locked||original.pending,busy=write.busy||original.busy;
  const editReason=(value:string)=>{if(!frameCurrent()||renderRevision!==revision.current||locked||!runtime.mayEdit('invalidation'))return;revision.current++;setReason(value);};
  async function save(){if(!frameCurrent())return;if(!runtime.canManage()||original.busy||runtime.known('invalidation'))return;if(original.pending){if(write.uncertain){await write.retry();return;}const result=await runtime.retry('invalidation',retry,frame.current);if(!result.ok&&runtime.canRead())write.setError(result.error);return;}if(renderRevision!==revision.current||locked)return;const payload={measurementId:runtime.id,reason};if(!runtime.prepare('invalidation',payload,frame.current)){write.setError('Ganze Originalmessung, tatsächlichen Grund und aktuelle eigene Rechte prüfen.');return;}await write.submit(payload);}
  async function closeAction(){if(!frameCurrent())return;if(renderRevision!==revision.current)return;const token=runtime.captureClose();if(!token)return;const leave=await write.confirmLeave();if(leave&&frameCurrent()&&renderRevision===revision.current&&runtime.mayClose(token))close();}
  return <View style={styles.form}>{write.error?<ErrorState message={write.error}/>:null}{original.uncertain?<InfoBanner variant="warning" message="Nur dieselbe unveränderte Originalanfrage prüfen. Ein neuer Korrekturvermerk wird nicht angelegt."/>:null}<PremiumInput label="Tatsächlicher Grund für die Ungültigkeit *" accessibilityLabel="Begründung des Ungültigkeitsvermerks" value={reason} onChangeText={editReason} editable={!locked} maxLength={2000} multiline/><View style={styles.actions}><PremiumButton title={busy?'Originalvermerk wird geprüft…':original.pending?'Dieselbe Originalanfrage wiederholen':'Messung begründet als ungültig kennzeichnen'} disabled={busy} onPress={save}/><PremiumButton title="Bearbeitung schließen" variant="secondary" disabled={locked} onPress={closeAction}/></View></View>;
}

function useStyles(){
  const {c}=useCareLightPalette();
  return useMemo(()=>StyleSheet.create({
    content:{width:'100%',maxWidth:1160,alignSelf:'center',gap:spacing.lg,paddingBottom:spacing.xxl,minWidth:0},
    summary:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.md,minWidth:0},
    summaryText:{flexGrow:1,flexShrink:1,flexBasis:180,minWidth:0,gap:spacing.xs},
    metadata:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm,minWidth:0},
    metadataItem:{flexGrow:1,flexBasis:200,minWidth:0,borderWidth:1,borderColor:c.border,borderRadius:spacing.md,padding:spacing.md,gap:spacing.xs},
    originalNote:{gap:spacing.xs,backgroundColor:c.surfaceAlt,borderRadius:spacing.md,padding:spacing.md},
    detailGroup:{gap:spacing.sm,minWidth:0},
    form:{gap:spacing.md,minWidth:0},
    history:{gap:spacing.sm,borderTopWidth:1,borderTopColor:c.border,paddingTop:spacing.md},
    actions:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},
    actionCell:{flexGrow:1,flexBasis:280,minWidth:0,maxWidth:'100%'},
    wrapAction:{height:'auto',maxHeight:undefined,paddingVertical:spacing.sm},
    subheading:{...typography.label,color:c.text},
    label:{...typography.label,color:c.muted},
    body:{...typography.body,color:c.text},
    note:{...typography.caption,color:c.muted},
    value:{...typography.display,color:c.text},
  }),[c]);
}
