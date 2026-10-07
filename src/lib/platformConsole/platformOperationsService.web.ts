import { platformRpc } from './platformSupabaseClient';
import { getServiceMode } from '@/lib/services/mode';

export const PLATFORM_OPERATIONS_RELEASE='caresuite-platform-operations-20261007';
export type OperationsSummary={
  release:string;checkedAt:string;
  inventory:{companies:number;activeCompanies:number;suspendedCompanies:number;deactivatedCompanies:number;deletedCompanies:number;
    clients:number;deletedClients:number;employees:number;deletedEmployees:number;administrationAccounts:number;
    environments:{mode:string;companies:number;clients:number;employees:number}[]};
  operations:{openSupportTickets:number|null;approvedSupportAccess:number|null;welcomePending:number;welcomeNeedsReview:number;accountOperationsNeedReview:number};
  telemetry:{firstEventAt:string|null;lastEventAt:string|null;websiteViews:number;softwareAccounts:number;softwareCompanies:number;platformAccounts:number;
    registrationsLive:number;registrationsToday:number;registrationsCompletedToday:number;registrationsWithIssue:number;openIncidents:number;latestIncidentAt:string|null;
    heartbeatSeconds:number;liveWindowSeconds:number;registrationRetentionDays:number;incidentRetentionDays:number}|null;
};
export type RegistrationActivity={id:string;stage:number;furthest_stage:number;state:string;issue:string|null;started_at:string;last_seen_at:string;
  completed_at:string|null;tenant_id:string|null;company_name:string|null;owner_name:string|null;
  events:{stage:number;state:string;issue:string|null;created_at:string}[]};
export type RuntimeIncident={id:string;surface:string;area:string;category:string;operation:string;http_status:number|null;tenant_id:string|null;
  company_name:string|null;occurrences:number;first_seen_at:string;last_seen_at:string;resolved:boolean;resolution:string|null;resolved_at:string|null};
export const REGISTRATION_STAGES=['Unternehmen','Anschrift & Kontakt','Verwaltungskonto','Passwort & Zustimmung','Prüfen & abschicken'];
export const REGISTRATION_STATES:Record<string,string>={active:'In Bearbeitung',recent:'Kurze Pause',progress:'Angaben werden erfasst',submitting:'Wird abgeschickt',
  completed:'Abgeschlossen',failed:'Mit Fehler',left:'Verlassen',inactive:'Inaktiv (Abbruch möglich)',uncertain:'Ergebnis unklar'};
export const OBSERVATION_ISSUES:Record<string,string>={validation:'Angaben müssen geprüft werden',connection:'Verbindung unterbrochen',permission:'Zugriff abgewiesen',
  timeout:'Zeitüberschreitung',server:'Server konnte die Anfrage nicht abschließen',unknown:'Ergebnis nicht bestätigt',account_exists:'Kontoanlage abgewiesen; bestehende Anmeldung prüfen',
  server_unconfirmed:'Einrichtung konnte nicht bestätigt werden',render:'Seite konnte nicht vollständig angezeigt werden',unexpected:'Unerwarteter Seitenfehler'};
export const OBSERVATION_AREAS:Record<string,string>={website:'Website',registration:'Firmenregistrierung',login:'Anmeldung',office:'Unternehmensverwaltung',
  assist:'Alltagsbegleitung',care:'Pflege',employee:'Mitarbeitendenportal',client:'Klientenportal',relative:'Angehörigenportal',platform:'Plattformverwaltung',other:'Weiterer Softwarebereich'};
export const OBSERVATION_OPERATIONS:Record<string,string>={database:'Daten laden oder speichern',login:'Anmeldung',storage:'Dateizugriff',registration:'Firmenregistrierung',function:'Serverfunktion',page:'Seitenanzeige'};
async function request<T>(name:string,args?:Record<string,unknown>):Promise<T>{
  if(getServiceMode()==='demo')throw new Error('Die Betriebszentrale zeigt echte Serverdaten. Im Demomodus werden keine Live-Zahlen erzeugt.');
  const result=await platformRpc<T>(name,args);
  if(result.error)throw new Error(result.error.message);
  if(result.data==null)throw new Error('Die Betriebsdaten wurden nicht bestätigt. Bitte erneut aktualisieren.');
  return result.data;
}
export const getPlatformOperationsSummary=()=>request<OperationsSummary>('platform_get_operations_summary');
export const listRegistrationActivity=(state:string,offset:number)=>request<{items:RegistrationActivity[]}>('platform_list_registration_activity',{p_state:state,p_offset:offset});
export const listRuntimeIncidents=(status:string,offset:number)=>request<{items:RuntimeIncident[]}>('platform_list_runtime_incidents',{p_status:status,p_offset:offset});
export async function getPlatformOperationsPage(options:{full:boolean;canMonitor:boolean;tab:string;registrationState:string;incidentStatus:string;offset:number}){
  const summary=await getPlatformOperationsSummary();
  // The inventory release has no observation endpoints. Never call them before activation.
  const registrations=summary.telemetry&&options.full&&options.canMonitor&&options.tab==='registrations'
    ?await listRegistrationActivity(options.registrationState,options.offset):null;
  const incidents=summary.telemetry&&options.full&&options.canMonitor&&options.tab==='errors'
    ?await listRuntimeIncidents(options.incidentStatus,options.offset):null;
  return {summary,registrations,incidents};
}
export async function setIncidentResolution(row:RuntimeIncident,resolved:boolean,reason:string){
  if(getServiceMode()==='demo')throw new Error('In der Vorschau werden keine Fehler bearbeitet.');
  if(reason.trim().length<5||reason.trim().length>1000)throw new Error('Bitte eine Begründung mit fünf bis 1.000 Zeichen angeben.');
  const result=await platformRpc('platform_set_incident_resolution',{p_id:row.id,p_expected_last_seen_at:row.last_seen_at,p_resolved:resolved,p_reason:reason.trim()});
  if(result.error)throw new Error(result.error.message);
}
