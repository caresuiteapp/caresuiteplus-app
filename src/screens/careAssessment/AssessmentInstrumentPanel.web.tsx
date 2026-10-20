import {useEffect,useMemo,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {EmptyState,ErrorState,FilterChipGroup,InfoBanner,LoadingState,PremiumButton,PremiumInput,SectionPanel} from '@/components/ui';
import {useAsyncQuery} from '@/hooks/core/useAsyncQuery';
import {readAssessmentInstrumentSnapshot} from '@/lib/careAssessment/assessmentInstrumentRepository.supabase.web';
import {assessmentInstrumentPacketIssue,makeAssessmentInstrumentPacket,type AssessmentInstrumentPacket,type AssessmentInstrumentSnapshot} from '@/lib/careAssessment/assessmentInstrumentPacket.web';
import type {RoleKey} from '@/types';
import {colors,spacing,typography} from '@/theme';

type InstrumentPanelState={packet:AssessmentInstrumentPacket|null;issue:string|null;dirty:boolean;loading:boolean};
export function AssessmentInstrumentPanel({tenantId,assessmentId,subjectId,actorId,role,riskKeys,editable,reviewRequested,onState}:{
 tenantId:string;assessmentId:string;subjectId:string;actorId:string;role?:RoleKey|null;riskKeys:string[];editable:boolean;reviewRequested:boolean;
 onState:(state:InstrumentPanelState)=>void;
}){
 const query=useAsyncQuery(()=>readAssessmentInstrumentSnapshot({tenantId,assessmentId,subjectId,actorId,role}),[tenantId,assessmentId,subjectId,actorId,role],{enabled:!!tenantId&&!!assessmentId&&!!subjectId&&!!actorId,queryKey:`${tenantId}:${assessmentId}:${subjectId}:${actorId}:${role}:instrument-packet`});
 const [selected,setSelected]=useState<string[]>([]),[rationale,setRationale]=useState('');
 const adopted=useRef('');
 const snapshot=query.data;
 const identity=snapshot?`${snapshot.catalogRevision}:${snapshot.selection.revision}:${snapshot.selection.updatedAt??''}:${snapshot.readAt}`:'';
 useEffect(()=>{if(!snapshot||adopted.current===identity)return;adopted.current=identity;setSelected([...snapshot.selection.selectedInstrumentIds].sort());setRationale(snapshot.selection.rationale);},[snapshot,identity]);
 const riskSignature=[...new Set(riskKeys)].sort().join('\u001f');
 const computed=useMemo(()=>{
  if(!snapshot)return {packet:null,issue:query.error??query.refreshError??'Instrumenten- und Modellbestand vollständig laden.',dirty:false};
  try{
   const packet=makeAssessmentInstrumentPacket(snapshot,selected,rationale,riskSignature?riskSignature.split('\u001f'):[]);
   const issue=assessmentInstrumentPacketIssue(packet,riskSignature?riskSignature.split('\u001f'):[],reviewRequested);
   const dirty=JSON.stringify([...selected].sort())!==JSON.stringify([...snapshot.selection.selectedInstrumentIds].sort())||rationale.trim()!==snapshot.selection.rationale.trim();
   return {packet,issue,dirty};
  }catch(error){return {packet:null,issue:error instanceof Error?error.message:'Instrumentenauswahl prüfen.',dirty:true};}
 },[snapshot,selected,rationale,riskSignature,reviewRequested,query.error,query.refreshError]);
 const callback=useRef(onState);callback.current=onState;
 useEffect(()=>{callback.current({packet:computed.packet,issue:computed.issue,dirty:computed.dirty,loading:query.loading||query.refreshing});},[computed.packet,computed.issue,computed.dirty,query.loading,query.refreshing]);
 if(query.loading)return <SectionPanel title="Assessmentmodell und Instrumente"><LoadingState message="Berechtigten Instrumentenbestand laden…"/></SectionPanel>;
 if(query.error||!snapshot)return <SectionPanel title="Assessmentmodell und Instrumente"><ErrorState message={query.error??'Instrumentenbestand fehlt.'}/><PremiumButton title="Instrumentenbestand erneut laden" onPress={query.refresh}/></SectionPanel>;
 const available=snapshot.instruments.filter(item=>item.availability==='active'&&['owned','licensed'].includes(item.licenseState));
 const unavailable=snapshot.instruments.filter(item=>!available.includes(item));
 const matching=available.filter(item=>!item.riskKeys.length||item.riskKeys.some(key=>riskKeys.includes(key)));
 return <SectionPanel title="Assessmentmodell und Instrumente" subtitle="Gemeinsam mit diesem Entwurf versioniert">
  <InfoBanner variant="info" title={`${snapshot.model.title} · Version ${snapshot.model.version}`} message={snapshot.model.claim==='product_model'?'CareSuite-eigenes Pflegeassessment. Daraus wird keine SIS-/EinSTEP- oder sonstige externe Standardfreigabe abgeleitet.':'Externes Standardmodell bleibt bis zur nachgewiesenen Lizenz- und Fachfreigabe gesperrt.'}/>
  {query.refreshError?<InfoBanner variant="warning" title="Aktualisierung nicht bestätigt" message={query.refreshError}/>:null}
  {!matching.length?<EmptyState title="Kein verfügbares Instrument zum aktuellen Risikostand" message="Risikobefund und Instrumentenbestand bleiben getrennt; es wird keine Auswahl automatisch erfunden."/>:
   <><Text style={{...typography.body,color:colors.textMuted}}>Aktive, für die dokumentierten Risiken verfügbare Instrumente</Text><FilterChipGroup wrap multiple minSelected={0} options={matching.map(item=>({key:item.id,label:`${item.title} · ${item.version}`}))} value={selected} onChange={editable?setSelected:undefined}/></>}
  {available.filter(item=>!matching.includes(item)).map(item=><InfoBanner key={item.id} variant="warning" title={`${item.title} nicht passend auswählbar`} message="Aktuell fehlt der zugehörige dokumentierte Risikobezug. Das Instrument wird nicht automatisch als Befund übernommen."/>)}
  {unavailable.map(item=><InfoBanner key={item.id} variant="warning" title={`${item.title} · nicht verfügbar`} message={item.licenseState==='unverified'?'Lizenz-/Nutzungsrecht und fachliche Freigabe sind nicht nachgewiesen.':'Diese Fassung ist in diesem Mandanten nicht aktiv verfügbar.'}/>)}
  <PremiumInput label="Pflegefachliche Begründung der Modell- und Instrumentenwahl" value={rationale} onChangeText={setRationale} multiline maxLength={4000} editable={editable}/>
  {computed.issue?<InfoBanner variant="danger" title="Speicher- oder Prüfsperre" message={computed.issue}/>:null}
  <View style={{gap:spacing.xs}}><Text style={{...typography.body,color:colors.textMuted}}>Katalogstand {snapshot.catalogRevision} · gespeicherte Auswahlrevision {snapshot.selection.revision}</Text><Text style={{...typography.body,color:computed.dirty?colors.warning:colors.success}}>{computed.dirty?'Auswahl geändert – wird erst mit dem gesamten Assessment gespeichert.':'Auswahl entspricht dem vollständig gelesenen nativen Stand.'}</Text></View>
  <PremiumButton title="Nativen Instrumentenstand neu laden" variant="ghost" disabled={query.refreshing} loading={query.refreshing} onPress={query.refresh}/>
 </SectionPanel>;
}
