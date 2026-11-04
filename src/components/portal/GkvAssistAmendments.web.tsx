import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {PremiumButton,InfoBanner} from '@/components/ui';
import {personalAssistRpc} from '@/lib/gkvExchange/assistOriginalClient.web';
import {amendmentHeading,AmendmentRpcError,assertAmendmentResult,loadAmendments,saveAmendment,
 type AmendmentScope,type AmendmentInput,type AmendmentState} from '@/lib/gkvExchange/assistAmendment';

type Job={id:string;input:AmendmentInput};
const stack:CSSProperties={display:'grid',gap:10,minWidth:0,overflowWrap:'anywhere'};
const field:CSSProperties={width:'100%',minWidth:0,boxSizing:'border-box',minHeight:76,padding:10,
  font:'inherit',lineHeight:1.45,color:'#173650',background:'#fff',border:'1px solid #71899b',borderRadius:8,resize:'vertical'};
const body:CSSProperties={margin:0,whiteSpace:'pre-wrap'};
const panel:CSSProperties={...stack,borderTop:'1px solid #cedae2',paddingTop:14,color:'#173650',lineHeight:1.5};
const message=(e:unknown)=>e instanceof Error?e.message:'Der Berichtigungsstand ist nicht bestätigt.';

export function GkvAssistAmendments({scope,disabled}:{scope:AmendmentScope;disabled:boolean}){
 const [state,setState]=useState<AmendmentState|null>(null),[editing,setEditing]=useState(false),[hidden,setHidden]=useState(false);
 const [description,setDescription]=useState(''),[reason,setReason]=useState(''),[reviewed,setReviewed]=useState(false);
 const [pending,setPending]=useState<Job|null>(null),[retry,setRetry]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const active=useRef(false),flight=useRef(false);
 const locked=disabled||busy;
 const current=state?.entries[0]?.description??state?.originalText??'';
 async function run(work:()=>Promise<void>){
  if(flight.current)return;flight.current=true;setBusy(true);setError('');
  try{await work();}catch(e){if(active.current)setError(message(e));}
  finally{flight.current=false;if(active.current)setBusy(false);}
 }
 async function loadHead(){
  const s=await loadAmendments(await personalAssistRpc(scope),scope);
  if(!active.current)return;
  setState(s);setHidden(!s);setEditing(false);setReviewed(false);setDescription('');setReason('');
 }
 useEffect(()=>{active.current=true;void run(loadHead);return()=>{active.current=false;};},[scope.tenantId,scope.assignmentId,scope.actorId,scope.employeeId,scope.proofId,scope.proofHash]);
 async function write(job:Job){
  if(disabled)return;
  setRetry(false);setPending(job);setNotice('');
  try{await saveAmendment(await personalAssistRpc(scope),scope,job.id,job.input);}
  catch(e){if(!active.current)return;
   if(e instanceof AmendmentRpcError&&!e.uncertain){setPending(null);setReviewed(false);throw e;}
   setError('Die Speicherantwort ist unklar. Bitte zuerst den gespeicherten Auftrag prüfen.');return;
  }
  if(!active.current)return;setPending(null);setState(null);setEditing(false);setNotice('Die Berichtigung wurde gespeichert.');
  await loadHead();
 }
 async function check(job:Job){
  const s=await loadAmendments(await personalAssistRpc(scope),scope,null,job.id);if(!active.current)return;
  if(!s)throw Error('Gespeicherter Auftrag konnte nicht geprüft werden.');
  setState(s);
  if(s.lookup){assertAmendmentResult(s.lookup,scope,job.id,job.input);setPending(null);setRetry(false);setEditing(false);setReviewed(false);
   setNotice('Die Berichtigung ist gespeichert. Es wurde kein zweiter Auftrag gesendet.');}
  else if(s.revision===job.input.revision&&(s.entries[0]?.id??null)===job.input.previousId){setRetry(true);setNotice('Der Auftrag wurde nicht gefunden. Sie können ihn unverändert erneut senden.');}
  else{setPending(null);setRetry(false);setEditing(false);setReviewed(false);setNotice('Der Auftrag wurde nicht gefunden. Der Verlauf hat sich geändert. Bitte die aktuelle Fassung prüfen.');}
 }
 async function older(){
  const cursor=state?.nextBefore;if(!state||!cursor)return;
  const s=await loadAmendments(await personalAssistRpc(scope),scope,cursor);if(!active.current)return;
  if(!s||s.revision!==state.revision||state.entries.at(-1)?.previousId!==s.entries[0]?.id){await loadHead();if(active.current)setNotice('Der Verlauf hat sich geändert und wurde neu geladen.');return;}
  setState({...state,entries:[...state.entries,...s.entries],nextBefore:s.nextBefore});
 }
 if(hidden||!state&&!error&&!notice)return null;
 return <section aria-label="Berichtigung der Leistungsbeschreibung" style={panel}>
  <strong>Leistungsbeschreibung berichtigen</strong>
  {state&&<><p style={body}>{state.revision?'Der Verlauf enthält die ursprüngliche Beschreibung und alle späteren Berichtigungen.':'Die ursprünglich unterschriebene Beschreibung bleibt erhalten. Sie können einen Fehler im Text mit Begründung berichtigen.'}</p>
   <details><summary style={{cursor:'pointer'}}>Original und Verlauf ansehen{state.revision?' ('+state.revision+')':''}</summary>
    <div style={{...stack,marginTop:8}}><div><strong>Ursprünglich unterschrieben</strong><p style={body}>{state.originalText}</p></div>
    {state.entries.map(a=><article key={a.id}><strong>{amendmentHeading(a)}</strong><p style={body}>{a.description}</p><p style={body}>Begründung: {a.reason}</p></article>)}
    {state.nextBefore&&<PremiumButton title="Ältere Berichtigungen laden" variant="secondary" disabled={locked||!!pending} onPress={()=>void run(older)}/>}</div>
   </details>
   {!editing&&!pending&&<PremiumButton title="Beschreibung berichtigen" variant="secondary" disabled={locked} onPress={()=>{setDescription(current);setReason('');setReviewed(false);setEditing(true);setError('');setNotice('');}}/>}
   {editing&&<div style={stack}><label style={stack}>Berichtigte Leistungsbeschreibung<textarea style={field} maxLength={1500} value={description} disabled={locked||!!pending} onChange={e=>{setDescription(e.target.value);setReviewed(false);}}/></label>
    <label style={stack}>Grund der Berichtigung<textarea style={field} maxLength={400} value={reason} disabled={locked||!!pending} onChange={e=>{setReason(e.target.value);setReviewed(false);}}/></label>
    <label style={{display:'flex',alignItems:'flex-start',gap:8}}><input type="checkbox" checked={reviewed} disabled={locked||!!pending} onChange={e=>setReviewed(e.target.checked)}/>
     <span>Ich habe den Text geprüft. Eine bereits bestätigte Monatsfassung wird entwertet und muss neu unterschrieben werden.</span></label>
    {!pending&&<><PremiumButton title="Berichtigung speichern" disabled={locked||!reviewed||description.trim().length<3||description.trim()===current||reason.trim().length<5}
     onPress={()=>{const job={id:crypto.randomUUID(),input:{proofId:scope.proofId,proofHash:scope.proofHash,revision:state.revision,previousId:state.entries[0]?.id??null,description:description.trim(),reason:reason.trim()}};void run(()=>write(job));}}/>
     <PremiumButton title="Bearbeitung verwerfen" variant="secondary" disabled={locked} onPress={()=>{setEditing(false);setReviewed(false);setError('');}}/></>}
   </div>}
  </>}
  {pending&&<><PremiumButton title="Speicherung prüfen" variant="secondary" disabled={locked} onPress={()=>void run(()=>check(pending))}/>
   {retry&&<PremiumButton title="Unverändert erneut senden" disabled={locked} onPress={()=>void run(()=>write(pending))}/>}</>}
  {notice&&<p style={body} role="status">{notice}</p>}
  {error&&<><InfoBanner variant="error" message={error}/>{!pending&&<PremiumButton title="Berichtigungsstand neu laden" variant="secondary" disabled={locked} onPress={()=>void run(loadHead)}/>}</>}
 </section>;
}
