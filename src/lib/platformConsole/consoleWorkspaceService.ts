import * as api from './index';
import { platformName, platformActionLabel } from './platformLanguage';
import { platformRpc } from './platformSupabaseClient';
import { listPlatformCompanies } from './platformCompanyDirectoryService';
import { getServiceMode } from '@/lib/services/mode';
import { isRetiredPlatformSection, PLATFORM_FREE_USAGE } from './platformFreePolicy';
import type { PlatformCapability, PlatformDashboardSummary, PlatformRoleKey, PlatformUserStatus } from '@/types/platformConsole';
import type { ServiceResult } from '@/types/core/base';
import { consoleDate, consoleLabel, consoleMoney, consoleSettingValue, consoleText, isSensitiveSetting, type ConsoleRow } from './consoleWorkspaceModel';

export type ConsoleSection = 'dashboard' | 'tenants' | 'plans' | 'addons' | 'modules' | 'discounts' | 'billing' | 'payments' | 'feature-flags' | 'users' | 'audit' | 'system' | 'releases';
export type ConsoleColumn = { key: string; label: string; format?: 'money' | 'date' | 'status' | 'boolean'; };
export type ConsoleSectionInfo = { title: string; subtitle: string; description: string; empty: string; capability?: PlatformCapability; columns: ConsoleColumn[]; };
const c = (key: string, label: string, format?: ConsoleColumn['format']): ConsoleColumn => ({ key, label, format });
const retiredSection: ConsoleSectionInfo = { title: 'Kostenlose Nutzung', subtitle: 'CareSuite HealthOS', description: PLATFORM_FREE_USAGE, empty: '', columns: [] };
export const CONSOLE_SECTIONS: Record<ConsoleSection, ConsoleSectionInfo> = {
  dashboard: { title: 'Übersicht', subtitle: 'Die Plattform im Überblick', description: 'Registrierungen, offene Vorgänge und Veränderungen an einem Ort. Öffnen Sie einen Vorgang, um direkt im zuständigen Bereich weiterzuarbeiten.', empty: '', columns: [] },
  tenants: { title: 'Mandanten', subtitle: 'Unternehmen und Zusammenarbeit', description: 'Alle registrierten Unternehmen mit Einrichtungsstand, Ansprechpartnern und Datenumgebung. Die Unternehmensakte verbindet Stammdaten, kostenlose Nutzung, Funktionsfreigaben und Support.', empty: 'Es liegen noch keine passenden Unternehmen vor. Neue Firmen erscheinen nach ihrer Registrierung automatisch in dieser Übersicht.', capability: 'tenants.read', columns: [c('tenantName','Unternehmen'),c('environmentMode','Umgebung','status'),c('lifecycleStatus','Einrichtung','status'),c('freeUsage','Nutzung'),c('status','Zugriff','status'),c('createdAt','Registriert','date')] },
  plans: retiredSection,
  addons: retiredSection,
  modules: { title:'Funktionskatalog', subtitle:'Kostenlose Funktionen und Verfügbarkeit', description:'Verwalten Sie die im Produkt hinterlegten Funktionen, ihre Beschreibung und ihren Freigabestatus. Abhängigkeiten und interne Kennzeichnungen sind in den Details sichtbar. Die Firmenregistrierung benötigt keine Funktionsauswahl.', empty:'Der Produktkatalog enthält noch keine Funktionen. Ein Katalogeintrag beschreibt eine bestehende Implementierung; er erzeugt keine neue Softwarefunktion.', capability:'modules.read', columns:[c('module_name','Funktion'),c('category','Kategorie'),c('status','Verfügbarkeit','status'),c('is_core','Grundfunktion','boolean'),c('is_internal','Intern','boolean'),c('updated_at','Geändert','date')] },
  discounts: retiredSection,
  billing: retiredSection,
  payments: retiredSection,
  'feature-flags': { title:'Funktionsfreigaben', subtitle:'Funktionen gezielt freigeben', description:'Funktionen plattformweit oder für einzelne Unternehmen freigeben. Prüfen Sie vor jeder Änderung, für welche Unternehmen die Freigabe gilt.', empty:'Es sind noch keine Funktionsfreigaben angelegt. Verwenden Sie die interne Kennung einer vorhandenen Funktion.', capability:'flags.read', columns:[c('flag_name','Funktion'),c('flag_key','Interne Kennung'),c('scope','Geltungsbereich'),c('tenant_label','Unternehmen'),c('enabled','Aktiv','boolean'),c('rollout_label','Freigabeanteil'),c('updated_at','Geändert','date')] },
  users:{ title:'Benutzer & Rollen', subtitle:'Zugriffe auf die Plattformverwaltung', description:'Plattformzugriffe prüfen und Rollen gezielt vergeben. Die Rechteübersicht erklärt, welche Bereiche eine Rolle lesen oder verändern darf. Mitarbeitende und Klient:innen werden innerhalb ihrer jeweiligen Unternehmensakte verwaltet.', empty:'Für die gewählten Filter wurden keine Plattformbenutzer gefunden.', capability:'users.read', columns:[c('full_name','Name'),c('email','E-Mail'),c('role','Rolle','status'),c('status','Zugriff','status'),c('last_login_at','Letzte Anmeldung','date')] },
  audit:{title:'Audit & Verlauf',subtitle:'Änderungen nachvollziehen',description:'Wer hat wann was geändert und warum? Öffnen Sie einen Eintrag für Ausgangswert, Ergebnis, Ziel und Begründung. Zeitraum, Unternehmen und Aktion lassen sich eingrenzen; Exporte enthalten ausschließlich die angezeigte Auswahl.',empty:'Für die ausgewählten Filter liegen keine Audit-Einträge vor.',capability:'audit.read',columns:[c('created_at','Zeitpunkt','date'),c('action','Aktion'),c('actor_role','Rolle'),c('tenant_label','Unternehmen'),c('target_type','Bereich'),c('reason','Begründung')]},
  system:{title:'System',subtitle:'Globale Einstellungen kontrollieren',description:'Globale Konfiguration einsehen und mit Begründung ändern. Wahrheitswerte, Zahlen und Texte werden passend bearbeitet; geschützte Einstellungen bleiben maskiert. Auswirkungen ergeben sich aus der jeweiligen Funktion, die diese Einstellung verwendet.',empty:'Es wurden keine Systemeinstellungen gefunden. Prüfen Sie die Datenbankanbindung und den eingerichteten Konfigurationsbestand.',capability:'system.read',columns:[c('display_name','Einstellung'),c('display_value','Aktueller Wert'),c('description','Bedeutung'),c('updated_at','Geändert','date')]},
  releases:{title:'Releases',subtitle:'Bereitstellungen und Prüfergebnisse',description:'Version, Umgebung, Commit, Datenbankstand und tatsächliche Prüfergebnisse dokumentieren. Das Register macht Bereitstellungen nachvollziehbar; ein Eintrag löst keine Veröffentlichung aus.',empty:'Es sind noch keine Releases registriert. Dokumentieren Sie eine tatsächlich geplante oder ausgeführte Bereitstellung mit dem zugehörigen Prüfstand.',capability:'releases.read',columns:[c('version_label','Version'),c('environment','Umgebung','status'),c('status','Ergebnis','status'),c('commit_sha','Commit'),c('migration_version','Datenbankstand'),c('deployed_at','Erfasst','date')]},
};
export const SETTING_NAMES: Record<string,string> = { maintenance_mode:'Wartungsmodus', support_session_minutes:'Dauer einer Support-Sitzung', support_session_max_minutes:'Maximale Dauer einer Support-Sitzung', platform_notice:'Plattformhinweis', registration_enabled:'Firmenregistrierung', allow_new_tenant_signup:'Firmenregistrierung', free_platform_enabled:'Kostenlose Plattformnutzung', default_country:'Standardland', default_timezone:'Zeitzone', billing_grace_period_days:'Bisherige Zahlungsfrist', beta_features_enabled:'Erprobungsfunktionen', payment_provider_mode:'Bisherige Zahlungsabwicklung', invoice_prefix:'Bisheriger Rechnungspräfix' };
const SETTING_HELP: Record<string,string> = {
  maintenance_mode:'Ja sperrt den Zugang zur Website und Websoftware. Die Plattformverwaltung, Hilfe und rechtliche Informationen bleiben erreichbar. Bereits laufende Vorgänge werden nicht automatisch rückgängig gemacht.',
  allow_new_tenant_signup:'Ja erlaubt die kostenlose Firmenregistrierung. Nein pausiert neue Registrierungen; bestehende Unternehmen bleiben freigegeben.',
  registration_enabled:'Ja erlaubt die kostenlose Firmenregistrierung. Nein pausiert neue Registrierungen; bestehende Unternehmen bleiben freigegeben.',
  platform_notice:'Öffentlicher Text auf Website und Websoftware, höchstens 2.000 Zeichen. Ein leerer Text blendet den Hinweis aus. Bitte keine personenbezogenen oder vertraulichen Angaben veröffentlichen.',
};
export type ConsoleQuery = { search: string; status: string; tenantId: string; offset: number; start?:string; end?:string; };
export type ConsoleData = { rows: ConsoleRow[]; tenants: ConsoleRow[]; related: ConsoleRow[]; warnings: string[]; hasMore: boolean; summary?: PlatformDashboardSummary; };
async function unwrap<T>(promise: Promise<ServiceResult<T>>): Promise<T> { const result = await promise; if (!result.ok) throw new Error(result.error); return result.data; }
const rows = async (promise: Promise<ServiceResult<unknown>>): Promise<ConsoleRow[]> => await unwrap(promise) as ConsoleRow[];

export async function loadConsoleData(section: ConsoleSection, query: ConsoleQuery, role: PlatformRoleKey | undefined): Promise<ConsoleData> {
  const result: ConsoleData = { rows:[], tenants:[], related:[], warnings:[], hasMore:false };
  if (isRetiredPlatformSection(section)) return result;
  const can = (capability: PlatformCapability) => api.platformRoleHasCapability(role, capability);
  // Auxiliary permission failures never erase the main page.
  const tenantSections: ConsoleSection[] = ['feature-flags','audit'];
  const directory = tenantSections.includes(section) && can('tenants.read') ? (async()=>{ let offset=0; for(;;){const data=await unwrap(listPlatformCompanies({limit:200,offset}));result.tenants.push(...data.items as unknown as ConsoleRow[]);if(data.items.length<200)break;offset+=200;} })().catch(error => { result.warnings.push(`Unternehmensnamen: ${error.message}`); }) : Promise.resolve();
  switch(section) {
    case 'tenants': { const data = await unwrap(listPlatformCompanies({ search:query.search || undefined,status:query.status || undefined,limit:51,offset:query.offset }));result.rows=data.items.slice(0,50) as unknown as ConsoleRow[];result.hasMore=data.items.length>50; break; }
    case 'modules': result.rows=(await rows(api.listPlatformModules())).filter(row => !String(row.module_key).toLowerCase().includes('bodymap'));break;
    case 'feature-flags':result.rows=await rows(api.listPlatformFeatureFlags());break;
    case 'users': result.rows=await rows(api.listPlatformOperatorUsers());break;
    case 'audit': {const response=await platformRpc<{items:ConsoleRow[]}>('platform_list_console_audit',{p_tenant_id:query.tenantId||null,p_search:query.search||null,p_from:query.start||null,p_until:query.end||null,p_offset:query.offset});if(response.error)throw new Error(response.error.message);const items=response.data?.items??[];result.rows=items.slice(0,50);result.hasMore=items.length>50;break;}
    case 'system':result.rows=(await rows(api.listPlatformSystemSettings())).filter(row=>!['default_trial_days','invoice_due_days'].includes(String(row.setting_key)));break;
    case 'releases':{const response=await platformRpc<{items:ConsoleRow[]}>('platform_list_console_releases',{p_search:query.search||null,p_status:query.status||null,p_from:query.start||null,p_until:query.end||null,p_offset:query.offset});if(response.error)throw new Error(response.error.message);const items=response.data?.items??[];result.rows=items.slice(0,50);result.hasMore=items.length>50;break;}
    case 'dashboard': {
      result.summary=await unwrap(api.fetchPlatformDashboardSummary());
      if(can('audit.read')){try{const response=await platformRpc<{items:ConsoleRow[]}>('platform_list_console_audit',{});if(response.error)throw new Error(response.error.message);result.related=(response.data?.items??[]).slice(0,8);}catch(error){result.warnings.push(`Aktivitätsverlauf: ${error instanceof Error?error.message:String(error)}`);}}
      break;
    }
  }
  await directory;
  const names=new Map(result.tenants.map(row=>[String(row.tenantId),String(row.tenantName)]));
  result.rows=result.rows.map(row=>({...row,
    ...(section==='tenants'?{freeUsage:'Kostenlos'}:{}),
    tenant_label:row.tenant_id ? names.get(String(row.tenant_id)) ?? `Mandant ${String(row.tenant_id).slice(0,8)}` : 'Plattformweit',
    ...(section==='feature-flags'?{rollout_label:row.rollout_percentage==null?'Nicht festgelegt':`${row.rollout_percentage} %`}:{}),
    ...(section==='system'?{display_name:SETTING_NAMES[String(row.setting_key)]??String(row.setting_key).replace(/_/g,' '),display_value:isSensitiveSetting(row)?'Geschützt':consoleText(row.value)}:{}),
  }));
  result.related=result.related.map(row=>({...row,tenant_label:row.tenant_id?names.get(String(row.tenant_id))??`Mandant ${String(row.tenant_id).slice(0,8)}`:'Plattformweit'}));
  return result;
}

export type ConsoleField = { key: string; label: string; type?: 'text'|'textarea'|'select'|'date'|'email'|'number'|'url'; required?: boolean; value?: string; options?: {value:string;label:string}[]; hint?: string; min?: number; max?:number; };
export type ConsoleAction = { key:string; title:string; description:string; capability:PlatformCapability; fields:ConsoleField[]; danger?:boolean; run:(values:Record<string,string>,reason:string)=>Promise<unknown>; };
const field=(key:string,label:string,value:unknown='',type:ConsoleField['type']='text',required=true):ConsoleField=>({key,label,value:value==null?'':String(value),type,required});
const choices=(key:string,label:string,options:string[],value?:unknown):ConsoleField=>({...field(key,label,value??options[0],'select'),options:options.map(value=>({value,label:consoleLabel(value)}))});
const resultOf=async(promise:Promise<ServiceResult<unknown>>)=>unwrap(promise);
const integer=(value:string,min=0,max=2147483647)=>{const n=Number(value);if(!value.trim()||!Number.isInteger(n)||n<min||n>max)throw new Error(`Bitte eine ganze Zahl zwischen ${min} und ${max} eingeben.`);return n;};

export function consoleActions(section:ConsoleSection,row:ConsoleRow|null,data:ConsoleData):ConsoleAction[]{
  if (isRetiredPlatformSection(section)) return [];
  const actions:ConsoleAction[]=[];
  const tenant:ConsoleField={key:'tenant',label:'Unternehmen',type:'select',required:true,options:data.tenants.map(t=>({value:String(t.tenantId),label:String(t.tenantName)}))};
  const status=(values:string[],current?:unknown)=>choices('status','Status',values,current);
  const add=(action:ConsoleAction)=>actions.push({...action,run:async(values,reason)=>action.run(values,reason)});
  if(section==='modules')add({key:'module',title:row?'Funktion bearbeiten':'Funktion erfassen',description:'Beschreibung und Katalogstatus einer vorhandenen Funktion ändern. Grundfunktionen können hier nicht deaktiviert werden.',capability:'modules.write',fields:[...(!row?[field('key','Interne Kennung')]:[]),field('name','Bezeichnung',row?.module_name),field('category','Kategorie',row?.category,'text',false),field('description','Beschreibung',row?.description,'textarea',false),status(row?.is_core?['available','beta']:['available','beta','internal','deprecated','disabled'],row?.status??'available')],run:async(v,reason)=>{if(getServiceMode()==='demo')throw new Error('Katalogänderungen benötigen eine echte Datenbankverbindung.');const res=await platformRpc('platform_save_module_catalog',{p_key:row?.module_key??v.key,p_name:v.name,p_description:v.description,p_category:v.category,p_status:v.status,p_reason:reason});if(res.error)throw new Error(res.error.message);return res.data;}});
  if(section==='feature-flags'&&(!row||['global','tenant'].includes(String(row.scope))))add({key:'flag',title:row?'Freigabe bearbeiten':'Funktionsfreigabe anlegen',description:'Geltungsbereich und Freigabeanteil prüfen. Ein globaler Schalter betrifft alle Mandanten, für die keine abweichende Freigabe gilt.',capability:'flags.write',fields:[...(!row?[field('key','Interne Kennung'),choices('scope','Geltungsbereich',['tenant','global']),{...tenant,required:false}]:[]),choices('enabled','Freigabe',['false','true'],String(row?.enabled??false)),{...field('rollout','Freigabeanteil in Prozent',row?.rollout_percentage??100,'number'),min:0,max:100}],danger:row?.scope==='global',run:(v,reason)=>{const scope=String(row?.scope??v.scope);const tenantId=String(row?.tenant_id??v.tenant??'');if(scope==='tenant'&&!tenantId)throw new Error('Für eine mandantenbezogene Freigabe ist ein Unternehmen erforderlich.');const key=String(row?.flag_key??v.key);if(!/^[a-z0-9_.-]{3,100}$/.test(key))throw new Error('Die interne Kennung muss 3–100 Kleinbuchstaben, Zahlen, Punkte, Unterstriche oder Bindestriche enthalten.');return resultOf(api.setPlatformFeatureFlag(key,v.enabled==='true',reason,{scope,tenantId:scope==='tenant'?tenantId:undefined,rolloutPercentage:integer(v.rollout,0,100)}));}});
  if(section==='users'&&!row)add({key:'add-user',title:'Plattformzugriff hinzufügen',description:'Einem bereits registrierten Benutzer Zugriff auf die Plattformverwaltung geben. Es wird keine Einladung versandt. Die E-Mail-Adresse muss exakt zum bestehenden Konto passen.',capability:'users.write',fields:[field('email','E-Mail des vorhandenen Kontos','','email'),choices('role','Rolle',Object.keys(api.PLATFORM_ROLE_LABELS),'platform_readonly')],danger:true,run:async(v,reason)=>{const result=await platformRpc('platform_add_operator_user',{p_email:v.email,p_role:v.role,p_reason:reason});if(result.error)throw new Error(result.error.message);return result.data;}});
  if(section==='users'&&row)add({key:'user',title:'Plattformzugriff bearbeiten',description:`Rolle und Zugriff für ${row.email} ändern. Der letzte aktive Inhaber bleibt geschützt.`,capability:'users.write',fields:[choices('role','Rolle',Object.keys(api.PLATFORM_ROLE_LABELS),row.role),status(['active','disabled','revoked'],row.status)],danger:true,run:(v,reason)=>resultOf(api.updatePlatformOperatorUser(String(row.id),v.role as PlatformRoleKey,v.status as PlatformUserStatus,reason))});
  if(section==='system'&&row&&!isSensitiveSetting(row)&&!['free_platform_enabled','default_trial_days','invoice_due_days'].includes(String(row.setting_key)))add({key:'setting',title:'Einstellung bearbeiten',description:SETTING_HELP[String(row.setting_key)]??String(row.description??'Diese Einstellung wirkt plattformweit.'),capability:'system.write',fields:[typeof row.value==='boolean'?choices('value','Wert',['false','true'],String(row.value)):field('value','Wert',typeof row.value==='object'?JSON.stringify(row.value,null,2):row.value,typeof row.value==='number'?'number':typeof row.value==='object'||row.setting_key==='platform_notice'?'textarea':'text',false)],danger:row.setting_key==='maintenance_mode',run:(v,reason)=>{const value=consoleSettingValue(row.value,v.value);if(row.setting_key==='platform_notice'&&typeof value==='string'&&Array.from(value).length>2000)throw new Error('Der Plattformhinweis darf höchstens 2.000 Zeichen enthalten.');return resultOf(api.updatePlatformSystemSetting(String(row.setting_key),value,reason));}});
  if(section==='releases'&&!row)add({key:'release',title:'Release registrieren',description:'Tatsächlichen Stand dokumentieren. Prüfergebnisse werden ausdrücklich angegeben und nicht aus dem Release-Status abgeleitet.',capability:'system.write',fields:[field('version','Versionsbezeichnung'),choices('environment','Umgebung',['preview','staging','production']),status(['planned','building','ready','failed','rolled_back'],'planned'),field('commit','Git-Commit','','text',false),field('url','Deployment-URL','','url',false),field('migration','Datenbankstand','','text',false),choices('build','Build-Prüfung',['not_checked','passed','failed'],'not_checked'),choices('smoke','Funktionsprüfung',['not_checked','passed','failed'],'not_checked'),choices('visual','Darstellungsprüfung',['not_checked','passed','failed'],'not_checked'),field('notes','Prüfnotiz','','textarea',false)],run:(v,reason)=>{if(v.commit&&!/^[a-f0-9]{7,40}$/i.test(v.commit))throw new Error('Der Git-Commit muss 7–40 hexadezimale Zeichen enthalten.');if(v.url){const url=new URL(v.url);if(url.protocol!=='https:')throw new Error('Bitte eine HTTPS-Adresse angeben.');}return resultOf(api.registerPlatformRelease({environment:v.environment as 'preview'|'staging'|'production',version_label:v.version,commit_sha:v.commit||null,status:v.status as 'planned'|'building'|'ready'|'failed'|'rolled_back',deployment_url:v.url||null,migration_version:v.migration||null,notes:v.notes||null,checks:{build:v.build,smoke:v.smoke,visual:v.visual,recorded_in_console:true}},reason));}});
  return actions;
}

export function formatConsoleCell(row:ConsoleRow,column:ConsoleColumn):string {
  const value=row[column.key];
  if(column.key==='action') return platformActionLabel(value);
  if(column.key==='plan_name') return platformName(row.plan_key,String(value||'Individueller Tarif'));
  if(column.key==='module_name') return platformName(row.module_key,String(value||'Funktionsbereich'));
  if(column.key==='included_module_keys' && Array.isArray(value)) return value.map(key=>platformName(key,'Funktionsbereich')).join(', ');
  if(column.format==='money')return consoleMoney(value,row.currency);
  if(column.format==='date')return consoleDate(value);
  if(column.format==='boolean')return value==null?'—':value?'Ja':'Nein';
  return consoleText(value);
}
export async function loadConsoleVersions(section:ConsoleSection,row:ConsoleRow):Promise<ConsoleRow[]> {
  if (isRetiredPlatformSection(section)) return [];
  return rows(section==='plans'?api.listPlatformPlanVersions(String(row.plan_key)):api.listPlatformAddonVersions(String(row.addon_key)));
}
