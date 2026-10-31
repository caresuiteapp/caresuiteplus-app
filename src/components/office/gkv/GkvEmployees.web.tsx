import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/auth/context';
import {useServiceTenantId} from '@/hooks/useTenantId';
import {useGkvUnsavedChanges} from '@/hooks/useGkvUnsavedChanges.web';
import {EMPLOYEE_REGISTRATION_STATES,EmployeeWriter,employeeValidUntil,type EmployeeRegistration,type EmployeeCommand,type EmployeeWorkspace} from '@/lib/gkvExchange/monthlyEmployees';
import {loadEmployeeRegistrations,commandEmployeeRegistration,employeeRequestStatus} from '@/lib/gkvExchange/monthlyEmployeeClient.web';
import {gkvExchangeCss} from '@/screens/office/gkvExchangeStyles.web';
type Work={dirty:boolean;busy:boolean};
type Props={tenantId:string;actorId:string;selfOnly?:boolean;onWorkState:(s:Work)=>void;disabled?:boolean};
const when=(s:string)=>new Date(s).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'});
const defaultUntil=()=>new Date(Date.now()+90*86400000).toISOString().slice(0,10);
export function GkvEmployeePanel(props:Props){return <EmployeePanel key={`${props.tenantId}:${props.actorId}`} {...props}/>;}
function EmployeePanel({tenantId,actorId,selfOnly=false,onWorkState,disabled=false}:Props){
 const [workspace,setWorkspace]=useState<EmployeeWorkspace|null>(null),[number,setNumber]=useState(''),[evidence,setEvidence]=useState('');
 const [selected,setSelected]=useState<EmployeeRegistration|null>(null),[reference,setReference]=useState(''),[note,setNote]=useState(''),[until,setUntil]=useState(defaultUntil),[reviewed,setReviewed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const live=useRef(true),running=useRef(false),callback=useRef(onWorkState);callback.current=onWorkState;
 const [writer]=useState(()=>new EmployeeWriter({execute:(c,id)=>commandEmployeeRegistration(tenantId,actorId,c,id),status:id=>employeeRequestStatus(tenantId,actorId,id)},()=>crypto.randomUUID()));
 const dirty=!!number||!!evidence||!!selected||!!writer.pending;
 const locked=disabled||busy||!!writer.pending;
 useEffect(()=>{callback.current({dirty,busy:busy||!!writer.pending});},[dirty,busy,writer.pending]);
 useEffect(()=>{live.current=true;void run(()=>reload());return()=>{live.current=false;callback.current({dirty:false,busy:false});};},[]);
 async function run(action:()=>Promise<void>){if(running.current||disabled)return;running.current=true;setBusy(true);setError('');setNotice('');
  try{await action();}catch(e){if(live.current)setError(e instanceof Error?e.message:'Der gespeicherte Stand konnte nicht geladen werden.');}
  finally{running.current=false;if(live.current)setBusy(false);}}
 async function reload(more=false){const page=await loadEmployeeRegistrations(tenantId,actorId,more?workspace?.nextCursor:null);
  if(live.current)setWorkspace(old=>more&&old?{...page,items:[...old.items,...page.items.filter(r=>!old.items.some(o=>o.id===r.id))]}:page);}
 function reset(){setNumber('');setEvidence('');setSelected(null);setReference('');setNote('');setUntil(defaultUntil());setReviewed(false);}
 async function saved(r:EmployeeRegistration){if(!live.current)return;reset();setWorkspace(old=>old?{...old,items:[...old.items.filter(i=>i.id!==r.id),r].sort((a,b)=>a.id.localeCompare(b.id))}:old);setNotice(`Gespeichert: ${EMPLOYEE_REGISTRATION_STATES[r.state]}.`);}
 async function write(c:EmployeeCommand){await saved(await writer.submit(c));}
 const items=workspace?.items.filter(r=>!selfOnly||r.actor_id===actorId)||[];
 const active=rActive(workspace?.checkedAt??new Date().toISOString());
 return <section className="gx gx-stack" aria-label={selfOnly?'Meine GKV-Beschäftigtennummer':'GKV-Beschäftigtennummern'} aria-busy={busy}>
  <style>{gkvExchangeCss}</style>
  <header className="gx-card-title"><div><h2>{selfOnly?'Meine GKV-Beschäftigtennummer':'GKV-Beschäftigtennummern'}</h2><p>Persönlich melden, unabhängig prüfen und für neue Leistungsnachweise verwenden.</p></div>
   <button type="button" disabled={locked||dirty} onClick={()=>void run(()=>reload())}>Stand aktualisieren</button></header>
  {error&&<p className="gx-notice" data-tone="error" role="alert">{error}</p>}{notice&&<p className="gx-notice" role="status">{notice}</p>}
  {writer.pending&&<section className="gx-card gx-stack" aria-label="Offener Beschäftigtenauftrag"><p>Die Speicherung ist noch ungeklärt. Prüfen Sie zuerst den gespeicherten Auftrag.</p><div className="gx-actions">
   <button type="button" disabled={busy||disabled} onClick={()=>void run(async()=>{const r=await writer.check();if(r.state==='applied')await saved(r.registration);else setNotice('Der Auftrag ist noch nicht gespeichert. Er kann unverändert erneut gesendet werden.');})}>Auftragsstatus prüfen</button>
   {writer.checkedNotFound&&<button type="button" disabled={busy||disabled} onClick={()=>void run(async()=>saved(await writer.retry()))}>Unverändert erneut senden</button>}
  </div></section>}
  {!workspace? <p className="gx-muted">{busy?'Zuordnung wird geladen …':'Noch kein gespeicherter Stand geladen.'}</p>:<>
   {workspace.employeeId&&<form className="gx-card gx-stack" onSubmit={e=>{e.preventDefault();if(!locked)void run(()=>write({action:'submit',input:{id:crypto.randomUUID(),employeeNumber:number.trim(),evidenceReference:evidence.trim()}}));}}>
    <h3>Eigene Nummer melden</h3><p>{workspace.employeeName} · Verwenden Sie die vergebene GKV-Beschäftigtennummer und eine Referenz auf den zugehörigen Nachweis.</p>
    <fieldset disabled={locked||!!selected} style={{border:0,padding:0,margin:0,minWidth:0}} className="gx-stack">
     <label className="gx-field">GKV-Beschäftigtennummer<input value={number} onChange={e=>setNumber(e.target.value)} inputMode="numeric" autoComplete="off" pattern="[0-9]{9}" maxLength={9} required/></label>
     <label className="gx-field">Referenz auf den Nummernnachweis<input value={evidence} onChange={e=>setEvidence(e.target.value)} minLength={3} maxLength={500} required/></label>
     <div className="gx-actions"><button type="submit" className="gx-primary" disabled={!/^\d{9}$/.test(number.trim())||evidence.trim().length<3||workspace.items.some(r=>r.employee_id===workspace.employeeId&&r.state==='pending')}>Zur Prüfung melden</button>
      {(number||evidence)&&<button type="button" onClick={reset}>Eingaben verwerfen</button>}</div>
    </fieldset><p className="gx-muted">Eine beauftragte zweite Person prüft Nummer, Person und Nachweis. Interne Personalnummern werden nicht übernommen.</p>
   </form>}
   {!workspace.employeeId&&<p className="gx-subtle">Für eine eigene Meldung muss Ihr persönliches Konto eindeutig einer aktiven Mitarbeitendenakte zugeordnet sein.</p>}
   <section className="gx-stack" aria-label="Gespeicherte Nummernmeldungen"><h3>{selfOnly?'Meine Meldungen':'Meldungen und Prüfstand'}</h3>
    {!items.length&&<p className="gx-card">Noch keine Meldungen vorhanden.</p>}
    {items.map(r=><article className="gx-card gx-stack" key={r.id}><div className="gx-card-title"><h4>{r.employee_name} · {r.employee_number}</h4><span className="gx-badge">{r.state==='approved'&&!active(r)?'Gültigkeit abgelaufen':EMPLOYEE_REGISTRATION_STATES[r.state]}</span></div>
     <p className="gx-filename">Nachweis: {r.evidence_reference}</p><p className="gx-muted">Gemeldet am {when(r.submitted_at)}{r.valid_until?` · Gültig bis ${when(r.valid_until)}`:''}</p>
     {r.review_reference&&<p className="gx-filename">Prüfbeleg: {r.review_reference} · {r.review_note}</p>}{r.close_reason&&<p>Begründung: {r.close_reason}</p>}
     {(r.state==='pending'&&(r.actor_id===actorId||!selfOnly&&workspace.canReview)||r.state==='approved'&&!selfOnly&&workspace.canReview&&r.actor_id!==actorId)&&<button type="button" disabled={locked||!!number||!!evidence||!!selected} onClick={()=>{setSelected(r);setReference('');setNote('');setReviewed(false);}}>Meldung bearbeiten</button>}
    </article>)}
    {workspace.nextCursor&&<button type="button" disabled={locked||dirty} onClick={()=>void run(()=>reload(true))}>Weitere Meldungen laden</button>}
   </section>
   {selected&&<section className="gx-card gx-stack" aria-label="Meldung prüfen"><h3>{selected.employee_name} · {selected.employee_number}</h3>
    <fieldset disabled={locked} style={{border:0,padding:0,margin:0,minWidth:0}} className="gx-stack">
     {selected.actor_id!==actorId&&selected.state==='pending'&&<><label className="gx-field">Referenz auf den geprüften Nachweis<input value={reference} onChange={e=>setReference(e.target.value)} maxLength={500}/></label>
      <label className="gx-field">Gültig bis einschließlich<input type="date" value={until} onChange={e=>setUntil(e.target.value)}/></label>
      <label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> Ich habe Nummer und Person anhand des Nachweises unabhängig geprüft.</label></>}
     <label className="gx-field">Prüfvermerk oder Begründung<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} rows={3}/></label>
     <div className="gx-actions">
      {selected.actor_id!==actorId&&selected.state==='pending'&&<button type="button" className="gx-primary" disabled={!reviewed||reference.trim().length<3||note.trim().length<3||!until} onClick={()=>void run(()=>write({action:'approve',input:{id:selected.id,revision:selected.revision,reviewReference:reference.trim(),reviewNote:note.trim(),validUntil:employeeValidUntil(until),reviewed:true}}))}>Zuordnung freigeben</button>}
      <button type="button" disabled={note.trim().length<3} onClick={()=>void run(()=>write({action:selected.actor_id===actorId?'withdraw':selected.state==='approved'?'revoke':'reject',input:{id:selected.id,revision:selected.revision,reason:note.trim()}}))}>{selected.actor_id===actorId?'Meldung zurückziehen':selected.state==='approved'?'Zuordnung widerrufen':'Meldung ablehnen'}</button>
      <button type="button" onClick={reset}>Bearbeitung schließen</button>
     </div>
    </fieldset>
   </section>}
  </>}
 </section>;
}
const rActive=(at:string)=>(r:EmployeeRegistration)=>r.state==='approved'&&!!r.valid_from&&!!r.valid_until&&Date.parse(r.valid_from)<=Date.parse(at)&&Date.parse(r.valid_until)>Date.parse(at);

/** Web-only, scoped to the authenticated account. Mounted lazily from a profile;
 * the Office panel supplies its own navigation guard through onWorkState. */
export function GkvEmployeeSelf(){
 const auth=useAuth(),tenantId=useServiceTenantId(),[open,setOpen]=useState(false),[work,setWork]=useState<Work>({dirty:false,busy:false});
 const leave=useGkvUnsavedChanges(work.dirty,work.busy);
 if(!auth.authReady||!auth.isAuthenticated||!auth.user?.id||!tenantId||auth.portalSession&&auth.portalSession.loginType!=='employee_portal')return null;
 return <section className="gx gx-card gx-stack"><style>{gkvExchangeCss}</style><div className="gx-card-title"><h3>GKV-Beschäftigtennummer</h3><button type="button" disabled={work.busy} onClick={()=>{if(!open||leave.confirmLeave())setOpen(!open);}}>{open?'Bereich schließen':'Eigene Zuordnung öffnen'}</button></div>
  {open&&<GkvEmployeePanel tenantId={tenantId} actorId={auth.user.id} selfOnly onWorkState={setWork}/>}</section>;
}
