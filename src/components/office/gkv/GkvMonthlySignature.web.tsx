import {GkvMonthlyPaper} from './GkvMonthlyPaper.web';
import {GkvMonthlyRepresentative} from './GkvMonthlyRepresentative.web';
import type {MonthlyAuthority} from '@/lib/gkvExchange/monthlyAuthority';
import {useEffect,useRef,useState} from 'react';
import type {RoleKey} from '@/types';
import {CareSignatureCanvas} from '@/components/inputs/CareSignatureCanvas.web';
import type {MonthlyProof} from '@/lib/gkvExchange/monthlyProof';
import {MonthlyCaptureSession} from '@/lib/gkvExchange/monthlyCapture';
import {monthlyBase64,type MonthlyOriginalReceipt,type MonthlyOriginalResponse} from '@/lib/gkvExchange/monthlyOriginalContract';
import {requestMonthlyOriginal} from '@/lib/gkvExchange/repository.web';
type Original=Extract<MonthlyOriginalResponse,{kind:'original'}>;
type Props={proof:MonthlyProof;roleKey:RoleKey;canSign:boolean;disabled:boolean;
  onWorkState:(state:{dirty:boolean;busy:boolean})=>void;onConfirm:(receipt:MonthlyOriginalReceipt)=>Promise<void>};
const css=`.gx-signature{min-width:0}.gx-signature iframe{display:block;width:100%;height:min(70vh,720px);min-height:320px;border:1px solid var(--gx-border,#cbd5e1);border-radius:12px;background:#fff}.gx-signature .gx-signature-choice{display:flex;align-items:flex-start;gap:12px;line-height:1.55}.gx-signature-choice input{flex:0 0 auto;margin-top:5px}.gx-signature .gx-actions{display:flex;gap:10px;flex-wrap:wrap}.gx-signature .gx-actions button{white-space:normal;overflow-wrap:anywhere}.gx-signature p,.gx-signature a{overflow-wrap:anywhere}.gx-signature-pad{min-width:0;max-width:100%;border:1px solid #b6c5cf;border-radius:12px;padding:12px;background:#f7fafc}@media(max-width:600px){.gx-signature .gx-actions>*{flex:1 1 100%}.gx-signature iframe{height:55vh;min-height:280px}.gx-signature-pad{padding:8px}}`;
function OriginalViewer({original,onOpened,title='Originalfassung des Monatsnachweises',label='Original als PDF öffnen'}:{original:Pick<Original,'pdfBase64'>;onOpened?:()=>void;title?:string;label?:string}){
  const [url,setUrl]=useState('');const callback=useRef(onOpened);callback.current=onOpened;
  useEffect(()=>{const next=URL.createObjectURL(new Blob([new Uint8Array(monthlyBase64(original.pdfBase64))],{type:'application/pdf'}));setUrl(next);return()=>URL.revokeObjectURL(next);},[original.pdfBase64]);
  return <div className="gx-stack"><iframe title={title} src={url || undefined} onLoad={()=>{if(url)callback.current?.();}} />
    {url && <p><a href={url} target="_blank" rel="noopener noreferrer" onClick={()=>callback.current?.()}>{label}</a> · Bitte alle Seiten prüfen.</p>}</div>;
}
export function GkvMonthlySignature(props:Props){
  return <MonthlySignaturePanel key={`${props.proof.id}:${props.proof.revision}:${props.canSign}`} {...props}/>;
}
function MonthlySignaturePanel({proof,roleKey,canSign,disabled,onWorkState,onConfirm}:Props){
  const [method,setMethod]=useState<'canvas'|'paper'>('canvas'),[resumeId,setResumeId]=useState('');
  const [archivedScan,setArchivedScan]=useState<Extract<MonthlyOriginalResponse,{kind:'archived-scan'}>|null>(null);
  const [authority,setAuthority]=useState<MonthlyAuthority|null|undefined>(undefined),[authorityWork,setAuthorityWork]=useState({dirty:false,busy:false});
  const [capture,setCapture]=useState<MonthlyCaptureSession|null>(null),[archive,setArchive]=useState<Original|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[opened,setOpened]=useState(false),[reviewed,setReviewed]=useState(false);
  const [,render]=useState(0),mounted=useRef(true),lock=useRef(false),controller=useRef<AbortController|null>(null);
  const work=useRef(onWorkState);work.current=onWorkState;
  const paperUnavailable=!!proof.payload.xmlFacts && !authority;
  useEffect(()=>{mounted.current=true;controller.current=new AbortController();return()=>{mounted.current=false;controller.current?.abort();controller.current=null;work.current({dirty:false,busy:false});};},[]);
  useEffect(()=>{work.current({dirty:!!capture || authorityWork.dirty,busy:busy || !!capture?.pending || authorityWork.busy});},[capture,busy,capture?.pending,authorityWork]);
  const request=(command:Parameters<typeof requestMonthlyOriginal>[2])=>{
    if(!mounted.current || !controller.current)throw Error('Die Erfassung wurde geschlossen.');
    return requestMonthlyOriginal(proof.tenant_id,roleKey,command,controller.current.signal);
  };
  async function run(action:()=>Promise<unknown>){
    if(lock.current || disabled)return;lock.current=true;setBusy(true);setError('');
    try{await action();}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Die Erfassung konnte nicht abgeschlossen werden.');}
    finally{lock.current=false;if(mounted.current){setBusy(false);render(n=>n+1);}}
  }
  function start(resume=false){
    if(!canSign || capture || disabled || lock.current || authority===null || authorityWork.dirty || authorityWork.busy || method==='paper' && paperUnavailable)return;
    const next=new MonthlyCaptureSession({tenantId:proof.tenant_id,proofId:proof.id,revision:proof.revision,captureId:resume?resumeId.trim().toLowerCase():crypto.randomUUID(),...(method==='paper'?{method:'paper' as const}:{}),...(authority?{authorityId:authority.id}:{})},proof.content_sha256,request);
    setCapture(next);setOpened(false);setReviewed(false);void run(()=>resume?next.resume():next.prepare());
  }
  const final=proof.status!=='open';
  if(final && proof.confirmation?.kind!=='signature')return null;
  if(!final && !canSign)return null;
  const original=capture?.original || archive;
  const signer=capture?.original?.original.representative?.signer_name ?? authority?.signer_name ?? proof.payload.clientName;
  return <section className="gx-card gx-stack gx-signature" aria-label={final?'Archiviertes PDF-Original':'Persönliche Monatsbestätigung'} aria-busy={busy}>
    <style>{css}</style><div><h3>{final?'Archiviertes PDF-Original':'Monatsnachweis persönlich bestätigen'}</h3>
    <p className="gx-muted">{final?'Die PDF zeigt die vor der Unterschrift geprüfte Fassung. Ihren aktuellen Bestätigungsstatus sehen Sie darunter.':authority===null?'Bitte eine gültige Vertretungsberechtigung auswählen, bevor die Originalfassung geöffnet wird.':`${signer} bestätigt ausschließlich diese Leistungsart und Fassung. Eine neue persönliche Unterschrift ist erforderlich.`}</p></div>
    {error && <p className="gx-notice" data-tone="error" role="alert">{error}</p>}
    {busy && <p role="status">Original und Erfassungsstand werden geprüft …</p>}
    {final && <><p className="gx-notice" data-tone={proof.status==='invalidated'?'error':undefined}>{proof.status==='invalidated'?'Diese Fassung wurde durch eine Korrektur ungültig.':'Diese Fassung ist bestätigt.'}</p>
      <button type="button" disabled={disabled || busy} onClick={()=>void run(async()=>{
        if(proof.confirmation?.kind!=='signature')return;
        const result=await request({tenantId:proof.tenant_id,proofId:proof.id,revision:proof.revision,captureId:proof.confirmation.captureId,action:'archive'});
        if(result.kind!=='original' || result.original.contentSha256!==proof.content_sha256 || result.original.originalSha256!==proof.confirmation.originalSha256
          || result.archive?.status!==proof.status)throw Error('Das Archivoriginal passt nicht zu dieser Fassung. Bitte die Monatsnachweise neu laden.');
        if(mounted.current)setArchive(result);
      })}>{archive?'Archivoriginal erneut lesen':'Archivoriginal öffnen'}</button></>}
    {!final && <GkvMonthlyRepresentative proof={proof} roleKey={roleKey} disabled={disabled || busy || !!capture} value={authority} onChange={setAuthority} onWorkState={setAuthorityWork}/>}
    {!final && !capture && <div className="gx-stack"><fieldset disabled={disabled || busy || authorityWork.dirty || authorityWork.busy}><legend>Wie wird unterschrieben?</legend>
      <label className="gx-signature-choice"><input type="radio" name="monthly-method" checked={method==='canvas'} onChange={()=>setMethod('canvas')}/><span>Direkt am Bildschirm unterschreiben</span></label>
      <label className="gx-signature-choice"><input type="radio" name="monthly-method" disabled={paperUnavailable} checked={method==='paper'} onChange={()=>setMethod('paper')}/><span>Ausdrucken und unterschrieben einscannen</span></label></fieldset>
      {paperUnavailable && <p className="gx-muted">Für diesen Leistungsnachweis ist der Papierweg derzeit nur für eine geprüfte Vertretung verfügbar. Die pflegebedürftige Person kann direkt am Bildschirm unterschreiben.</p>}
      <button type="button" className="gx-primary" disabled={disabled || busy || authority===null || authorityWork.dirty || authorityWork.busy || method==='paper' && paperUnavailable} onClick={()=>start()}>{method==='paper'?'Neue Druckfassung öffnen':'Original zur Bestätigung öffnen'}</button>
      {method==='paper' && <details><summary>Bereits ausgegebene Druckfassung fortsetzen</summary><p>Die Erfassungskennung steht auf jeder gedruckten Seite. Fortsetzen ist innerhalb von sieben Tagen mit derselben persönlichen Anmeldung und unverändertem Monatsnachweis möglich. Bei Vertretung dieselbe geprüfte Berechtigung auswählen.</p>
        <label className="gx-stack"><span>Erfassungskennung auf dem Ausdruck</span><input value={resumeId} disabled={disabled || busy} onChange={e=>setResumeId(e.target.value)} autoComplete="off"/></label>
        <button type="button" disabled={disabled || busy || !resumeId.trim() || authority===null || authorityWork.dirty || authorityWork.busy || paperUnavailable} onClick={()=>start(true)}>Druckfassung fortsetzen</button></details>}
    </div>}
    {original && <OriginalViewer original={original} onOpened={()=>setOpened(true)}/>}
    {final && proof.confirmation?.kind==='signature' && proof.confirmation.paper && <button type="button" disabled={disabled || busy} onClick={()=>void run(async()=>{
      if(proof.confirmation?.kind!=='signature' || !proof.confirmation.paper)return;
      const result=await request({tenantId:proof.tenant_id,proofId:proof.id,revision:proof.revision,captureId:proof.confirmation.captureId,action:'archive-scan'});
      if(result.kind!=='archived-scan'||result.status!==proof.status||result.paper.scanSha256!==proof.confirmation.paper.scanSha256)throw Error('Der Scan passt nicht zur archivierten Fassung.');
      if(mounted.current)setArchivedScan(result);
    })}>Unterschriebenen Archivscan öffnen</button>}
    {archivedScan && <OriginalViewer original={archivedScan} title="Archivierter unterschriebener Scan" label="Vollständigen Archivscan als PDF öffnen"/>}

    {capture?.pending && !busy && <div className="gx-subtle" role="alert"><h4>Erfassungsantwort noch offen</h4><p>Prüfen Sie zuerst den gespeicherten Stand. Die Abfrage übermittelt keine neue Unterschrift und bestätigt keinen Monatsnachweis.</p><div className="gx-actions">
      <button type="button" disabled={disabled} onClick={()=>void run(()=>capture.check())}>Erfassung prüfen</button>
      {capture.checked && <button type="button" disabled={disabled} onClick={()=>void run(()=>capture.retry())}>Erfassung unverändert wiederholen</button>}
    </div></div>}
    {capture?.original && !capture.pending && !capture.receipt && !capture.original.original.acknowledged && <>
      <label className="gx-signature-choice"><input type="checkbox" checked={reviewed} disabled={disabled || busy || !opened} onChange={e=>setReviewed(e.target.checked)}/><span>{method==='paper'?'Ich habe alle Seiten dieser Druckfassung geprüft und werde genau diese Fassung zur persönlichen Unterschrift ausgeben.':`${signer} hat die angezeigte Originalfassung einschließlich aller Seiten geprüft und möchte sie persönlich unterschreiben.`}</span></label>
      <button type="button" className="gx-primary" disabled={disabled || busy || !opened || !reviewed} onClick={()=>void run(()=>capture.acknowledge())}>{method==='paper'?'Druckfassung geprüft, Scan erfassen':'Geprüft, Unterschrift erfassen'}</button></>}
    {capture?.original?.original.acknowledged && !busy && !capture.pending && !capture.receipt && !capture.original.original.paper && <div className="gx-stack"><p>Unterschrift von {signer}: Bitte mit Stift, Finger oder Maus neu unterschreiben.</p>
      <div className="gx-signature-pad"><CareSignatureCanvas label={`Unterschrift von ${signer}`} showLabel={false} size="large" height={200} disabled={disabled || busy}
        renderActions={({disabled:blocked,hasStroke,onClear,onConfirm:save})=><div className="gx-actions"><button type="button" disabled={blocked} onClick={onClear}>Unterschrift löschen</button><button type="button" className="gx-primary" disabled={blocked || !hasStroke} onClick={save}>Unterschrift prüfen und übernehmen</button></div>}
        onConfirm={data=>{if(!data.startsWith('data:image/png;base64,')){setError('Die Unterschrift konnte nicht als PNG erfasst werden.');return;}void run(()=>capture.verify(data.slice(22)));}}/></div></div>}
    {capture?.original?.original.paper && capture.original.original.acknowledged && !capture.pending && !capture.receipt && <GkvMonthlyPaper capture={capture} disabled={disabled || busy} run={run}/>}
    {capture?.receipt && !capture.pending && <div className="gx-subtle"><p>Der Nachweis und die persönliche Bestätigung wurden gespeichert und geprüft. Der Monatsnachweis wird erst mit dem nächsten Schritt endgültig bestätigt.</p>
      <button type="button" className="gx-primary" disabled={disabled || busy} onClick={()=>void run(()=>onConfirm(capture.receipt!))}>Monatsbestätigung speichern</button></div>}
    {capture && <button type="button" disabled={disabled || busy} onClick={()=>{if(window.confirm('Diese Erfassung schließen? Ein bereits erteilter Prüfbeleg bleibt im Archiv. Dadurch wird kein Monatsnachweis bestätigt oder zurückgenommen.')){setCapture(null);setOpened(false);setReviewed(false);setError('');}}}>Erfassung schließen</button>}
  </section>;
}
