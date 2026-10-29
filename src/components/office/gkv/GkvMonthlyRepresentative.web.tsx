import {useEffect,useRef,useState} from 'react';
import type {RoleKey} from '@/types';
import type {MonthlyProof} from '@/lib/gkvExchange/monthlyProof';
import {AUTHORITY_BASES,authorityAvailable,type MonthlyAuthority,type MonthlyAuthorities,type AuthorityCommand} from '@/lib/gkvExchange/monthlyAuthority';
import {commandMonthlyAuthority} from '@/lib/gkvExchange/repository.web';
type Props={proof:MonthlyProof;roleKey:RoleKey;disabled:boolean;value:MonthlyAuthority|null|undefined;onChange:(value:MonthlyAuthority|null|undefined)=>void;onWorkState:(state:{dirty:boolean;busy:boolean})=>void};
const date=(value:string)=>new Date(value).toLocaleString('de-DE');
export function GkvMonthlyRepresentative({proof,roleKey,disabled,value,onChange,onWorkState}:Props){
 const [data,setData]=useState<MonthlyAuthorities|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [form,setForm]=useState(false),[revoke,setRevoke]=useState<MonthlyAuthority|null>(null),[pending,setPending]=useState<AuthorityCommand|null>(null);
 const mounted=useRef(true),lock=useRef(false),change=useRef(onChange);change.current=onChange;
 const work=useRef(onWorkState);work.current=onWorkState;
 const representative=value!==undefined;
 useEffect(()=>{work.current({dirty:form || !!revoke || !!pending,busy});},[form,revoke,pending,busy]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;work.current({dirty:false,busy:false});};},[]);
 function accept(next:MonthlyAuthorities,command?:AuthorityCommand){
  setData(next);
  if(command?.action==='register')change.current(next.authorities.find(a=>a.id===command.id && authorityAvailable(a,next.checkedAt))??null);
  else if(value && !next.authorities.some(a=>a.id===value.id && authorityAvailable(a,next.checkedAt)))change.current(null);
 }
 async function execute(command:AuthorityCommand){
  if(lock.current || disabled)return;lock.current=true;setBusy(true);setError('');
  if(command.action!=='list')setPending(command);
  try{const next=await commandMonthlyAuthority(proof,roleKey,command);if(!mounted.current)return;
   accept(next,command);if(command.action!=='list'){setPending(null);setForm(false);setRevoke(null);}
   else if(pending && pending.action!=='list'){
    const a=next.authorities.find(a=>a.id===pending.id);
    const applied=pending.action==='revoke'?a?.revocation_reason===pending.reason && !!a.revoked_at
     :a && a.signer_name===pending.signerName && a.basis===pending.basis && a.evidence_reference===pending.evidenceReference
      && a.review_note===pending.reviewNote && Date.parse(a.valid_from)===Date.parse(pending.validFrom) && Date.parse(a.valid_until)===Date.parse(pending.validUntil);
    if(applied){accept(next,pending);setPending(null);setForm(false);setRevoke(null);}
   }
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Die Vertretungsprüfung konnte nicht geladen werden.');}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 useEffect(()=>{if(representative && !data)void execute({action:'list',proofId:proof.id});},[representative]);
 const blocked=disabled || busy || !!pending;
 return <div className="gx-stack gx-representative" aria-busy={busy}>
  <style>{`.gx-representative{min-width:0}.gx-representative label{display:grid;gap:6px;min-width:0}.gx-representative input:not([type=checkbox]),.gx-representative select{width:100%;min-width:0;box-sizing:border-box}.gx-representative .gx-signature-choice{display:flex}.gx-representative fieldset{min-width:0;border:1px solid #b6c5cf;border-radius:12px;padding:14px}.gx-representative .gx-authority-row{border-bottom:1px solid #d7e2e8;padding:12px 0}.gx-representative dl{margin:0}.gx-representative dd{margin:0 0 8px;overflow-wrap:anywhere}.gx-representative dt{font-weight:600}`}</style>
  <label className="gx-field"><span>Wer bestätigt den Monatsnachweis?</span><select value={representative?'representative':'patient'} disabled={blocked || form || !!revoke} onChange={e=>onChange(e.target.value==='patient'?undefined:null)}>
   <option value="patient">Pflegebedürftige Person</option><option value="representative">Berechtigte Vertretung oder Angehörige</option></select></label>
  {representative && <>
   <p>Eine beauftragte Pflegefachperson prüft Identität, Befugnis und Gültigkeit vor der Freigabe. Ein Kontakt in der Klientenakte allein reicht dafür nicht aus.</p>
   {error && <p className="gx-notice" data-tone="error" role="alert">{error}</p>}
   {busy && <p role="status">Vertretungsprüfungen werden geladen …</p>}
   {data && <>
    <label className="gx-field"><span>Geprüfte Vertretung</span><select value={value?.id??''} disabled={blocked} onChange={e=>onChange(data.authorities.find(a=>a.id===e.target.value)??null)}>
     <option value="">Bitte eine gültige Berechtigung wählen</option>
     {data.authorities.filter(a=>authorityAvailable(a,data.checkedAt)).map(a=><option key={a.id} value={a.id}>{a.signer_name} · {a.evidence_reference}</option>)}</select></label>
    {!data.authorities.some(a=>authorityAvailable(a,data.checkedAt)) && <p>Für diese Person und Leistungsart liegt noch keine gültige Vertretungsprüfung vor.</p>}
    {value && <dl><dt>Grundlage</dt><dd>{AUTHORITY_BASES[value.basis]} · {value.evidence_reference}</dd><dt>Gültigkeit</dt><dd>{date(value.valid_from)} bis {date(value.valid_until)}</dd><dt>Dokumentierte Prüfung</dt><dd>{value.review_note}</dd></dl>}
    <details><summary>Prüfungen und Widerrufe ({data.authorities.length})</summary>{data.authorities.map(a=><div key={a.id} className="gx-authority-row"><strong>{a.signer_name}</strong><p>{AUTHORITY_BASES[a.basis]} · {a.evidence_reference}<br/>{date(a.valid_from)} bis {date(a.valid_until)}</p>
     <details><summary>Dokumentierte Prüfung vom {date(a.reviewed_at)}</summary><p>{a.review_note}</p><dl><dt>Prüfkennung</dt><dd>{a.id}</dd><dt>Persönliche Prüferkennung</dt><dd>{a.reviewed_by}</dd></dl></details>
     <p>{a.revoked_at?`Widerrufen am ${date(a.revoked_at)}: ${a.revocation_reason}`:authorityAvailable(a,data.checkedAt)?'Derzeit gültig':'Derzeit außerhalb der Gültigkeit'}</p>
     {data.canManage && !a.revoked_at && <button type="button" disabled={blocked} onClick={()=>{setRevoke(a);setForm(false);}}>Berechtigung von {a.signer_name} widerrufen</button>}</div>)}</details>
    {!data.canManage && <p className="gx-muted">Neue Prüfungen und Widerrufe benötigen zusätzlich die Berechtigung zur Klientenverwaltung.</p>}
   </>}
   <div className="gx-actions"><button type="button" disabled={disabled || busy} onClick={()=>void execute({action:'list',proofId:proof.id})}>{pending?'Gespeicherten Stand prüfen':'Vertretungsprüfungen neu laden'}</button>
    {pending && <><button type="button" disabled={disabled || busy} onClick={()=>void execute(pending)}>Prüfung unverändert wiederholen</button><button type="button" disabled={disabled || busy} onClick={()=>{if(window.confirm('Offenen Prüfauftrag schließen? Eine möglicherweise gespeicherte Prüfung bleibt erhalten. Laden Sie den Stand vor einer neuen Prüfung erneut.')){setPending(null);setForm(false);setRevoke(null);setData(null);onChange(null);setError('');}}}>Offenen Prüfauftrag schließen</button></>}
    {data?.canManage && !form && <button type="button" disabled={blocked} onClick={()=>{setForm(true);setRevoke(null);}}>Vertretungsprüfung dokumentieren</button>}</div>
   {pending && <p role="alert">Die Speicherantwort ist noch ungeklärt. Der Auftrag bleibt für eine unveränderte Wiederholung erhalten.</p>}
   {form && <form onSubmit={e=>{e.preventDefault();if(blocked)return;const f=new FormData(e.currentTarget);
    const from=new Date(String(f.get('from'))),until=new Date(String(f.get('until')));
    if(!Number.isFinite(+from) || !Number.isFinite(+until) || +until<=+from){setError('Bitte einen gültigen Zeitraum angeben.');return;}
    void execute({action:'register',proofId:proof.id,id:crypto.randomUUID(),signerName:String(f.get('name')).trim(),basis:String(f.get('basis')) as MonthlyAuthority['basis'],
     evidenceReference:String(f.get('reference')).trim(),reviewNote:String(f.get('note')).trim(),validFrom:from.toISOString(),validUntil:until.toISOString(),reviewed:true});
   }}><fieldset disabled={blocked} className="gx-stack"><legend>Persönlich geprüfte Berechtigung</legend>
    <label className="gx-field"><span>Name der unterschreibenden Person</span><input name="name" required minLength={2} maxLength={300}/></label>
    <label className="gx-field"><span>Grundlage</span><select name="basis">{Object.entries(AUTHORITY_BASES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label className="gx-field"><span>Belegreferenz in der Klientenakte</span><input name="reference" required minLength={3} maxLength={500}/></label>
    <label className="gx-field"><span>Prüfvermerk zu Identität, Befugnis und Umfang</span><input name="note" required minLength={10} maxLength={1000}/></label>
    <label className="gx-field"><span>Gültig ab</span><input name="from" type="datetime-local" required/></label><label className="gx-field"><span>Gültig bis</span><input name="until" type="datetime-local" required/></label>
    <label className="gx-signature-choice"><input name="reviewed" type="checkbox" required/><span>Ich habe die Identität und die Berechtigung anhand der genannten Unterlage geprüft. Sie umfasst die Bestätigung dieser Leistungsart für {proof.payload.clientName}.</span></label>
    <p className="gx-muted">Die Prüfung wird mit Ihrer persönlichen Anmeldung protokolliert. Änderungen erfordern einen Widerruf und eine neue Prüfung.</p>
    <div className="gx-actions"><button type="submit" className="gx-primary">Geprüfte Berechtigung speichern</button><button type="button" onClick={()=>setForm(false)}>Eingabe schließen</button></div>
   </fieldset></form>}
   {revoke && <form onSubmit={e=>{e.preventDefault();if(!blocked)void execute({action:'revoke',proofId:proof.id,id:revoke.id,reason:String(new FormData(e.currentTarget).get('reason')).trim()});}}>
    <fieldset disabled={blocked} className="gx-stack"><legend>Berechtigung von {revoke.signer_name} widerrufen</legend><label className="gx-field"><span>Grund des Widerrufs</span><input name="reason" required minLength={3} maxLength={1000}/></label>
    <p>Offene Unterschriftserfassungen können danach nicht mehr abgeschlossen werden. Bereits bestätigte Fassungen bleiben mit ihrer damaligen Prüfung im Archiv.</p>
    <div className="gx-actions"><button type="submit">Widerruf speichern</button><button type="button" onClick={()=>setRevoke(null)}>Abbrechen</button></div></fieldset></form>}
  </>}
 </div>;
}
