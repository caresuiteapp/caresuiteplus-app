import {useEffect,useRef,useState} from 'react';
import type {MonthlyCaptureSession} from '@/lib/gkvExchange/monthlyCapture';
import {MONTHLY_FILE_LIMIT,monthlyBase64,type MonthlyOriginalResponse} from '@/lib/gkvExchange/monthlyOriginalContract';
import {readPaperBox,type PaperBox} from '@/lib/gkvExchange/monthlyPaper';

type Page=Extract<MonthlyOriginalResponse,{kind:'scan-page'}>;
type Props={capture:MonthlyCaptureSession;disabled:boolean;run:(action:()=>Promise<unknown>)=>Promise<void>};
const css=`.gx-paper-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr));gap:12px}.gx-paper-grid label{display:grid;gap:6px;min-width:0}.gx-paper-grid input{box-sizing:border-box;width:100%;min-width:0}.gx-paper-page{position:relative;max-width:900px;background:#fff;border:1px solid #b6c5cf}.gx-paper-page img{display:block;width:100%;height:auto}.gx-paper-box{position:absolute;border:2px solid #9f1239;box-sizing:border-box;pointer-events:none}.gx-paper-crop{position:relative;overflow:hidden;width:100%;max-width:700px;background:white;border:1px solid #b6c5cf}.gx-paper-crop img{position:absolute;max-width:none;height:auto}.gx-paper input[type=file]{max-width:100%;white-space:normal}.gx-paper code{overflow-wrap:anywhere}`;
export function GkvMonthlyPaper({capture,disabled,run}:Props){
  const paper=capture.original!.original.paper!,scan=capture.scan;
  const [page,setPage]=useState<Page|null>(null),[url,setUrl]=useState(''),[loaded,setLoaded]=useState(false);
  const [reviewed,setReviewed]=useState<Record<number,string>>({}),[box,setBox]=useState<PaperBox>(paper.signatureBox);
  const [signedAt,setSignedAt]=useState(''),[confirmed,setConfirmed]=useState(false);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    setLoaded(false);if(!page){setUrl('');return;}
    const next=URL.createObjectURL(new Blob([new Uint8Array(monthlyBase64(page.pngBase64))],{type:'image/png'}));setUrl(next);
    return()=>URL.revokeObjectURL(next);
  },[page]);
  const all=!!scan && scan.pages.every((p,i)=>reviewed[i+1]===p.sha256);
  const validBox=(()=>{try{readPaperBox(box,paper.pageCount);return true;}catch{return false;}})();
  const validTime=Number.isFinite(Date.parse(signedAt)) && Date.parse(signedAt)>=Date.parse(paper.preparedAt) && Date.parse(signedAt)<=Date.now();
  const changeBox=(key:'x'|'y'|'width'|'height',value:string)=>{setBox(b=>({...b,[key]:Math.round(Number(value)*10)}));setConfirmed(false);};
  return <div className="gx-stack gx-paper"><style>{css}</style>
    <p>Alle {paper.pageCount} Seiten ausdrucken, persönlich unterschreiben lassen und zusammen als eine PDF scannen. Erfassung: <code>{capture.input.captureId}</code></p>
    <p className="gx-muted">Der Scan muss dieselbe Person, Leistungsart, Fassung und Erfassungskennung enthalten. Maximal 20 Seiten und 2 MiB, ohne Kennwort, Formulare oder Anmerkungen. Die Erfassung bleibt höchstens sieben Tage gültig.</p>
    {!scan && <label className="gx-stack"><span>Vollständigen unterschriebenen Scan auswählen</span><input type="file" accept="application/pdf,.pdf" disabled={disabled} onChange={e=>{
      const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(!file)return;
      void run(async()=>{if(!file.size||file.size>MONTHLY_FILE_LIMIT)throw Error('Die Scandatei muss zwischen 1 Byte und 2 MiB groß sein.');
        const bytes=new Uint8Array(await file.arrayBuffer());if(!alive.current)return;
        let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
        await capture.uploadScan(btoa(raw));});
    }}/></label>}
    {scan && <><p role="status">Scan mit {scan.pages.length} Seiten unverändert gespeichert. Prüfen Sie jede Seite gegen die oben angezeigte Druckfassung. Eine falsche Datei erfordert eine neue Erfassung.</p>
      <nav className="gx-actions" aria-label="Seiten des Scans">{scan.pages.map((p,i)=><button type="button" key={p.sha256+':'+i} disabled={disabled} aria-pressed={page?.page===i+1}
        onClick={()=>void run(async()=>{const next=await capture.readScanPage(i+1);if(alive.current){setPage(next);setLoaded(false);setConfirmed(false);}})}>Seite {i+1}{reviewed[i+1]===p.sha256?' · geprüft':''}</button>)}</nav>
      {page && url && <><div className="gx-paper-page"><img src={url} alt={`Archivierte Scanseite ${page.page} von ${scan.pages.length}`} onLoad={()=>setLoaded(true)}/>
        {page.page===box.page && validBox && <div aria-hidden="true" className="gx-paper-box" style={{left:`${box.x/10}%`,top:`${box.y/10}%`,width:`${box.width/10}%`,height:`${box.height/10}%`}}/>}</div>
        <a href={url} target="_blank" rel="noopener noreferrer">Scanseite {page.page} in voller Größe öffnen</a>
        <label className="gx-signature-choice"><input type="checkbox" checked={reviewed[page.page]===page.sha256} disabled={disabled || !loaded}
          onChange={e=>{setReviewed(r=>({...r,[page.page]:e.target.checked?page.sha256:''}));setConfirmed(false);}}/><span>Seite {page.page}: Person, Leistungsart, Fassung, Erfassungskennung und sämtliche Leistungen stimmen mit der Druckfassung überein. Die Seite ist vollständig und lesbar.</span></label>
      </>}
      <p>{Object.values(reviewed).filter(Boolean).length} von {scan.pages.length} Seiten geprüft.</p>
      {page?.page===box.page && url && <><h4>Unterschriftsausschnitt prüfen</h4><p>Der rote Rahmen muss die vollständige neue Unterschrift enthalten. Gedruckte Linien und Beschriftungen müssen außerhalb liegen. Bei verschobenem Scan den Rahmen über die folgenden Prozentangaben anpassen.</p>
        <div className="gx-paper-grid">{([['x','Abstand links'],['y','Abstand oben'],['width','Breite'],['height','Höhe']] as const).map(([key,label])=><label key={key}><span>{label} in %</span><input type="number" min="0" max="100" step="0.1" value={box[key]/10} disabled={disabled} onChange={e=>changeBox(key,e.target.value)}/></label>)}</div>
        {validBox?<div className="gx-paper-crop" aria-label="Vorschau des Unterschriftsausschnitts" style={{aspectRatio:`${box.width*page.width}/${box.height*page.height}`}}>
          <img src={url} alt="Ausgewählter Unterschriftsausschnitt" style={{width:`${100000/box.width}%`,left:`${-100*box.x/box.width}%`,top:`${-100*box.y/box.height}%`}}/></div>:<p role="alert">Der Rahmen muss vollständig innerhalb der Seite liegen.</p>}
      </>}
      <label className="gx-stack"><span>Datum und Uhrzeit der Unterschrift laut Papiernachweis (Ortszeit dieses Geräts)</span><input type="datetime-local" step="1" value={signedAt} disabled={disabled} onChange={e=>{setSignedAt(e.target.value);setConfirmed(false);}}/></label>
      {signedAt && !validTime && <p role="alert">Die Unterschrift muss nach Ausgabe dieser Druckfassung und vor dem aktuellen Zeitpunkt liegen.</p>}
      <label className="gx-signature-choice"><input type="checkbox" checked={confirmed} disabled={disabled || !all || !validBox || !validTime || page?.page!==box.page || !loaded}
        onChange={e=>setConfirmed(e.target.checked)}/><span>Ich habe alle Seiten verglichen. Die vollständige neue persönliche Unterschrift steht im Ausschnitt auf Seite {box.page}; Datum und Uhrzeit sind geprüft. Der Scan gehört genau zu dieser Monatsfassung.</span></label>
      <p className="gx-muted">Datei und Zuordnung werden technisch geprüft. Den Inhalt und die tatsächliche Unterschrift bestätigen Sie persönlich.</p>
      <button type="button" className="gx-primary" disabled={disabled || !all || !validBox || !validTime || !confirmed} onClick={()=>void run(()=>capture.reviewScan({scanSha256:scan.scanSha256,
        reviewedPages:scan.pages.map(p=>p.sha256),signatureBox:box,signedAt:new Date(signedAt).toISOString(),reviewConfirmed:true}))}>Scanprüfung und Unterschrift übernehmen</button>
    </>}
  </div>;
}
