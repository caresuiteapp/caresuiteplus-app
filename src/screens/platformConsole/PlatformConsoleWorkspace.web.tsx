import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PlatformShellLayout } from '@/components/platformConsole/PlatformShellLayout.web';
import { ConsoleBadge, ConsoleDialog, ConsoleJson, ConsolePanel, ConsoleStats, ConsoleStyle, ConsoleTabs, downloadConsoleCsv } from '@/components/platformConsole/ConsoleWorkspaceUi.web';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import * as api from '@/lib/platformConsole';
import { consoleDate, consoleLabel, consoleMoney, consoleText, isSensitiveSetting, redactConsoleValue, type ConsoleRow } from '@/lib/platformConsole/consoleWorkspaceModel';
import { CONSOLE_SECTIONS, consoleActions, formatConsoleCell, loadConsoleData, loadConsoleVersions, type ConsoleAction, type ConsoleColumn, type ConsoleData, type ConsoleSection } from '@/lib/platformConsole/consoleWorkspaceService';
import type { PlatformCapability, PlatformRoleKey } from '@/types/platformConsole';
import { getServiceMode } from '@/lib/services/mode';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';

const INITIAL:ConsoleData={rows:[],tenants:[],related:[],warnings:[],hasMore:false};
const STATUS_FILTERS:Partial<Record<ConsoleSection,string[]>>={tenants:['active','suspended','locked','terminated'],billing:['draft','open','paid','past_due','partially_paid','failed','cancelled','refunded'],payments:['pending','succeeded','failed','cancelled','refunded','chargeback'],modules:['available','beta','internal','deprecated','disabled'],plans:['active','inactive','archived'],addons:['active','beta','deprecated','disabled'],discounts:['active','scheduled','expired','revoked'],users:['active','disabled','revoked'],releases:['planned','building','ready','failed','rolled_back'],'feature-flags':['true','false']};
const PAGE_SIZE=25;
const PRIMARY_KEYS:Partial<Record<ConsoleSection,string>>={tenants:'tenantName',plans:'plan_name',addons:'addon_name',modules:'module_name',discounts:'discount_name',billing:'invoice_number',payments:'tenant_label','feature-flags':'flag_name',users:'email',audit:'action',system:'display_name',releases:'version_label'};

export function PlatformConsoleWorkspace({section}:{section:ConsoleSection}){
  const router=useRouter();
  const params=useLocalSearchParams<{status?:string;tenantId?:string;action?:string}>();
  const {platformUser}=usePlatformAuth();
  const role=platformUser?.role;
  const info=CONSOLE_SECTIONS[section];
  const [data,setData]=useState<ConsoleData>(INITIAL);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [search,setSearch]=useState(typeof params.action==='string'?params.action:'');
  const [status,setStatus]=useState(typeof params.status==='string'?params.status:'');
  const [tenantId,setTenantId]=useState(typeof params.tenantId==='string'?params.tenantId:'');
  const [start,setStart]=useState('');const [end,setEnd]=useState('');
  const [offset,setOffset]=useState(0);const [page,setPage]=useState(0);
  const [updated,setUpdated]=useState<string|null>(null);
  const [selected,setSelected]=useState<ConsoleRow|null>(null);
  const [action,setAction]=useState<ConsoleAction|null>(null);
  const [sort,setSort]=useState<{key:string;desc:boolean}|null>(null);
  const generation=useRef(0);
  const serverPaged=section==='tenants'||section==='audit'||section==='releases';
  const allowed=!info.capability||api.platformRoleHasCapability(role,info.capability);
  const load=useCallback(async()=>{
    const request=++generation.current;
    if(!allowed){setLoading(false);return;}
    setLoading(true);setError('');
    try{
      const response=await loadConsoleData(section,{search:serverPaged?search.trim():'',status:serverPaged?status:'',tenantId:serverPaged?tenantId:'',offset,start,end},role);
      if(request!==generation.current)return;
      setData(response);setUpdated(new Date().toISOString());
      setSelected(previous=>previous?response.rows.find(row=>row.id===previous.id)??null:null);
    }catch(cause){if(request===generation.current)setError(cause instanceof Error?cause.message:'Die Daten konnten nicht geladen werden.');}
    finally{if(request===generation.current)setLoading(false);}
  },[allowed,offset,role,section,serverPaged,serverPaged?search:'',serverPaged?status:'',serverPaged?tenantId:'',serverPaged?start:'',serverPaged?end:'']);
  useEffect(()=>{const timer=setTimeout(()=>void load(),serverPaged?250:0);return()=>{clearTimeout(timer);generation.current++;};},[load,serverPaged]);
  useEffect(()=>{setPage(0);},[search,status,tenantId,start,end,sort]);
  const filtered=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase('de-DE');
    let result=data.rows.filter(row=>{
      if(!serverPaged&&q&&!Object.values(redactConsoleValue(row) as ConsoleRow).some(value=>consoleText(value).toLocaleLowerCase('de-DE').includes(q)))return false;
      if(!serverPaged&&status&&String(section==='feature-flags'?row.enabled:row.status)!==status)return false;
      if(tenantId&&section!=='audit'&&row.tenant_id!==tenantId)return false;
      const date=String(row.created_at??row.deployed_at??row.updated_at??row.createdAt??'').slice(0,10);
      if(!serverPaged){if(start&&(!date||date<start))return false;if(end&&(!date||date>end))return false;}
      return true;
    });
    if(sort)result=[...result].sort((a,b)=>{const av=a[sort.key],bv=b[sort.key];const comparison=typeof av==='number'&&typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??''),'de',{numeric:true});return sort.desc?-comparison:comparison;});
    return result;
  },[data.rows,search,status,tenantId,start,end,section,serverPaged,sort]);
  const validPage=Math.min(page,Math.max(0,Math.ceil(filtered.length/PAGE_SIZE)-1));
  const visible=serverPaged?filtered:filtered.slice(validPage*PAGE_SIZE,(validPage+1)*PAGE_SIZE);
  const actions=consoleActions(section,null,data).filter(item=>api.platformRoleHasCapability(role,item.capability));
  const filtersActive=Boolean(search||status||tenantId||start||end);
  function resetFilters(){setSearch('');setStatus('');setTenantId('');setStart('');setEnd('');setOffset(0);setPage(0);}
  function open(row:ConsoleRow){if(section==='tenants'){const id=String(row.tenantId??'');if(id)router.push(`/platform/tenants/${encodeURIComponent(id)}` as never);return;}setSelected(row);}
  const afterSave=async()=>{setAction(null);setNotice('Änderung gespeichert und protokolliert. Die Übersicht wird aktualisiert.');await load();};
  return <PlatformShellLayout title={info.title} subtitle={info.subtitle}>
    <div className="cs-console"><ConsoleStyle />
      <section className="cs-hero"><div><div className="cs-eyebrow">CareSuite HealthOS · Verwaltung</div><h2>{info.subtitle}</h2><p>{info.description}</p></div>{['dashboard','plans','tenants'].includes(section)&&<div className="cs-price"><strong>0 €</strong><small>Plattformnutzung</small></div>}</section>
      {!allowed?<div className="cs-notice" role="status">Ihre Rolle hat keinen Zugriff auf diesen Bereich.</div>:<>
      {getServiceMode()==='demo'&&<div className="cs-notice">Demomodus: Beispieldaten. Änderungen sind in dieser Vorschau gesperrt.</div>}
      {notice&&<div className="cs-notice success" role="status">{notice}</div>}
      {data.warnings.map(warning=><div className="cs-notice" role="status" key={warning}>{warning}</div>)}
      {error&&<div className="cs-notice error" role="alert"><strong>Aktualisierung fehlgeschlagen.</strong> {error} <button className="cs-link" onClick={()=>void load()} disabled={loading}>Erneut versuchen</button>{updated&&<p>Die angezeigten Daten stammen vom {consoleDate(updated)}.</p>}</div>}
      {loading&&<><div className="cs-loading" role="progressbar" aria-label="Daten werden geladen"/><p className="cs-busy-copy" role="status">Daten werden geladen. Bei langsamer Verbindung kann dies einen Moment dauern.</p></>}
      {section==='dashboard'?<ConsoleDashboard data={data} loading={loading} role={role} onRefresh={()=>void load()}/>:<>
        <ConsoleStats items={pageStats(section,data.rows,data.related)}/>
        <ConsolePanel title={section==='audit'?'Änderungsprotokoll':section==='system'?'Einstellungen':section==='tenants'?'Unternehmensverzeichnis':'Verzeichnis'} description={updated?`Zuletzt aktualisiert: ${consoleDate(updated)}`:'Daten werden aus der Plattform geladen'} actions={<div className="cs-actions"><button className="cs-btn" onClick={()=>void load()} disabled={loading}>↻ Aktualisieren</button>{actions.map(item=><button className="cs-btn primary" key={item.key} disabled={loading||getServiceMode()==='demo'} onClick={()=>setAction(item)}>＋ {item.title}</button>)}</div>}>
          <div className="cs-panel-body"><div className="cs-toolbar">
            <label className="cs-field">{section==='audit'?'Aktion suchen':'Suchen'}<input type="search" value={search} placeholder={section==='tenants'?'Unternehmen, E-Mail oder Kürzel':section==='audit'?'z. B. tenant oder payment':'Bezeichnung, Status oder Kennung'} onChange={event=>{setSearch(event.target.value);setOffset(0);}}/></label>
            {STATUS_FILTERS[section]&&<label className="cs-field">Status<select value={status} onChange={event=>{setStatus(event.target.value);setOffset(0);}}><option value="">Alle Status</option>{STATUS_FILTERS[section]?.map(value=><option key={value} value={value}>{value==='true'?'Aktiviert':value==='false'?'Deaktiviert':consoleLabel(value)}</option>)}</select></label>}
            {['billing','payments','audit','feature-flags'].includes(section)&&<label className="cs-field">Unternehmen<select value={tenantId} onChange={event=>{setTenantId(event.target.value);setOffset(0);}}><option value="">Alle Unternehmen</option>{data.tenants.map(tenant=><option key={String(tenant.tenantId)} value={String(tenant.tenantId)}>{String(tenant.tenantName)}</option>)}</select></label>}
            {['audit','billing','payments','releases'].includes(section)&&<><label className="cs-field">{section==='billing'?'Erfasst ab':'Ab Datum'}<input type="date" value={start} max={end||undefined} onChange={event=>{setStart(event.target.value);setOffset(0);}}/></label><label className="cs-field">Bis Datum<input type="date" value={end} min={start||undefined} onChange={event=>{setEnd(event.target.value);setOffset(0);}}/></label></>}
          </div><div className="cs-actions"><small>{filtered.length} Treffer{serverPaged?' auf dieser Datenseite':''}{start&&end&&end<start?' · Bitte den Zeitraum korrigieren.':''}</small>{filtersActive&&<button className="cs-link" onClick={resetFilters}>Filter zurücksetzen</button>}<button className="cs-link" disabled={!filtered.length||loading} onClick={()=>downloadConsoleCsv(`CareSuite-${section}`,info.columns.map(column=>column.label),filtered.map(row=>info.columns.map(column=>formatConsoleCell(row,column))))}>Gefilterte Liste als CSV exportieren</button></div>{(section==='audit'||section==='releases')&&<small>Zeitraum, Status und Suchbegriff werden im gesamten Verlauf gefiltert. Die Tabelle und der Export zeigen jeweils die aktuelle Datenseite.</small>}</div>
          {!loading&&!visible.length?<div className="cs-empty"><h3>{filtersActive?'Keine passenden Einträge':'Noch keine Einträge'}</h3><p>{filtersActive?'Passen Sie die Suche oder die Filter an.':info.empty}</p>{filtersActive&&<button className="cs-btn" onClick={resetFilters}>Alle anzeigen</button>}</div>:<div className="cs-table-scroll"><table className="cs-table"><thead><tr>{info.columns.map(column=><th key={column.key} scope="col" aria-sort={sort?.key===column.key?sort.desc?'descending':'ascending':'none'}><button className="cs-link" onClick={()=>setSort(current=>({key:column.key,desc:current?.key===column.key?!current.desc:false}))}>{column.label}{sort?.key===column.key?(sort.desc?' ↓':' ↑'):''}</button></th>)}<th scope="col">Aktion</th></tr></thead><tbody>{visible.map(row=><tr key={String(row.id??row.tenantId??row.setting_key??row.module_key)}>{info.columns.map((column,index)=><td key={column.key}>{index===0?<button className="cs-link" onClick={()=>open(row)}>{formatConsoleCell(row,column)}</button>:column.format==='status'||column.format==='boolean'?<ConsoleBadge value={row[column.key]} label={formatConsoleCell(row,column)}/>:formatConsoleCell(row,column)}</td>)}<td><button className="cs-btn" onClick={()=>open(row)}>{section==='tenants'?'Akte öffnen':'Details'}</button></td></tr>)}</tbody></table></div>}
          <div className="cs-pager"><span>{serverPaged?`Datenseite ${Math.floor(offset/50)+1} · bis zu 50 Einträge`:`Seite ${validPage+1} von ${Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))} · ${filtered.length} gefilterte Einträge`}</span><div className="cs-actions"><button className="cs-btn" disabled={loading||(serverPaged?offset===0:validPage===0)} onClick={()=>serverPaged?setOffset(value=>Math.max(0,value-50)):setPage(value=>Math.max(0,value-1))}>Zurück</button><button className="cs-btn" disabled={loading||(serverPaged?!data.hasMore:(validPage+1)*PAGE_SIZE>=filtered.length)} onClick={()=>serverPaged?setOffset(value=>value+50):setPage(value=>value+1)}>{section==='audit'?'Ältere Einträge':'Weiter'}</button></div></div>
        </ConsolePanel>
        {section==='discounts'&&<DiscountAssignments data={data} role={role} onAction={setAction}/>}
        {section==='users'&&<RoleMatrix/>}
        {section==='addons'&&<AddonAssignments data={data} role={role} onAction={setAction}/>}
      </>}
      </>}
    </div>
    {selected&&!action&&<ConsoleDetail section={section} row={selected} data={data} role={role} onClose={()=>setSelected(null)} onAction={setAction}/>}
    {action&&<ConsoleActionEditor key={action.key} action={action} onClose={()=>setAction(null)} onSaved={afterSave}/>}
  </PlatformShellLayout>;
}

function pageStats(section:ConsoleSection,rows:ConsoleRow[],related:ConsoleRow[]){
  const count=(key:string,value:unknown)=>rows.filter(row=>row[key]===value).length;
  const sum=(status:string)=>{const amounts=new Map<string,number>();for(const row of rows.filter(row=>row.status===status)){const currency=String(row.currency??'EUR');amounts.set(currency,(amounts.get(currency)??0)+Number(row.amount_cents??0));}return [...amounts].map(([currency,value])=>consoleMoney(value,currency)).join(' · ')||consoleMoney(0);};
  const base={label:'Geladene Einträge',value:rows.length};
  if(section==='billing')return[base,{label:'Offen / teilbezahlt',value:rows.filter(row=>['open','past_due','partially_paid'].includes(String(row.status))).length},{label:'Überfällig',value:count('status','past_due')},{label:'Bezahlte Rechnungen',value:count('status','paid')}];
  if(section==='payments')return[base,{label:'Erfolgreiche Zahlungen',value:sum('succeeded')},{label:'Ausstehend',value:count('status','pending')},{label:'Fehlgeschlagen',value:count('status','failed')}];
  if(section==='users')return[base,{label:'Aktive Zugriffe',value:count('status','active')},{label:'Aktive Inhaber',value:rows.filter(row=>row.role==='platform_owner'&&row.status==='active').length},{label:'Deaktiviert / entzogen',value:rows.filter(row=>row.status!=='active').length}];
  if(section==='tenants')return[base,{label:'Aktiv',value:count('status','active'),hint:'Auf dieser Datenseite'},{label:'In Einrichtung',value:count('lifecycleStatus','onboarding'),hint:'Auf dieser Datenseite'},{label:'Kostenlose Nutzung',value:count('billingStatus','manual_free'),hint:'Auf dieser Datenseite'}];
  if(section==='feature-flags')return[base,{label:'Aktiviert',value:count('enabled',true)},{label:'Plattformweit',value:count('scope','global')},{label:'Mandantenbezogen',value:count('scope','tenant')}];
  if(section==='system')return[base,{label:'Geschützte Werte',value:rows.filter(isSensitiveSetting).length},{label:'Wartungsmodus',value:rows.find(row=>row.setting_key==='maintenance_mode')?.value===true?'Aktiv':rows.some(row=>row.setting_key==='maintenance_mode')?'Aus':'Nicht hinterlegt'}];
  if(section==='releases')return[base,{label:'Bereit',value:count('status','ready')},{label:'Fehlgeschlagen',value:count('status','failed')},{label:'Produktion',value:count('environment','production')}];
  if(section==='discounts')return[base,{label:'Aktive Konditionen',value:count('status','active')},{label:'Zuweisungen',value:related.length},{label:'Aktive Zuweisungen',value:related.filter(row=>row.status==='active').length}];
  if(section==='modules')return[base,{label:'Verfügbar',value:count('status','available')},{label:'In Beta',value:count('status','beta')},{label:'Grundfunktionen',value:count('is_core',true)}];
  if(section==='plans')return[base,{label:'Kostenlose Modelle',value:rows.filter(row=>Number(row.monthly_price_cents)===0&&Number(row.yearly_price_cents)===0).length},{label:'Aktive Modelle',value:count('status','active')}];
  if(section==='audit')return[base,{label:'Verschiedene Aktionen',value:new Set(rows.map(row=>row.action)).size},{label:'Betroffene Mandanten',value:new Set(rows.filter(row=>row.tenant_id).map(row=>row.tenant_id)).size}];
  return[base,{label:'Aktiv',value:count('status','active')},{label:'Archiviert',value:count('status','archived')}];
}

function ConsoleActionEditor({action,onClose,onSaved}:{action:ConsoleAction;onClose:()=>void;onSaved:()=>Promise<void>}){
  const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(action.fields.map(field=>[field.key,field.value??''])));
  const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const lock=useRef(false);const saved=useRef(false);
  const dirty=Boolean(reason.trim())||action.fields.some(field=>values[field.key] !== (field.value??''));
  const confirmLeave=useUnsavedWebChanges(dirty&&!saved.current,busy);
  const close=async()=>{if(await confirmLeave())onClose();};
  const valid=action.fields.every(field=>!field.required||Boolean(values[field.key]?.trim()))&&reason.trim().length>=5;
  async function submit(){
    if(lock.current||!valid||saved.current)return;
    lock.current=true;setBusy(true);setError('');
    try{await action.run(values,reason.trim());saved.current=true;await onSaved();}
    catch(cause){setError(cause instanceof Error?cause.message:'Die Änderung konnte nicht gespeichert werden.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <ConsoleDialog title={action.title} description={action.description} busy={busy} onClose={()=>void close()} footer={<><small>{busy?'Speicherung läuft. Bitte warten.':'Die Änderung wird mit Ihrer Begründung protokolliert.'}</small><div className="cs-actions"><button className="cs-btn" disabled={busy} onClick={()=>void close()}>Abbrechen</button><button type="submit" form="console-action-form" className={`cs-btn ${action.danger?'danger':'primary'}`} disabled={busy||!valid||getServiceMode()==='demo'}>{busy?'Wird gespeichert…':'Speichern'}</button></div></>}>
    <form id="console-action-form" onSubmit={event=>{event.preventDefault();void submit();}}><div className="cs-form-grid">{action.fields.map(field=><label className={`cs-field ${field.type==='textarea'?'wide':''}`} key={field.key}>{field.label}{field.required?' *':''}{field.type==='select'?<select required={field.required} disabled={busy} value={values[field.key]} onChange={event=>setValues(current=>({...current,[field.key]:event.target.value}))}><option value="">Bitte auswählen</option>{field.options?.map(option=><option value={option.value} key={option.value}>{option.label==='not_checked'?'Nicht geprüft':option.label==='passed'?'Bestanden':option.label==='true'?'Ja':option.label==='false'?'Nein':option.label}</option>)}</select>:field.type==='textarea'?<textarea required={field.required} disabled={busy} value={values[field.key]} onChange={event=>setValues(current=>({...current,[field.key]:event.target.value}))}/>:<input type={field.type??'text'} required={field.required} disabled={busy} min={field.min} max={field.max} step={field.type==='number'?'any':undefined} value={values[field.key]} onChange={event=>setValues(current=>({...current,[field.key]:event.target.value}))}/>}{field.hint&&<small>{field.hint}</small>}</label>)}<label className="cs-field wide">Begründung *<textarea required minLength={5} disabled={busy} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Anlass, Vereinbarung oder Grundlage dieser Änderung"/><small>Mindestens fünf Zeichen. Die Begründung bleibt im Audit nachvollziehbar.</small></label></div></form>
    {error&&<div className="cs-notice error" role="alert">{error}<p>Die Eingaben bleiben erhalten. Prüfen Sie bei einem Verbindungsabbruch zunächst den tatsächlichen Datenstand, bevor Sie erneut speichern.</p></div>}
  </ConsoleDialog>;
}

const DETAIL_FIELDS:Partial<Record<ConsoleSection,[string,string][]>>={
  modules:[['module_key','Technischer Schlüssel'],['description','Beschreibung'],['category','Kategorie'],['status','Freigabe'],['is_core','Grundfunktion'],['is_beta','Beta'],['is_internal','Intern'],['default_enabled','Standardmäßig aktiviert'],['requires_module_keys','Voraussetzungen'],['incompatible_module_keys','Unvereinbare Funktionen']],
  billing:[['invoice_number','Rechnungsnummer'],['tenant_label','Unternehmen'],['status','Status'],['currency','Währung'],['due_at','Fälligkeit'],['issued_at','Ausgestellt'],['paid_at','Bezahlt am']],
  payments:[['tenant_label','Unternehmen'],['invoice_label','Rechnung'],['status','Status'],['provider','Zahlungsquelle'],['payment_method','Zahlungsweg'],['failure_reason','Fehlergrund'],['created_at','Erfasst']],
  'feature-flags':[['flag_key','Technischer Schlüssel'],['scope','Geltungsbereich'],['tenant_label','Unternehmen'],['enabled','Aktiviert'],['rollout_label','Rollout'],['starts_at','Beginn'],['ends_at','Ende'],['updated_at','Zuletzt geändert']],
  users:[['full_name','Name'],['email','E-Mail'],['role','Rolle'],['status','Zugriff'],['last_login_at','Letzte Anmeldung'],['updated_at','Geändert']],
  releases:[['version_label','Version'],['environment','Umgebung'],['status','Status'],['commit_sha','Git-Commit'],['migration_version','Datenbankstand'],['deployed_at','Registriert'],['notes','Prüfnotiz']],
  audit:[['action','Aktion'],['created_at','Zeitpunkt'],['actor_user_id','Ausführender Benutzer'],['actor_role','Ausführende Rolle'],['tenant_label','Unternehmen'],['tenant_id','Unternehmens-ID'],['target_type','Zielbereich'],['target_id','Ziel-ID'],['reason','Begründung']],
  system:[['display_name','Einstellung'],['setting_key','Schlüssel'],['display_value','Aktueller Wert'],['description','Bedeutung'],['is_sensitive','Geschützter Wert'],['updated_at','Geändert']],
  discounts:[['discount_name','Bezeichnung'],['discount_key','Code'],['discount_type','Art'],['display_value','Wert'],['status','Status'],['description','Beschreibung']],
  plans:[['plan_name','Vertragsmodell'],['plan_key','Kennung'],['description','Beschreibung'],['status','Status'],['is_public','Öffentlich'],['included_module_keys','Enthaltene Funktionen']],
  addons:[['addon_name','Erweiterung'],['addon_key','Kennung'],['description','Beschreibung'],['status','Status']],
};

function ConsoleDetail({section,row,data,role,onClose,onAction}:{section:ConsoleSection;row:ConsoleRow;data:ConsoleData;role:PlatformRoleKey|undefined;onClose:()=>void;onAction:(action:ConsoleAction)=>void}){
  const router=useRouter();const actions=consoleActions(section,row,data).filter(action=>api.platformRoleHasCapability(role,action.capability));
  const title=String(row[PRIMARY_KEYS[section]??'id']??CONSOLE_SECTIONS[section].title);
  const fields=DETAIL_FIELDS[section]??[];
  const safeRow=redactConsoleValue(row) as ConsoleRow;
  return <ConsoleDialog title={title} description={CONSOLE_SECTIONS[section].subtitle} onClose={onClose} footer={<><div className="cs-actions">{Boolean(row.tenant_id)&&api.platformRoleHasCapability(role,'tenants.read')&&<button className="cs-btn" onClick={()=>router.push(`/platform/tenants/${encodeURIComponent(String(row.tenant_id))}` as never)}>Unternehmensakte</button>}{section!=='audit'&&api.platformRoleHasCapability(role,'audit.read')&&<button className="cs-btn" onClick={()=>router.push(api.buildPlatformAuditPath({tenantId:row.tenant_id?String(row.tenant_id):undefined}) as never)}>Audit öffnen</button>}</div><button className="cs-btn" onClick={onClose}>Schließen</button></>}>
    <dl className="cs-kv">{fields.map(([key,label])=><div key={key} style={{display:'contents'}}><dt>{label}</dt><dd>{key.endsWith('_at')?consoleDate(safeRow[key]):consoleText(safeRow[key])}</dd></div>)}</dl>
    {['billing','payments'].includes(section)&&<ConsoleStats items={[{label:'Betrag',value:consoleMoney(row.amount_cents,row.currency)},...(section==='billing'?[{label:'Netto',value:consoleMoney(row.net_cents,row.currency)},{label:'Steuer',value:consoleMoney(row.tax_cents,row.currency)}]:[])]}/>}
    {actions.length>0&&<div className="cs-actions">{actions.map(action=><button className={`cs-btn ${action.danger?'danger':'primary'}`} key={action.key} disabled={getServiceMode()==='demo'} onClick={()=>onAction(action)}>{action.title}</button>)}</div>}
    {section==='audit'&&<div className="cs-columns"><section><h3>Vor der Änderung</h3><ConsoleJson value={redactConsoleValue(row.before)}/></section><section><h3>Nach der Änderung</h3><ConsoleJson value={redactConsoleValue(row.after)}/></section></div>}
    {section==='billing'&&typeof row.invoice_url==='string'&&/^https:\/\//i.test(row.invoice_url)&&<a className="cs-btn" href={row.invoice_url} target="_blank" rel="noreferrer noopener">Rechnungsdokument öffnen ↗</a>}
    {section==='releases'&&<><h3>Dokumentierte Prüfergebnisse</h3><ConsoleJson value={row.checks}/>{typeof row.deployment_url==='string'&&/^https:\/\//i.test(row.deployment_url)&&<a className="cs-btn" href={row.deployment_url} target="_blank" rel="noreferrer noopener">Bereitstellung öffnen ↗</a>}</>}
    {(section==='plans'||section==='addons')&&<ConsoleVersions section={section} row={row} role={role} onAction={onAction}/>}
    {section==='billing'&&<ConsolePanel title="Zugeordnete Zahlungen"><div className="cs-panel-body">{data.related.filter(payment=>payment.invoice_id===row.id).map(payment=><div className="cs-task" key={String(payment.id)}><div><b>{consoleMoney(payment.amount_cents,payment.currency)}</b><p>{consoleDate(payment.created_at)} · {consoleLabel(payment.payment_method)}</p></div><ConsoleBadge value={payment.status} label={consoleLabel(payment.status)}/></div>)}{!data.related.some(payment=>payment.invoice_id===row.id)&&<p className="cs-muted">Keine zugeordneten Zahlungen in den verfügbaren Daten.</p>}</div></ConsolePanel>}
    {section==='discounts'&&<DiscountAssignments data={{...data,related:data.related.filter(item=>item.discount_key===row.discount_key)}} role={role} onAction={onAction}/>}
    {section==='users'&&<RoleMatrix selectedRole={String(row.role)}/>}
    {section==='addons'&&<AddonAssignments data={{...data,related:data.related.filter(item=>item.addon_key===row.addon_key)}} role={role} onAction={onAction}/>}
  </ConsoleDialog>;
}

function ConsoleVersions({section,row,role,onAction}:{section:ConsoleSection;row:ConsoleRow;role:PlatformRoleKey|undefined;onAction:(action:ConsoleAction)=>void}){
  const [versions,setVersions]=useState<ConsoleRow[]>([]);
  const [catalog,setCatalog]=useState<ConsoleRow[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);
  const [versionId,setVersionId]=useState('');
  const [versionData,setVersionData]=useState<{modules:ConsoleRow[];limits:ConsoleRow[]}>({modules:[],limits:[]});
  const canWrite=api.platformRoleHasCapability(role,'plans.write')&&getServiceMode()!=='demo';
  useEffect(()=>{
    let alive=true;setLoading(true);setError('');
    loadConsoleVersions(section,row).then(rows=>{if(alive){setVersions(rows);setVersionId(previous=>rows.some(item=>item.id===previous)?previous:String(rows[0]?.id??''));}})
      .catch(cause=>{if(alive)setError(cause.message);}).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[section,row,refresh]);
  useEffect(()=>{
    if(section!=='plans'||!api.platformRoleHasCapability(role,'modules.read'))return;
    let alive=true;api.listPlatformModules().then(result=>{if(alive&&result.ok)setCatalog(result.data.filter(item=>!String(item.module_key).toLowerCase().includes('bodymap')));});
    return()=>{alive=false;};
  },[section,role]);
  useEffect(()=>{
    if(section!=='plans'||!versionId)return;
    let alive=true;setError('');setLoading(true);setVersionData({modules:[],limits:[]});
    Promise.all([api.listPlatformPlanModules(versionId),api.listPlatformPlanLimits(versionId)]).then(([modules,limits])=>{
      if(!alive)return;if(!modules.ok)throw new Error(modules.error);if(!limits.ok)throw new Error(limits.error);
      setVersionData({modules:modules.data.filter(item=>!String(item.module_key).toLowerCase().includes('bodymap')),limits:limits.data});
    }).catch(cause=>{if(alive)setError(cause.message);}).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[section,versionId,refresh]);
  const versionName=`Version ${versions.find(item=>item.id===versionId)?.version_number??''}`;
  const saveModule=(item?:ConsoleRow)=>onAction({
    key:'plan-module',title:item?'Vertragsfunktion bearbeiten':'Vertragsfunktion zuordnen',
    description:`${versionName}: Funktionsumfang und Freigabe für diese Vertragsversion festlegen.`,capability:'plans.write',
    fields:[{key:'key',label:'Funktion',required:true,value:String(item?.module_key??''),...(catalog.length?{type:'select' as const,options:catalog.map(module=>({value:String(module.module_key),label:String(module.module_name)}))}:{type:'text' as const})},
      {key:'state',label:'Freigabe',type:'select',required:true,value:String(item?.access_state??'active'),options:['active','beta','coming_soon','disabled','internal'].map(value=>({value,label:consoleLabel(value)}))}],
    run:async(values,reason)=>{if(values.key.toLowerCase().includes('bodymap'))throw new Error('Diese Funktion ist nicht mehr verfügbar.');const result=await api.assignPlatformPlanModule(versionId,values.key,values.state,reason);if(!result.ok)throw new Error(result.error);return result.data;},
  });
  const saveLimit=(item?:ConsoleRow)=>onAction({
    key:'limit',title:item?'Vertragslimit bearbeiten':'Vertragslimit festlegen',description:`${versionName}: Bestehende Werte desselben Schlüssels werden aktualisiert.`,capability:'plans.write',
    fields:[{key:'key',label:'Limit-Schlüssel',type:'text',required:true,value:String(item?.limit_key??'max_users'),hint:'Zum Beispiel max_users, max_clients, max_employees oder max_storage_mb.'},{key:'value',label:'Maximalwert',type:'number',required:true,min:0,value:item?String(item.limit_value):''}],
    run:async(values,reason)=>{const value=Number(values.value);if(!values.value.trim()||!Number.isInteger(value)||value<0||value>2147483647)throw new Error('Bitte eine ganze Zahl zwischen 0 und 2147483647 eingeben.');if(!/^[a-z][a-z0-9_]{2,99}$/.test(values.key))throw new Error('Bitte einen gültigen Limit-Schlüssel eingeben.');const result=await api.setPlatformPlanLimit(versionId,values.key,value,reason);if(!result.ok)throw new Error(result.error);return result.data;},
  });
  return <ConsolePanel title="Versionshistorie & Vertragsumfang" actions={<button className="cs-link" disabled={loading} onClick={()=>setRefresh(value=>value+1)}>Aktualisieren</button>}><div className="cs-panel-body">
    {loading&&<p role="status">Vertragsstand wird geladen…</p>}
    {error&&<div className="cs-notice error" role="alert">{error}</div>}
    {!loading&&!error&&!versions.length&&<p>Es sind noch keine Versionen hinterlegt.</p>}
    {!!versions.length&&<>
      <label className="cs-field">Version auswählen<select disabled={loading} value={versionId} onChange={event=>setVersionId(event.target.value)}>{versions.map(version=><option key={String(version.id)} value={String(version.id)}>Version {String(version.version_number)} · {consoleLabel(version.status)} · {consoleMoney(version.monthly_price_cents)} / Monat</option>)}</select></label>
      {versions.filter(version=>version.id===versionId).map(version=><ConsoleStats key={String(version.id)} items={[{label:'Monat',value:consoleMoney(version.monthly_price_cents)},{label:'Jahr',value:consoleMoney(version.yearly_price_cents)},{label:'Gültig ab',value:consoleDate(version.effective_from)}]}/>)}
      {section==='plans'&&!loading&&!error&&<ConsoleTabs tabs={['Funktionen','Limits']}>{tab=><div className="cs-panel-body">
        {(tab==='Funktionen'?versionData.modules:versionData.limits).map((item,index)=><div className="cs-task" key={String(item.id??index)}>
          <div><b>{String(catalog.find(module=>module.module_key===item.module_key)?.module_name??item.module_key??item.limit_key)}</b><p>{consoleText(item.access_state??item.limit_value)}</p></div>
          {canWrite&&<div className="cs-actions"><button className="cs-btn" onClick={()=>tab==='Funktionen'?saveModule(item):saveLimit(item)}>Bearbeiten</button>
            {tab==='Funktionen'&&<button className="cs-btn danger" onClick={()=>onAction({key:'remove-module',title:'Vertragsfunktion entfernen',description:`${item.module_key} aus ${versionName} entfernen.`,capability:'plans.write',danger:true,fields:[],run:async(_,reason)=>{const result=await api.removePlatformPlanModule(versionId,String(item.module_key),reason);if(!result.ok)throw new Error(result.error);return result.data;}})}>Entfernen</button>}
          </div>}
        </div>)}
        {!(tab==='Funktionen'?versionData.modules:versionData.limits).length&&<p>Für diese Version sind keine {tab} hinterlegt.</p>}
        {canWrite&&<button className="cs-btn" onClick={()=>tab==='Funktionen'?saveModule():saveLimit()}>{tab==='Funktionen'?'Funktion zuordnen':'Limit festlegen'}</button>}
      </div>}</ConsoleTabs>}
    </>}
  </div></ConsolePanel>;
}

function AddonAssignments({data,role,onAction}:{data:ConsoleData;role:PlatformRoleKey|undefined;onAction:(action:ConsoleAction)=>void}){
  return <ConsolePanel title="Zugeordnete Unternehmen" description="Vertragsstand und Laufzeit der Erweiterungen"><div className="cs-panel-body">
    {!data.related.length&&<p className="cs-muted">Keine Zuweisungen vorhanden.</p>}
    {data.related.map(item=><div className="cs-task" key={String(item.id)}><div><b>{String(item.tenant_label)} · {String(item.addon_key)}</b><p>{consoleLabel(item.billing_interval)} · {consoleDate(item.starts_at??item.created_at)}{item.ends_at?` bis ${consoleDate(item.ends_at)}`:''}</p><ConsoleBadge value={item.status} label={consoleLabel(item.status)}/></div>
      {!['cancelled','revoked','expired'].includes(String(item.status))&&api.platformRoleHasCapability(role,'plans.write')&&<button className="cs-btn danger" disabled={getServiceMode()==='demo'} onClick={()=>onAction({key:'remove-addon',title:'Erweiterung beenden',description:`${item.addon_key} für ${item.tenant_label} beenden. Die Begründung dokumentiert die Vertragsgrundlage.`,capability:'plans.write',danger:true,fields:[],run:async(_,reason)=>{const result=await api.removePlatformAddonFromTenant(String(item.tenant_id),String(item.addon_key),reason);if(!result.ok)throw new Error(result.error);return result.data;}})}>Beenden</button>}
    </div>)}
  </div></ConsolePanel>;
}

function DiscountAssignments({data,role,onAction}:{data:ConsoleData;role:PlatformRoleKey|undefined;onAction:(action:ConsoleAction)=>void}){
  return <ConsolePanel title="Mandantenzuweisungen" description="Geltungsdauer und Widerruf bestehender Sonderkonditionen"><div className="cs-panel-body">{!data.related.length?<p className="cs-muted">Keine Zuweisungen vorhanden.</p>:data.related.map(row=><div className="cs-task" key={String(row.id)}><div><b>{String(row.tenant_label)} · {String(row.discount_key)}</b><p>{consoleDate(row.starts_at)} bis {row.ends_at?consoleDate(row.ends_at):'unbefristet'}</p><ConsoleBadge value={row.status} label={consoleLabel(row.status)}/></div>{['active','scheduled'].includes(String(row.status))&&api.platformRoleHasCapability(role,'discounts.write')&&<button className="cs-btn danger" disabled={getServiceMode()==='demo'} onClick={()=>onAction({key:'revoke-discount',title:'Sonderkondition widerrufen',description:`${row.discount_key} für ${row.tenant_label} widerrufen. Der Vorgang bleibt protokolliert.`,capability:'discounts.write',fields:[],danger:true,run:async(_,reason)=>{const result=await api.removePlatformDiscount(String(row.tenant_id),String(row.discount_key),reason);if(!result.ok)throw new Error(result.error);return result.data;}})}>Widerrufen</button>}</div>)}</div></ConsolePanel>;
}

const MATRIX:[string,PlatformCapability,PlatformCapability?][]=[['Sonderkonditionen','discounts.read','discounts.write'],['Releases','releases.read'],['Unternehmen','tenants.read','tenants.write'],['Funktionen','modules.read','modules.write'],['Verträge','plans.read','plans.write'],['Rechnungen','billing.read','billing.write'],['Zahlungen','payments.read','payments.write'],['Support','support.read','support.write'],['Benutzer','users.read','users.write'],['System','system.read','system.write'],['Audit','audit.read'],['Freigaben','flags.read','flags.write']];
function RoleMatrix({selectedRole}:{selectedRole?:string}){
  const roles=Object.keys(api.PLATFORM_ROLE_LABELS).filter(role=>!selectedRole||role===selectedRole) as PlatformRoleKey[];
  return <ConsolePanel title="Rollen & Berechtigungen" description="Lesen und Bearbeiten nach Bereich"><div className="cs-table-scroll"><table className="cs-table cs-role-table"><thead><tr><th>Bereich</th>{roles.map(role=><th key={role}>{consoleLabel(role)}</th>)}</tr></thead><tbody>{MATRIX.map(([label,read,write])=><tr key={label}><td>{label}</td>{roles.map(role=><td key={role}>{write&&api.platformRoleHasCapability(role,write)?'Lesen & bearbeiten':api.platformRoleHasCapability(role,read)?'Lesen':'Kein Zugriff'}</td>)}</tr>)}</tbody></table></div></ConsolePanel>;
}

function ConsoleDashboard({data,loading,role,onRefresh}:{data:ConsoleData;loading:boolean;role:PlatformRoleKey|undefined;onRefresh:()=>void}){
  const router=useRouter();const summary=data.summary;
  if(!summary)return <ConsolePanel title="Betriebsübersicht"><div className="cs-panel-body"><p>{loading?'Die Betriebsdaten werden abgefragt.':'Die Betriebsübersicht konnte noch nicht geladen werden.'}</p><button className="cs-btn" disabled={loading} onClick={onRefresh}>Aktualisieren</button></div></ConsolePanel>;
  const tasks=[
    {title:'Neue Unternehmen einrichten',value:summary.tenants.onboarding,text:'Registrierungen prüfen und die Einrichtung begleiten.',path:'/platform/tenants',cap:'tenants.read'},
    {title:'Gesperrte Zugänge prüfen',value:summary.tenants.suspended,text:'Grund, Status und weitere Bearbeitung in der Unternehmensakte prüfen.',path:'/platform/tenants?status=suspended',cap:'tenants.read'},
    {title:'Überfällige Rechnungen',value:summary.billing.pastDueInvoices,text:'Fälligkeiten und Zahlungseingänge abgleichen.',path:'/platform/billing?status=past_due',cap:'billing.read'},
    {title:'Fehlgeschlagene Zahlungen',value:summary.billing.failedPayments,text:'Fehlergrund und Rechnungszuordnung klären.',path:'/platform/payments?status=failed',cap:'payments.read'},
    {title:'Support bearbeiten',value:summary.system.activeSupportSessions,text:'Supporttickets und genehmigte Zugriffe im Support-Arbeitsbereich öffnen.',path:'/platform/support',cap:'support.read'},
  ].filter(task=>api.platformRoleHasCapability(role,task.cap as PlatformCapability));
  return <>
    <ConsoleStats items={[{label:'Aktive Mandanten',value:summary.tenants.active},{label:'In Einrichtung',value:summary.tenants.onboarding},{label:'Aktive technische Freigaben',value:summary.system.activeFeatureFlags},{label:'Wartungsmodus',value:summary.system.maintenanceMode?'Aktiv':'Aus'}]}/>
    {summary.system.maintenanceMode&&<div className="cs-notice error">Der Wartungsmodus ist aktiviert. Prüfen Sie die Einstellung und die betroffenen Funktionen im Bereich System.</div>}
    <div className="cs-columns"><ConsolePanel title="Jetzt bearbeiten" description="Offene Vorgänge nach Zuständigkeit" actions={<button className="cs-btn" disabled={loading} onClick={onRefresh}>↻ Aktualisieren</button>}><div className="cs-panel-body">{tasks.map(task=><div className="cs-task" key={task.title}><div><button className="cs-link" onClick={()=>router.push(task.path as never)}>{task.title}</button><p>{task.text}</p></div><strong>{task.value}</strong></div>)}</div></ConsolePanel>
      <ConsolePanel title="Letzte Änderungen" description="Zuletzt protokollierte Plattformaktionen" actions={api.platformRoleHasCapability(role,'audit.read')&&<button className="cs-link" onClick={()=>router.push('/platform/audit' as never)}>Gesamten Verlauf öffnen</button>}><div className="cs-panel-body">{data.related.map(row=><div className="cs-task" key={String(row.id)}><div><b>{consoleText(row.action)}</b><p>{consoleDate(row.created_at)} · {consoleLabel(row.actor_role)}</p><p>{consoleText(row.reason)}</p></div></div>)}{!data.related.length&&<p className="cs-muted">Keine zugänglichen Audit-Einträge vorhanden.</p>}</div></ConsolePanel></div>
    <ConsolePanel title="Arbeitsbereiche" description="Direkt zur passenden Verwaltung"><div className="cs-panel-body"><div className="cs-columns">{Object.entries(CONSOLE_SECTIONS).filter(([key,info])=>key!=='dashboard'&&(!info.capability||api.platformRoleHasCapability(role,info.capability))).map(([key,info])=><div className="cs-task" key={key}><div><button className="cs-link" onClick={()=>router.push(`/platform/${key}` as never)}>{info.title}</button><p>{info.subtitle}</p></div><span aria-hidden>↗</span></div>)}</div></div></ConsolePanel>
  </>;
}
