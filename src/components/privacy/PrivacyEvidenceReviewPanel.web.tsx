import {useEffect,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {ErrorState,InfoBanner,LoadingState,PremiumButton,PremiumInput,SectionPanel,SuccessState} from '@/components/ui';
import {useUnsavedWebChanges} from '@/hooks/useUnsavedWebChanges.web';
import {makePrivacyReviewPacket,privacyReviewStable,privacyReviewPacketIssue,type PrivacyReviewOriginal,type PrivacyReviewPacket,type PrivacyReviewSource} from '@/lib/privacy/privacyEvidenceReview.web';
import {readPrivacyReviewPage} from '@/lib/privacy/privacyEvidenceReviewRepository.supabase.web';
import {discardPreparedPrivacyReview,recoverPrivacyReview,savePrivacyReviewDurably} from '@/lib/privacy/privacyEvidenceReviewWorkflow.web';
import {spacing,typography} from '@/theme';

type Props={tenantId:string;actorId:string;canView:boolean;canRequest:boolean;canReview:boolean;privacyOriginal:PrivacyReviewSource;isCurrent():boolean};
export function PrivacyEvidenceReviewPanel(props:Props){
 const {tenantId,actorId,canView,canRequest,canReview,privacyOriginal:original}=props;
 const identity=`${tenantId}:${actorId}:${canView}:${canRequest}:${canReview}`;
 const live=useRef({identity,original,isCurrent:props.isCurrent}),alive=useRef(true),generation=useRef(0),running=useRef(false);
 live.current={identity,original,isCurrent:props.isCurrent};
 const current=()=>alive.current&&canView&&live.current.identity===identity&&live.current.original===original&&live.current.isCurrent();
 const [rows,setRows]=useState<PrivacyReviewOriginal[]>([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[unsent,setUnsent]=useState(false);
 const [error,setError]=useState<string|null>(null),[success,setSuccess]=useState<string|null>(null),[reason,setReason]=useState(''),[requiredChange,setRequiredChange]=useState(''),[rationale,setRationale]=useState(''),[limit,setLimit]=useState(20);
 useUnsavedWebChanges(!!reason||!!requiredChange||!!rationale||uncertain,busy||uncertain);
 const head=original.history.headId!,active=rows.find(row=>row.privacyHeadId===head&&privacyReviewStable(row.reviewedSource)===privacyReviewStable(original))??null;

 const load=async()=>{
  if(running.current||!current())return;
  running.current=true;setBusy(true);setLoaded(false);setError(null);const ticket=++generation.current;
  try{
   const recovered=await recoverPrivacyReview({tenantId,actorId},current);
   if(!current()||ticket!==generation.current)return;
   setUncertain(recovered?.ok===false);setUnsent(recovered?.ok===false&&recovered.unsent===true);
   if(recovered?.ok)setSuccess('Die ursprüngliche Fachprüfquittung wurde bestätigt.');
   else if(recovered)setError(recovered.error);
   const result=await readPrivacyReviewPage({tenantId,actorId,isCurrent:current});
   if(!current()||ticket!==generation.current)return;
   if(!result.ok){setError(result.error);return;}
   setRows(result.data);setLoaded(true);
  }catch(cause){if(current())setError(cause instanceof Error?cause.message:'Die Fachprüfhistorie konnte nicht geladen werden.');}
  finally{running.current=false;if(current())setBusy(false);}
 };
 useEffect(()=>{
  alive.current=true;void load();
  const listener=(event:StorageEvent)=>{if(event.key===`caresuite:privacy:evidence-review:v1:${tenantId}:${actorId}`){setLoaded(false);setUncertain(true);if(!running.current)void load();}};
  window.addEventListener('storage',listener);
  return()=>{alive.current=false;generation.current++;window.removeEventListener('storage',listener);};
 },[identity,original]);

 const values=(action:PrivacyReviewPacket['action'])=>({action,tenantId,actorId,expectedHeadId:active?.headId??null,expectedRevision:active?.revision??0,privacyOriginal:original,reviewOriginal:active,reason:action==='accept'?'':reason.trim(),requiredChange:action==='return'?requiredChange.trim():'',rationale:action==='accept'?rationale.trim():''});
 const candidate=(action:PrivacyReviewPacket['action'])=>privacyReviewPacketIssue({schemaVersion:'1',requestId:'00000000-0000-4000-8000-000000000001',...values(action)});
 const send=async(action:PrivacyReviewPacket['action'])=>{
  if(running.current||uncertain||!loaded||!current()||(action==='request'?!canRequest:!canReview))return;
  running.current=true;setBusy(true);setError(null);setSuccess(null);
  try{
   const packet=makePrivacyReviewPacket({requestId:globalThis.crypto.randomUUID(),...values(action)});
   const result=await savePrivacyReviewDurably(packet,()=>current()&&(action==='request'?canRequest:canReview));
   if(!current())return;
   if(!result.ok){setError(result.error);setUncertain(result.uncertain===true);setUnsent(result.unsent===true);return;}
   setRows(prior=>[result.data,...prior.filter(row=>row.rootId!==result.data.rootId)]);
   setReason('');setRequiredChange('');setRationale('');
   setSuccess(action==='request'?'Prüfanfrage bestätigt gespeichert.':action==='return'?'Begründete Rückgabe bestätigt gespeichert.':'Qualifizierte Entscheidung für diese unveränderte Fassung bestätigt gespeichert.');
  }catch(cause){if(current())setError(cause instanceof Error?cause.message:'Fachprüfung konnte nicht gespeichert werden.');}
  finally{running.current=false;if(current())setBusy(false);}
 };
 const discard=async()=>{
  if(running.current||!unsent||!current())return;running.current=true;setBusy(true);
  try{await discardPreparedPrivacyReview({tenantId,actorId},current);if(current()){setUncertain(false);setUnsent(false);setError(null);}}
  catch(cause){if(current())setError(cause instanceof Error?cause.message:'Das Journal bleibt gesperrt.');}
  finally{running.current=false;if(current())setBusy(false);}
 };
 if(!canView)return null;
 return <SectionPanel title="Datenschutz und rechtliche Fachprüfung" subtitle="Prüfung des vollständigen gespeicherten Originalstands">
  <InfoBanner variant="info" message={`${original.history.count} Originalereignisse · Kopf ${head} · ${active?.status==='accepted'?'qualifizierte Entscheidung vorhanden':active?.status==='returned'?'zur Fortschreibung zurückgegeben':active?.status==='requested'?'getrennte Entscheidung ausstehend':'noch keine Fachprüfung'}.`}/>
  <InfoBanner variant="info" message="Die Entscheidung dokumentiert die Prüfung dieser Fassung. Verarbeitung, Einwilligung, Widerruf, Aufbewahrung, Löschung, Export, Zustellung und rechtliche Freigabe benötigen jeweils eigene Originalnachweise."/>
  {!loaded&&!error?<LoadingState message="Fachprüfhistorie und gesicherte Anfrage werden geprüft…"/>:null}
  {loaded&&!uncertain?<View style={{gap:spacing.sm}}>
   {!active&&canRequest?<>
    <PremiumInput label="Konkreter Anlass der Fachprüfung" value={reason} onChangeText={setReason} editable={!busy} multiline/>
    <PremiumButton title="Fachprüfung dieser Fassung anfragen" loading={busy} disabled={busy||!!candidate('request')} onPress={()=>void send('request')}/>
   </>:null}
   {active?.status==='requested'&&canReview?<>
    <PremiumInput label="Grund der Rückgabe" value={reason} onChangeText={setReason} editable={!busy} multiline/>
    <PremiumInput label="Erforderliche konkrete Änderung" value={requiredChange} onChangeText={setRequiredChange} editable={!busy} multiline/>
    <PremiumButton title="Begründete Rückgabe speichern" variant="secondary" loading={busy} disabled={busy||!!candidate('return')} onPress={()=>void send('return')}/>
    <PremiumInput label="Eigene fachliche Begründung der Entscheidung" value={rationale} onChangeText={setRationale} editable={!busy} multiline/>
    <PremiumButton title="Qualifizierte Entscheidung speichern" loading={busy} disabled={busy||!!candidate('accept')} onPress={()=>void send('accept')}/>
    <InfoBanner variant="info" message={candidate('accept')??'Aktuelle Rechte, Beschäftigung, Qualifikation, Nachweisdokument, Prüfbereich und getrennte Personen werden gegen die Originale geprüft.'}/>
   </>:null}
   {active?.status==='returned'?<InfoBanner variant="warning" message="Die Rückgabe bleibt erhalten. Originale begründet fortschreiben und die neue Fassung gesondert prüfen lassen."/>:null}
  </View>:null}
  {rows.slice(0,limit).map(row=><View key={row.rootId} style={{gap:spacing.xs}}>
   <Text selectable style={typography.label}>{row.privacyHeadId===head&&privacyReviewStable(row.reviewedSource)===privacyReviewStable(original)?'Aktueller Kopf':'Früherer Kopf'} · {row.status==='accepted'?'entschieden':row.status==='returned'?'zurückgegeben':'angefragt'}</Text>
   {row.history.map(event=><Text selectable key={event.id} style={typography.caption}>{event.recordedAt} · {event.actorName} · {event.reason||event.rationale}{event.requiredChange?` · Änderung: ${event.requiredChange}`:''}{event.qualification?` · Qualifikation: ${event.qualification.title}`:''}</Text>)}
  </View>)}
  {limit<rows.length?<PremiumButton title="Weitere Fachprüfungen anzeigen" variant="secondary" onPress={()=>setLimit(value=>value+20)}/>:null}
  {error?<ErrorState message={error}/>:null}{success?<SuccessState message={success}/>:null}
  {uncertain?<InfoBanner variant="warning" title={unsent?'Ungesendete Anfrage gesichert':'Prüfausgang ungeklärt'} message={unsent?'Diese Anfrage wurde nicht gesendet. Verwerfen betrifft nur ihre lokale Vorbereitung.':'Die ursprüngliche Anfrage bleibt erhalten. Erneut prüfen liest ausschließlich ihre Quittung.'}/>:null}
  {unsent?<PremiumButton title="Ungesendete Prüfanfrage verwerfen" variant="secondary" disabled={busy} onPress={()=>void discard()}/>:null}
  <PremiumButton title={uncertain?'Ursprüngliche Prüfquittung prüfen':'Fachprüfhistorie neu laden'} variant="secondary" disabled={busy} onPress={()=>void load()}/>
 </SectionPanel>;
}
