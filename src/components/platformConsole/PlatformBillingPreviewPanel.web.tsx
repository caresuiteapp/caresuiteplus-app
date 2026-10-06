import {useCallback,useEffect,useRef,useState} from 'react';
import {platformRpc} from '@/lib/platformConsole/platformSupabaseClient';
import {consoleDate,consoleLabel,consoleMoney} from '@/lib/platformConsole/consoleWorkspaceModel';
import {ConsoleStyle} from './ConsoleWorkspaceUi.web';
import {platformName} from '@/lib/platformConsole/platformLanguage';
type Cost={key:string;name:string;status:string;interval:string;amount_cents:number;currency:string};
type Overview={tariff:Cost|null;addons:Cost[];credit_cents:number;as_of:string};
export function PlatformBillingPreviewPanel({tenantId}: {tenantId:string;canWrite?:boolean;compact?:boolean}) {
  const [data,setData]=useState<Overview|null>(null);const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);const revision=useRef(0);
  const load=useCallback(async()=>{
    const r=++revision.current;setLoading(true);setError(null);
    const result=await platformRpc<Overview>('platform_tenant_cost_overview',{p_tenant_id:tenantId});
    if(r!==revision.current)return;
    if(result.error){setData(null);setError(result.error.message);}else setData(result.data);
    setLoading(false);
  },[tenantId]);
  useEffect(()=>{const counter=revision;void load();return()=>{counter.current++;};},[load]);
  return <div className="cs-console"><ConsoleStyle/><section className="cs-panel"><div className="cs-panel-head"><div><h3>Vertragskosten</h3><p>Preise des hinterlegten Tarifs und der aktiven Zusatzpakete.</p></div><button className="cs-btn" disabled={loading} onClick={()=>void load()}>Aktualisieren</button></div>
    <div className="cs-panel-body">{loading?<p role="status">Kostenübersicht wird geladen…</p>:null}{error?<p role="alert" className="cs-notice error">{error}</p>:null}
      {data?<><dl className="cs-kv">{[...(data.tariff?[data.tariff]:[]),...data.addons].map((row,index)=><div key={index} style={{display:'contents'}}><dt>{platformName(row.key,row.name)} · {consoleLabel(row.status)}</dt><dd>{consoleMoney(row.amount_cents,row.currency)} je {row.interval==='yearly'?'Jahr':'Monat'}</dd></div>)}<dt>Hinterlegtes Guthaben</dt><dd>{consoleMoney(data.credit_cents)}</dd><dt>Datenstand</dt><dd>{consoleDate(data.as_of)}</dd></dl>
        {!data.tariff?<p>Es ist kein aktiver Tarifvertrag hinterlegt.</p>:null}<p>Diese Übersicht zeigt die Vertragsgrundlagen. Rabatte, Leistungszeiträume, Steuern und die tatsächliche Verrechnung des Guthabens werden bei der jeweiligen Rechnung berücksichtigt.</p></>:null}
    </div></section></div>;
}
