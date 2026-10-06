import {useCallback,useEffect,useRef,useState} from 'react';
import {PlatformConfirmModal} from '@/components/platformConsole/PlatformConfirmModal.web';
import {ConsoleStyle,ConsoleBadge} from '@/components/platformConsole/ConsoleWorkspaceUi.web';
import {usePlatformOperation,requirePlatformResult} from '@/hooks/usePlatformOperation.web';
import {assignPlatformPlanToTenant,assignPlatformAddonToTenant,removePlatformAddonFromTenant} from '@/lib/platformConsole/platformFoundationService';
import {listPlatformPlans} from '@/lib/platformConsole/platformOpsService';
import {listPlatformTenantSubscriptions,listPlatformTenantAddons,listPlatformAddonsCatalog,listPlatformAddonVersions} from '@/lib/platformConsole/platformOperatorDataService';
import {platformRpc} from '@/lib/platformConsole/platformSupabaseClient';
import {platformRoleHasCapability} from '@/lib/platformConsole/platformCapabilities';
import {consoleDate,consoleLabel,consoleMoney} from '@/lib/platformConsole/consoleWorkspaceModel';
import {platformName} from '@/lib/platformConsole/platformLanguage';
import type {PlatformTenantDetail} from '@/lib/platformConsole';
import type {PlatformRoleKey} from '@/types/platformConsole';
type Row=Record<string,unknown>;
type Props={tenantId:string;role:PlatformRoleKey|null|undefined;detail:PlatformTenantDetail;onReload:()=>Promise<void>};
type Confirmation={title:string;description:string;danger?:boolean;action:(reason:string)=>Promise<void>};

export function TenantContractTab({tenantId,role,detail,onReload}:Props) {
  const operation=usePlatformOperation();
  const [contracts,setContracts]=useState<Row[]>([]);
  const [plans,setPlans]=useState<Row[]>([]);
  const [planKey,setPlanKey]=useState('');
  const [interval,setInterval]=useState('monthly');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [saved,setSaved]=useState<string|null>(null);
  const [confirm,setConfirm]=useState<Confirmation|null>(null);
  const revision=useRef(0);
  const canWrite=platformRoleHasCapability(role,'plans.write');
  const load=useCallback(async()=>{
    const r=++revision.current;setLoading(true);setError(null);
    const [a,b]=await Promise.all([listPlatformTenantSubscriptions(tenantId),listPlatformPlans()]);
    if(r!==revision.current)return;
    if(a.ok)setContracts(a.data);else {setContracts([]);setError(a.error);}
    if(b.ok)setPlans(b.data.filter(row=>row.status==null||row.status==='active'));else {setPlans([]);setError(b.error);}
    setLoading(false);
  },[tenantId]);
  useEffect(()=>{const counter=revision;void load();return()=>{counter.current++;};},[load]);
  const current=contracts.find(row=>['active','paused'].includes(String(row.status)));
  const currentKey=String(current?.plan_key??detail.tenant.plan_key??detail.tenant.planKey??'');
  const selected=plans.find(row=>row.plan_key===planKey);
  const currentName=!current&&currentKey!=='free_platform'?'Kein aktiver Tarifvertrag':platformName(currentKey,String(plans.find(row=>row.plan_key===currentKey)?.plan_name||'Individuell vereinbarter Tarif'));
  const changed=async()=>{await load();await onReload();setSaved('Die Vertragsänderung wurde gespeichert und protokolliert.');};
  const changeState=(status:string,title:string)=>setConfirm({title,description:status==='cancelled'?'Der hinterlegte Tarifvertrag wird beendet. Ein späterer neuer Vertrag muss ausdrücklich zugewiesen werden.':status==='paused'?'Der hinterlegte Tarifvertrag wird pausiert. Die Unternehmenssperre steuern Sie getrennt in der Mandantenakte.':'Der pausierte Tarifvertrag wird fortgesetzt.',danger:status!=='active',action:async reason=>{
    const result=await platformRpc('platform_update_tenant_contract',{p_tenant_id:tenantId,p_status:status,p_reason:reason});
    if(result.error)throw new Error(result.error.message);await changed();
  }});
  return <div className="cs-console"><ConsoleStyle/><section className="cs-panel">
    <div className="cs-panel-head"><h3>Tarif & Vertrag</h3><button className="cs-btn" disabled={loading||operation.busy} onClick={()=>void load()}>Aktualisieren</button></div>
    <div className="cs-panel-body">
      {loading?<p role="status">Vertragsdaten werden geladen…</p>:null}{error?<p role="alert" className="cs-notice error">{error}</p>:null}{saved?<p role="status" className="cs-notice">{saved}</p>:null}
      <dl className="cs-kv"><dt>Aktueller Tarif</dt><dd>{String(currentName)}</dd><dt>Vertragsstatus</dt><dd>{current?consoleLabel(current.status):currentKey==='free_platform'?'Kostenlose Nutzung':'Kein aktiver Tarifvertrag hinterlegt'}</dd>
        {current?<><dt>Abrechnung</dt><dd>{consoleLabel(current.billing_interval)}</dd><dt>Preis</dt><dd>{consoleMoney(current.billing_interval==='yearly'?current.yearly_price_cents:current.monthly_price_cents,current.currency)} je {current.billing_interval==='yearly'?'Jahr':'Monat'}</dd><dt>Beginn</dt><dd>{consoleDate(current.starts_at)}</dd><dt>Ende</dt><dd>{consoleDate(current.ends_at)}</dd></>:null}</dl>
      {canWrite?<div className="cs-form-grid"><label className="cs-field">Tarif auswählen<select disabled={loading||operation.busy} value={planKey} onChange={e=>setPlanKey(e.target.value)}><option value="">Bitte auswählen</option>{plans.map(plan=><option key={String(plan.plan_key)} value={String(plan.plan_key)}>{platformName(plan.plan_key,String(plan.plan_name||'Individueller Tarif'))}</option>)}</select></label>
        <label className="cs-field">Abrechnungsrhythmus<select disabled={operation.busy} value={interval} onChange={e=>setInterval(e.target.value)}><option value="monthly">Monatlich</option><option value="yearly">Jährlich</option></select></label>
        {selected?<p className="wide">Vereinbarter Preis: {consoleMoney(interval==='yearly'?selected.yearly_price_cents:selected.monthly_price_cents,selected.currency)} je {interval==='yearly'?'Jahr':'Monat'}.</p>:null}
        {!loading&&!plans.length?<p className="wide">Im Tarifkatalog ist derzeit kein aktiver Tarif freigegeben.</p>:null}
        <div className="cs-actions wide"><button className="cs-btn primary" disabled={loading||operation.busy||!selected||!!error} onClick={()=>setConfirm({title:'Tarif zuweisen',description:`${platformName(planKey,String(selected?.plan_name||'Individueller Tarif'))} · ${consoleLabel(interval)} · ${consoleMoney(interval==='yearly'?selected?.yearly_price_cents:selected?.monthly_price_cents,selected?.currency)}. Der bisherige aktive Tarif wird ersetzt.`,action:async reason=>{await requirePlatformResult(assignPlatformPlanToTenant(tenantId,planKey,reason,{billingInterval:interval as 'monthly'|'yearly'}));await changed();}})}>Tarif zuweisen</button>
          {current?.status==='active'?<button className="cs-btn" disabled={operation.busy} onClick={()=>changeState('paused','Vertrag pausieren')}>Vertrag pausieren</button>:null}
          {current?.status==='paused'?<button className="cs-btn" disabled={operation.busy} onClick={()=>changeState('active','Vertrag fortsetzen')}>Vertrag fortsetzen</button>:null}
          {current?<button className="cs-btn danger" disabled={operation.busy} onClick={()=>changeState('cancelled','Vertrag beenden')}>Vertrag beenden</button>:null}
        </div></div>:<p>Ihre Rolle hat für Tarifverträge Lesezugriff.</p>}
      <h3>Bisherige Tarifverträge</h3>{contracts.length?contracts.map(row=><div key={String(row.id)} className="cs-notice">{platformName(row.plan_key,String(plans.find(plan=>plan.plan_key===row.plan_key)?.plan_name||'Individueller Tarif'))} · {consoleLabel(row.status)} · {consoleDate(row.starts_at)}</div>):<p>Keine Tarifwechsel dokumentiert.</p>}
    </div></section>
    <PlatformConfirmModal visible={!!confirm} title={confirm?.title??''} description={confirm?.description??''} danger={confirm?.danger} loading={operation.busy} error={operation.error} onCancel={()=>{setConfirm(null);operation.clear();}} onConfirm={reason=>{if(confirm)void operation.run(()=>confirm.action(reason)).then(ok=>{if(ok)setConfirm(null);});}}/>
  </div>;
}

export function TenantAddonsTab({tenantId,role,onReload}:Omit<Props,'detail'>) {
  const operation=usePlatformOperation();const revision=useRef(0);
  const [catalog,setCatalog]=useState<Row[]>([]);const [assigned,setAssigned]=useState<Row[]>([]);
  const [versions,setVersions]=useState<Row[]>([]);const [key,setKey]=useState('');const [interval,setInterval]=useState('monthly');
  const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);const [message,setMessage]=useState<string|null>(null);
  const [confirm,setConfirm]=useState<Confirmation|null>(null);
  const canWrite=platformRoleHasCapability(role,'plans.write');
  const load=useCallback(async()=>{
    const r=++revision.current;setLoading(true);setError(null);
    const [a,b]=await Promise.all([listPlatformAddonsCatalog(),listPlatformTenantAddons(tenantId)]);
    if(r!==revision.current)return;
    if(a.ok)setCatalog(a.data);else {setCatalog([]);setError(a.error);}
    if(b.ok)setAssigned(b.data);else {setAssigned([]);setError(b.error);}
    setLoading(false);
  },[tenantId]);
  useEffect(()=>{const counter=revision;void load();return()=>{counter.current++;};},[load]);
  useEffect(()=>{let active=true;setVersions([]);if(key)void listPlatformAddonVersions(key).then(result=>{if(!active)return;if(result.ok)setVersions(result.data);else setError(result.error);});return()=>{active=false;};},[key]);
  const selected=catalog.find(row=>row.addon_key===key);
  const version=versions.find(row=>row.status==='active'&&(!row.effective_from||Date.parse(String(row.effective_from))<=Date.now()));
  const changed=async()=>{await load();await onReload();setMessage('Die Zusatzpaketzuweisung wurde gespeichert und protokolliert.');};
  return <div className="cs-console"><ConsoleStyle/><section className="cs-panel"><div className="cs-panel-head"><h3>Zusatzpakete</h3><button className="cs-btn" disabled={loading||operation.busy} onClick={()=>void load()}>Aktualisieren</button></div><div className="cs-panel-body">
    {loading?<p role="status">Zusatzpakete werden geladen…</p>:null}{error?<p role="alert" className="cs-notice error">{error}</p>:null}{message?<p role="status" className="cs-notice">{message}</p>:null}
    {!loading&&!catalog.length&&!error?<p>Im Zusatzpaketkatalog sind noch keine Pakete hinterlegt. Legen Sie ein Paket mit freigegebenem Preis unter „Tarife &amp; Zusatzpakete“ an.</p>:null}
    {!loading&&!assigned.length&&!error?<p>Diesem Unternehmen sind noch keine Zusatzpakete zugewiesen.</p>:null}
    {assigned.map(row=><article key={String(row.id)} className="cs-panel"><div className="cs-panel-head"><h3>{String(catalog.find(item=>item.addon_key===row.addon_key)?.addon_name||platformName(row.addon_key,'Individuelles Zusatzpaket'))}</h3><ConsoleBadge value={row.status} label={consoleLabel(row.status)}/></div><div className="cs-panel-body"><p>{consoleLabel(row.billing_interval)} · Beginn: {consoleDate(row.starts_at)}{row.ends_at?` · Ende: ${consoleDate(row.ends_at)}`:''}</p>{canWrite&&row.status==='active'?<button className="cs-btn danger" disabled={operation.busy} onClick={()=>setConfirm({title:'Zusatzpaket beenden',description:'Die aktive Zuweisung wird beendet. Der Verlauf bleibt erhalten.',danger:true,action:async reason=>{await requirePlatformResult(removePlatformAddonFromTenant(tenantId,String(row.addon_key),reason));await changed();}})}>Zuweisung beenden</button>:null}</div></article>)}
    {canWrite?<div className="cs-form-grid"><label className="cs-field">Zusatzpaket auswählen<select disabled={loading||operation.busy} value={key} onChange={e=>{setKey(e.target.value);setError(null);}}><option value="">Bitte auswählen</option>{catalog.filter(row=>row.status==='active').map(row=><option key={String(row.addon_key)} value={String(row.addon_key)}>{String(row.addon_name||platformName(row.addon_key,'Zusatzpaket'))}</option>)}</select></label>
      <label className="cs-field">Abrechnungsrhythmus<select value={interval} disabled={operation.busy} onChange={e=>setInterval(e.target.value)}><option value="monthly">Monatlich</option><option value="yearly">Jährlich</option></select></label>
      {key?<p className="wide">{version?`Preis: ${consoleMoney(interval==='yearly'?version.yearly_price_cents:version.monthly_price_cents,version.currency)} je ${interval==='yearly'?'Jahr':'Monat'}.`:'Für dieses Zusatzpaket ist noch keine gültige Preisversion freigegeben.'}</p>:null}
      <div className="cs-actions wide"><button className="cs-btn primary" disabled={operation.busy||loading||!selected||!version||!!error} onClick={()=>setConfirm({title:'Zusatzpaket zuweisen',description:`${selected?.addon_name} · ${consoleLabel(interval)} · ${consoleMoney(interval==='yearly'?version?.yearly_price_cents:version?.monthly_price_cents,version?.currency)}. Die Zuweisung wird für dieses Unternehmen gespeichert.`,action:async reason=>{await requirePlatformResult(assignPlatformAddonToTenant(tenantId,key,reason,{billingInterval:interval as 'monthly'|'yearly'}));await changed();}})}>Zusatzpaket zuweisen</button></div>
    </div>:<p>Ihre Rolle hat für Zusatzpakete Lesezugriff.</p>}
  </div></section><PlatformConfirmModal visible={!!confirm} title={confirm?.title??''} description={confirm?.description??''} danger={confirm?.danger} loading={operation.busy} error={operation.error} onCancel={()=>{setConfirm(null);operation.clear();}} onConfirm={reason=>{if(confirm)void operation.run(()=>confirm.action(reason)).then(ok=>{if(ok)setConfirm(null);});}}/></div>;
}
