import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createTemplate, getTemplate, listTemplates, updateTemplate, archiveTemplate, duplicateSystemTemplateForTenant, getTenantTemplateSettings } from '@/lib/templates';
import { extractTemplateVariables, getSampleVariableValues, renderTemplateWithVariables, TEMPLATE_VARIABLES } from '@/lib/templates/templateVariables';
import { DocumentsWorkspaceShell } from '@/components/documents/DocumentsWorkspaceShell.web';
import type { TemplateListFilters, TemplateModuleKey, TemplateStatus, TemplateType } from '@/types/templates';

export const TEMPLATE_MODULE_LABELS: Record<TemplateModuleKey, string> = { core:'Allgemein',office:'Office',assist:'Assist',pflege:'Pflege',stationaer:'Stationär',beratung:'Beratung',akademie:'Fortbildung',communication:'Kommunikation',billing:'Abrechnung',documents:'Dokumente',ti:'Telematikinfrastruktur' };
export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = { task:'Aufgabe',documentation_text:'Textbaustein',message:'Nachricht',email:'E-Mail',document:'Dokumenttext',invoice_text:'Rechnungstext',dunning_text:'Mahnungstext',consent:'Einwilligung',care_plan:'Pflegeplanung',sis:'Strukturierte Informationssammlung',risk_assessment:'Risikoeinschätzung',counseling_protocol:'Beratungsprotokoll',academy_course:'Kurs',certificate:'Bescheinigung',category:'Kategorie',dropdown_value:'Auswahlwert',checklist:'Checkliste' };
export const TEMPLATE_STATUS_LABELS: Record<TemplateStatus,string> = { active:'Aktiv',draft:'Entwurf',archived:'Archiviert',disabled:'Deaktiviert' };
const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';

export function TemplateWorkspaceFrame({ title, description, children, actions, beforeNavigate }: {title:string;description?:string;children:ReactNode;actions?:ReactNode;beforeNavigate?:()=>boolean}) {
  const router = useFlowRouter();
  return <DocumentsWorkspaceShell active="settings" title={title} description={description} beforeNavigate={beforeNavigate} back={{label:'Vorlagenverwaltung',onClick:()=>router.push('/business/templates/documents-hub' as never)}} actions={actions}><div className="tw-workspace"><style>{`.tw-workspace{display:grid;gap:20px;min-width:0}.tw-workspace .dw-panel{display:flex;flex-direction:column;gap:16px}.tw-workspace .dw-field{font-size:calc(12px * var(--app-font-scale,1));font-weight:600;line-height:1.6}.tw-workspace input[type=checkbox]{accent-color:#1764d4;width:16px;height:16px;vertical-align:middle;margin-right:7px}.tw-workspace .dw-table td:first-child{min-width:220px;max-width:560px;overflow-wrap:anywhere}.tw-workspace .dw-table td:last-child{white-space:nowrap}.tw-workspace .dw-alert{flex-wrap:wrap}.tw-workspace .dw-toolbar h2{flex:1 1 180px}`}</style>{children}</div></DocumentsWorkspaceShell>;
}

export function TemplateAccessMessage({ edit=false }: {edit?:boolean}) {
  const { check } = usePermissions();
  return <div className="dw-alert" data-tone="danger" role="alert">{check(edit?'office.catalogs.edit':'office.catalogs.view').reason || 'Für diesen Bereich fehlt die Berechtigung.'}</div>;
}

export function TemplateListWorkspace({ title, subtitle, baseFilters = {}, showCreate = true }: {title:string;subtitle:string;baseFilters?:TemplateListFilters;showCreate?:boolean}) {
  const router = useFlowRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const canView = can('office.catalogs.view');
  const [search,setSearch] = useState('');
  const [status,setStatus] = useState<TemplateStatus|'all'>('all');
  const [module,setModule] = useState<TemplateModuleKey|'all'>('all');
  const query = useAsyncQuery(()=>listTemplates(tenantId!,baseFilters,profile?.roleKey),[tenantId,profile?.roleKey,JSON.stringify(baseFilters)],{enabled:!!tenantId&&canView,queryKey:JSON.stringify([tenantId,profile?.roleKey,baseFilters])});
  const settings = useAsyncQuery(()=>getTenantTemplateSettings(tenantId!,profile?.roleKey),[tenantId,profile?.roleKey],{enabled:!!tenantId&&canView,queryKey:JSON.stringify([tenantId,profile?.roleKey])});
  const rows = (query.data??[]).filter(row=>(settings.data?.showSystemTemplates===true||row.scope==='tenant')&&(status==='all'||row.status===status)&&(module==='all'||row.moduleKey===module)&&`${row.title} ${row.description??''} ${row.content}`.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE')));
  return <TemplateWorkspaceFrame title={title} description={subtitle} actions={showCreate&&can('office.catalogs.edit')?<button className="dw-button dw-button--primary" onClick={()=>router.push(`/business/templates/create${baseFilters.templateType?`?type=${baseFilters.templateType}`:''}` as never)}>Vorlage anlegen</button>:undefined}>
    {!canView?<TemplateAccessMessage/>:!tenantId?<div className="dw-alert" role="status">Bitte zuerst ein Unternehmen auswählen.</div>:<>
      <div className="dw-toolbar"><label className="dw-field" style={{flex:'1 1 260px'}}>Suche<input className="dw-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Titel oder Inhalt suchen" type="search"/></label><label className="dw-field">Status<select className="dw-select" value={status} onChange={e=>setStatus(e.target.value as TemplateStatus|'all')}><option value="all">Alle Status</option>{Object.entries(TEMPLATE_STATUS_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>{!baseFilters.moduleKey?<label className="dw-field">Bereich<select className="dw-select" value={module} onChange={e=>setModule(e.target.value as TemplateModuleKey|'all')}><option value="all">Alle Bereiche</option>{Object.entries(TEMPLATE_MODULE_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>:null}<button className="dw-button" disabled={query.loading||query.refreshing} onClick={()=>void query.refresh()}>Aktualisieren</button></div>
      {query.error||query.refreshError?<div className="dw-alert" data-tone="danger" role="alert">{query.error||query.refreshError}</div>:null}{settings.error?<div className="dw-alert" data-tone="danger" role="alert">Ihre Anzeigeeinstellungen konnten nicht geladen werden.<button className="dw-button" onClick={()=>void settings.refresh()}>Erneut laden</button></div>:null}
      {query.loading&&!query.data?<div className="dw-empty" role="status">Vorlagen werden geladen …</div>:<><p className="dw-muted" aria-live="polite">{rows.length} {rows.length===1?'Vorlage':'Vorlagen'}</p>{rows.length?<div className="dw-table-wrap"><table className="dw-table"><thead><tr><th>Vorlage</th><th>Bereich</th><th>Status</th><th><span className="dw-sr">Aktion</span></th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.title}</strong>{row.description?<p className="dw-muted">{row.description}</p>:null}<span className="dw-muted">{TEMPLATE_TYPE_LABELS[row.templateType]??'Vorlage'} · {row.scope==='tenant'?'Eigene Vorlage':'Standardvorlage'}</span></td><td>{TEMPLATE_MODULE_LABELS[row.moduleKey]??'Allgemein'}</td><td><span className="dw-status" data-tone={row.status==='active'?'success':'neutral'}>{TEMPLATE_STATUS_LABELS[row.status]??row.status}</span></td><td><button className="dw-button" onClick={()=>router.push(`/business/templates/${row.id}` as never)} aria-label={`${row.title} öffnen`}>Öffnen</button></td></tr>)}</tbody></table></div>:<div className="dw-empty"><h2>Keine passenden Vorlagen</h2><p>{search||status!=='all'||module!=='all'?'Ändern Sie die Suche oder die Filter.':'Hier erscheinen Ihre gespeicherten Vorlagen.'}</p>{search||status!=='all'||module!=='all'?<button className="dw-button" onClick={()=>{setSearch('');setStatus('all');setModule('all');}}>Filter zurücksetzen</button>:null}</div>}</>}
    </>}
  </TemplateWorkspaceFrame>;
}

function TemplateContentPreview({content}:{content:string}) {
  const [samples,setSamples] = useState(false);
  return <section className="dw-panel"><div className="dw-toolbar"><h2>Textvorschau</h2><label><input type="checkbox" checked={samples} onChange={e=>setSamples(e.target.checked)}/> Beispieldaten einsetzen</label></div>{samples?<p className="dw-muted">Die Namen und Angaben in dieser Vorschau sind fiktiv.</p>:null}<div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.7}}>{samples?renderTemplateWithVariables(content,getSampleVariableValues()):content||'Noch kein Text eingegeben.'}</div></section>;
}

export function TemplateDetailWorkspace() {
  const router = useFlowRouter();
  const params = useLocalSearchParams<{id:string}>();
  const id = scalar(params.id);
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const canView=can('office.catalogs.view');
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const query=useAsyncQuery(()=>getTemplate(tenantId!,id,profile?.roleKey),[tenantId,id,profile?.roleKey],{enabled:!!tenantId&&!!id&&canView,queryKey:JSON.stringify([tenantId,id,profile?.roleKey])});
  const template=query.data;
  const settings=useAsyncQuery(()=>getTenantTemplateSettings(tenantId!,profile?.roleKey),[tenantId,profile?.roleKey],{enabled:!!tenantId&&canView,queryKey:JSON.stringify([tenantId,profile?.roleKey])});
  const canCopy=settings.data?.allowTenantOverrides===true;
  const activeScope=useRef(`${tenantId}:${id}:${profile?.roleKey}`);activeScope.current=`${tenantId}:${id}:${profile?.roleKey}`;
  const writeLock=useRef<string|null>(null);
  const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{writeLock.current=null;setPending(false);setError('');},[tenantId,id,profile?.roleKey]);
  async function duplicate(){if(!tenantId||!template||pending||!can('office.catalogs.edit')||!canCopy||writeLock.current===activeScope.current)return;const scope=activeScope.current;writeLock.current=scope;setPending(true);setError('');try{const result=await duplicateSystemTemplateForTenant(tenantId,template.id,profile?.roleKey,profile?.id);if(!mounted.current||activeScope.current!==scope)return;if(result.ok)router.push(`/business/templates/${result.data.id}/edit` as never);else setError(result.error);}catch{if(mounted.current&&activeScope.current===scope)setError('Die Vorlage konnte nicht kopiert werden. Bitte erneut versuchen.');}finally{if(writeLock.current===scope)writeLock.current=null;if(mounted.current&&activeScope.current===scope)setPending(false);}}
  return <TemplateWorkspaceFrame title={template?.title??'Vorlage'} description={template?.description??'Gespeicherten Text ansehen und als eigene Vorlage bearbeiten.'} actions={canView&&template&&can('office.catalogs.edit')?(template.scope==='tenant'?<button className="dw-button dw-button--primary" onClick={()=>router.push(`/business/templates/${id}/edit` as never)}>Bearbeiten</button>:<button className="dw-button dw-button--primary" disabled={pending||!canCopy} onClick={()=>void duplicate()}>{pending?'Wird kopiert …':settings.loading?'Einstellung wird geladen …':canCopy?'Eigene Kopie anlegen':'Kopieren nicht freigegeben'}</button>):undefined}>
    {!canView?<TemplateAccessMessage/>:!tenantId?<div className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</div>:query.loading&&!template?<div className="dw-empty" role="status">Vorlage wird geladen …</div>:query.error&&!template?<div className="dw-alert" data-tone="danger" role="alert">{query.error}<button className="dw-button" onClick={()=>void query.refresh()}>Erneut laden</button></div>:template?<><div className="dw-toolbar"><span className="dw-chip">{TEMPLATE_MODULE_LABELS[template.moduleKey]}</span><span className="dw-chip">{TEMPLATE_TYPE_LABELS[template.templateType]}</span><span className="dw-status">{TEMPLATE_STATUS_LABELS[template.status]}</span></div>{error?<div className="dw-alert" data-tone="danger" role="alert">{error}</div>:null}{settings.error?<div className="dw-alert" data-tone="danger" role="alert">Vorlageneinstellungen konnten nicht geladen werden.<button className="dw-button" onClick={()=>void settings.refresh()}>Erneut laden</button></div>:null}<TemplateContentPreview content={template.content}/>{template.variables.length?<section className="dw-panel"><h2>Automatisch eingesetzte Angaben</h2><div className="dw-toolbar">{template.variables.map(key=><span className="dw-chip" key={key}>{TEMPLATE_VARIABLES.find(v=>v.key===key)?.label??key}</span>)}</div></section>:null}</>:<div className="dw-empty">Vorlage nicht gefunden.</div>}
  </TemplateWorkspaceFrame>;
}

type TemplateForm = {title:string;description:string;content:string;status:TemplateStatus;moduleKey:TemplateModuleKey;templateType:TemplateType};
const emptyForm:TemplateForm={title:'',description:'',content:'',status:'draft',moduleKey:'office',templateType:'documentation_text'};
export function TemplateEditorWorkspace({create=false}:{create?:boolean}) {
  const router=useFlowRouter();
  const params=useLocalSearchParams<{id:string;type?:string}>();
  const id=scalar(params.id);
  const tenantId=useServiceTenantId();
  const {profile}=useAuth();
  const {can}=usePermissions();
  const canEdit=can('office.catalogs.edit');
  const [form,setForm]=useState<TemplateForm>({...emptyForm,templateType:scalar(params.type)==='message'?'message':'documentation_text',moduleKey:scalar(params.type)==='message'?'communication':'office'});
  const [dirty,setDirty]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [archiveOpen,setArchiveOpen]=useState(false);
  const [insertKey,setInsertKey]=useState('');
  const inputRef=useRef<HTMLTextAreaElement>(null);
  const query=useAsyncQuery(()=>getTemplate(tenantId!,id,profile?.roleKey),[tenantId,id,profile?.roleKey],{enabled:!create&&!!tenantId&&!!id&&canEdit,queryKey:JSON.stringify([tenantId,id,profile?.roleKey])});
  const activeScope=useRef(`${tenantId}:${id}:${profile?.roleKey}:${create}:${scalar(params.type)}`);activeScope.current=`${tenantId}:${id}:${profile?.roleKey}:${create}:${scalar(params.type)}`;
  const writeLock=useRef<string|null>(null);
  const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const loadedKey=useRef('');
  useEffect(()=>{const key=`${tenantId}:${id}:${profile?.roleKey}:${create}:${scalar(params.type)}`;if(loadedKey.current!==key){loadedKey.current=key;writeLock.current=null;setDirty(false);setSaving(false);setError('');setSuccess('');setArchiveOpen(false);setForm({...emptyForm,templateType:scalar(params.type)==='message'?'message':'documentation_text',moduleKey:scalar(params.type)==='message'?'communication':'office'});}},[tenantId,id,params.type,profile?.roleKey,create]);
  useEffect(()=>{if(!query.data||dirty)return;const t=query.data;setForm({title:t.title,description:t.description??'',content:t.content,status:t.status,moduleKey:t.moduleKey,templateType:t.templateType});},[query.data,dirty]);
  useEffect(()=>{if(!dirty)return;const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);},[dirty]);
  const patch=<K extends keyof TemplateForm>(key:K,value:TemplateForm[K])=>{setForm(prev=>({...prev,[key]:value}));setDirty(true);setSuccess('');};
  const isEditable=create||query.data?.scope==='tenant';
  async function save(){if(!tenantId||!canEdit||saving||!isEditable||!form.title.trim()||!form.content.trim()||writeLock.current===activeScope.current)return;const scope=activeScope.current;writeLock.current=scope;setSaving(true);setError('');setSuccess('');try{const shared={title:form.title.trim(),description:form.description.trim()||null,content:form.content,variables:extractTemplateVariables(form.content),status:form.status};const result=create?await createTemplate(tenantId,{...shared,moduleKey:form.moduleKey,templateType:form.templateType},profile?.roleKey,profile?.id):await updateTemplate(tenantId,id,shared,profile?.roleKey);if(!mounted.current||activeScope.current!==scope)return;if(result.ok){setDirty(false);if(create)router.replace(`/business/templates/${result.data.id}/edit` as never);else{query.setData(result.data);setSuccess('Änderungen gespeichert.');}}else setError(result.error);}catch{if(mounted.current&&activeScope.current===scope)setError('Speichern fehlgeschlagen. Ihre Eingaben bleiben erhalten.');}finally{if(writeLock.current===scope)writeLock.current=null;if(mounted.current&&activeScope.current===scope)setSaving(false);}}
  async function archive(){if(!tenantId||!canEdit||saving||create||!isEditable||writeLock.current===activeScope.current)return;const scope=activeScope.current;writeLock.current=scope;setSaving(true);setError('');try{const result=await archiveTemplate(tenantId,id,profile?.roleKey);if(!mounted.current||activeScope.current!==scope)return;if(result.ok){setDirty(false);query.setData(result.data);setArchiveOpen(false);setSuccess('Vorlage archiviert. Sie bleibt in der Vorlagenliste erreichbar.');}else setError(result.error);}catch{if(mounted.current&&activeScope.current===scope)setError('Archivieren fehlgeschlagen. Bitte erneut versuchen.');}finally{if(writeLock.current===scope)writeLock.current=null;if(mounted.current&&activeScope.current===scope)setSaving(false);}}
  function insertVariable(){if(!insertKey)return;const input=inputRef.current;const start=input?.selectionStart??form.content.length;const end=input?.selectionEnd??start;const token=`{{${insertKey}}}`;patch('content',form.content.slice(0,start)+token+form.content.slice(end));setInsertKey('');requestAnimationFrame(()=>{input?.focus();input?.setSelectionRange(start+token.length,start+token.length);});}
  const beforeNavigate=()=>!writeLock.current&&!saving&&(!dirty||window.confirm('Ungespeicherte Änderungen verwerfen?'));
  function cancel(){if(!beforeNavigate())return;router.push((create?'/business/templates/tenant':`/business/templates/${id}`) as never);}
  const showForm=canEdit&&!!tenantId&&(create||!!query.data)&&isEditable;
  return <TemplateWorkspaceFrame beforeNavigate={beforeNavigate} title={create?'Eigene Textvorlage anlegen':'Textvorlage bearbeiten'} description="Wiederkehrende Texte vorbereiten und passende Angaben automatisch einsetzen." actions={showForm?<button className="dw-button dw-button--primary" disabled={saving||!form.title.trim()||!form.content.trim()||(!create&&!dirty)} onClick={()=>void save()}>{saving?'Wird gespeichert …':'Speichern'}</button>:undefined}>
    {!canEdit?<TemplateAccessMessage edit/>:!tenantId?<div className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</div>:!create&&query.loading&&!query.data?<div className="dw-empty" role="status">Vorlage wird geladen …</div>:!create&&query.error&&!query.data?<div className="dw-alert" data-tone="danger" role="alert">{query.error}<button className="dw-button" onClick={()=>void query.refresh()}>Erneut laden</button></div>:!isEditable?<div className="dw-empty">Standardvorlagen können über eine eigene Kopie bearbeitet werden.</div>:showForm?<>
      {error?<div className="dw-alert" data-tone="danger" role="alert">{error}</div>:null}{success?<div className="dw-alert" data-tone="success" role="status">{success}</div>:null}
      <section className="dw-panel"><div className="dw-grid"><label className="dw-field">Titel<input className="dw-input" value={form.title} onChange={e=>patch('title',e.target.value)} disabled={saving} maxLength={180} required/></label><label className="dw-field">Status<select className="dw-select" value={form.status} onChange={e=>patch('status',e.target.value as TemplateStatus)} disabled={saving}>{Object.entries(TEMPLATE_STATUS_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>{create?<><label className="dw-field">Verwendung<select className="dw-select" value={form.templateType} onChange={e=>{patch('templateType',e.target.value as TemplateType);if(e.target.value==='message'||e.target.value==='email')patch('moduleKey','communication');}} disabled={saving}>{(['documentation_text','message','email','invoice_text','dunning_text','checklist'] as const).map(key=><option key={key} value={key}>{TEMPLATE_TYPE_LABELS[key]}</option>)}</select></label><label className="dw-field">Bereich<select className="dw-select" value={form.moduleKey} onChange={e=>patch('moduleKey',e.target.value as TemplateModuleKey)} disabled={saving}>{Object.entries(TEMPLATE_MODULE_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></>:null}</div><label className="dw-field">Kurzbeschreibung<input className="dw-input" value={form.description} onChange={e=>patch('description',e.target.value)} disabled={saving} maxLength={400}/></label><div className="dw-toolbar"><label className="dw-field" style={{flex:'1 1 240px'}}>Angabe einfügen<select className="dw-select" value={insertKey} onChange={e=>setInsertKey(e.target.value)} disabled={saving}><option value="">Angabe auswählen</option>{TEMPLATE_VARIABLES.map(v=><option key={v.key} value={v.key}>{v.label}</option>)}</select></label><button className="dw-button" disabled={!insertKey||saving} onClick={insertVariable}>In Text einsetzen</button></div><label className="dw-field">Vorlagentext<textarea ref={inputRef} className="dw-input" value={form.content} rows={14} onChange={e=>patch('content',e.target.value)} disabled={saving} required style={{resize:'vertical',lineHeight:1.65}}/></label></section>
      <TemplateContentPreview content={form.content}/><div className="dw-toolbar"><button className="dw-button" disabled={saving} onClick={cancel}>Abbrechen</button>{!create&&form.status!=='archived'?<button className="dw-button dw-button--danger" disabled={saving} onClick={()=>setArchiveOpen(true)}>Archivieren</button>:null}<span className="dw-muted" role="status">{dirty?'Ungespeicherte Änderungen':''}</span></div>
      {archiveOpen?<section className="dw-panel" aria-label="Archivierung bestätigen"><h2>Vorlage archivieren?</h2><p>Sie bleibt gespeichert und kann später wieder aktiviert werden.{dirty?' Ungespeicherte Änderungen werden dabei verworfen.':''}</p><div className="dw-toolbar"><button className="dw-button dw-button--danger" disabled={saving} onClick={()=>void archive()}>Archivierung bestätigen</button><button className="dw-button" disabled={saving} onClick={()=>setArchiveOpen(false)}>Zurück</button></div></section>:null}
    </>:null}
  </TemplateWorkspaceFrame>;
}
