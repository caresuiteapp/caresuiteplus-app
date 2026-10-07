import { useCallback,useEffect,useRef,useState } from 'react';
import { useRouter } from 'expo-router';
import { ConsoleBadge,ConsoleDialog,ConsolePanel,ConsoleStats } from './ConsoleWorkspaceUi.web';
import { consoleDate,consoleLabel } from '@/lib/platformConsole/consoleWorkspaceModel';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import { platformRoleHasCapability } from '@/lib/platformConsole/platformCapabilities';
import { getPlatformOperationsPage,setIncidentResolution,
  OBSERVATION_AREAS,OBSERVATION_ISSUES,OBSERVATION_OPERATIONS,REGISTRATION_STAGES,REGISTRATION_STATES,PLATFORM_OPERATIONS_RELEASE,
  type OperationsSummary,type RegistrationActivity,type RuntimeIncident } from '@/lib/platformConsole/platformOperationsService.web';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';

type Tab='inventory'|'live'|'registrations'|'errors';
const tabNames:Record<Tab,string>={inventory:'Bestände',live:'Live-Nutzung',registrations:'Registrierungen',errors:'Fehler'};
const number=(value:number|null|undefined)=>value==null?'—':new Intl.NumberFormat('de-DE').format(value);
const issue=(value:string|null)=>value?OBSERVATION_ISSUES[value]??'Ergebnis muss geprüft werden':'Keine Störung gemeldet';

export function PlatformOperationsPanel({full=false}:{full?:boolean}){
  const router=useRouter();
  const {platformUser}=usePlatformAuth();
  const role=platformUser?.role;
  const canRead=platformRoleHasCapability(role,'tenants.read');
  const canMonitor=platformRoleHasCapability(role,'system.read');
  const canResolve=platformRoleHasCapability(role,'system.write');
  const [summary,setSummary]=useState<OperationsSummary|null>(null);
  const [tab,setTab]=useState<Tab>('inventory');
  const [registrationState,setRegistrationState]=useState('');
  const [incidentStatus,setIncidentStatus]=useState('open');
  const [offset,setOffset]=useState(0);
  const [registrations,setRegistrations]=useState<RegistrationActivity[]>([]);
  const [incidents,setIncidents]=useState<RuntimeIncident[]>([]);
  const [hasMore,setHasMore]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [selectedRegistration,setSelectedRegistration]=useState<RegistrationActivity|null>(null);
  const [selectedIncident,setSelectedIncident]=useState<RuntimeIncident|null>(null);
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(n=>n+1),[]);
  useEffect(()=>{
    if(!canRead)return;
    let alive=true;let loading=false;
    async function poll(){
      if(loading||document.visibilityState==='hidden')return;
      loading=true;setBusy(true);
      try{
        const results=await getPlatformOperationsPage({full,canMonitor,tab,registrationState,incidentStatus,offset});
        if(!alive)return;
        setSummary(results.summary);setError('');
        setRegistrations(results.registrations?.items.slice(0,50)??[]);
        setIncidents(results.incidents?.items.slice(0,50)??[]);
        setHasMore((results.registrations?.items.length??results.incidents?.items.length??0)>50);
      }catch(cause){if(alive)setError(cause instanceof Error?cause.message:'Die Betriebsübersicht konnte nicht aktualisiert werden.');}
      finally{loading=false;if(alive)setBusy(false);}
    }
    void poll();
    const timer=setInterval(()=>void poll(),15_000);
    const visibility=()=>{if(document.visibilityState==='visible')void poll();};
    document.addEventListener('visibilitychange',visibility);
    return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);};
  },[canRead,canMonitor,full,role,tab,registrationState,incidentStatus,offset,revision]);
  if(!canRead)return null;
  const t=summary?.telemetry;
  const activated=Boolean(t);
  const measured=Boolean(t?.firstEventAt);
  const live=(value:number|undefined)=>measured?number(value):'—';
  const selectTab=(next:Tab)=>{setTab(next);setOffset(0);setHasMore(false);setRegistrations([]);setIncidents([]);};
  const openCompany=(id:string)=>router.push(`/platform/tenants/${encodeURIComponent(id)}` as never);
  return <ConsolePanel title={full?'Betrieb & Nutzung':'Die gesamte Plattform'}
    description={summary?`Serverstand: ${consoleDate(summary.checkedAt)} · Aktualisierung alle 15 Sekunden`:'Zentrale Betriebsdaten werden geladen'}
    actions={<div className="cs-actions"><button className="cs-btn" disabled={busy} onClick={refresh}>↻ Aktualisieren</button>{!full&&canMonitor&&<button className="cs-btn" onClick={()=>router.push('/platform/system' as never)}>Betriebszentrale öffnen</button>}</div>}>
    <div className="cs-panel-body" data-platform-operations={PLATFORM_OPERATIONS_RELEASE}>
      {error&&<div className="cs-notice error" role="alert">{error}{summary&&<p>Die angezeigten Zahlen stammen vom {consoleDate(summary.checkedAt)}.</p>}<button className="cs-link" disabled={busy} onClick={refresh}>Erneut versuchen</button></div>}
      {!summary&&<p role="status">{busy?'Bestände und Betriebsdaten werden abgefragt.':'Noch keine bestätigten Betriebsdaten verfügbar.'}</p>}
      {full&&<nav className="cs-tabs" aria-label="Betriebsbereiche">{(Object.keys(tabNames) as Tab[]).filter(key=>key==='inventory'||canMonitor).map(key=><button className="cs-tab" key={key} aria-pressed={tab===key} onClick={()=>selectTab(key)}>{tabNames[key]}</button>)}</nav>}
      {summary&&(!full||tab==='inventory')&&<>
        <ConsoleStats items={[
          {label:'Klienten im Bestand',value:number(summary.inventory.clients),hint:'Systemweit, ohne gelöschte Klienten'},
          {label:'Mitarbeitende im Bestand',value:number(summary.inventory.employees),hint:'Systemweit, ohne gelöschte Mitarbeitende'},
          ...(full?[{label:'Unternehmen gesamt',value:number(summary.inventory.companies),hint:'Einschließlich gelöschter Unternehmensakten'},
            {label:'Aktive Unternehmen',value:number(summary.inventory.activeCompanies)},{label:'Gesperrt oder blockiert',value:number(summary.inventory.suspendedCompanies)},
            {label:'Deaktivierte Unternehmen',value:number(summary.inventory.deactivatedCompanies)},{label:'Gelöschte Unternehmen',value:number(summary.inventory.deletedCompanies)},
            {label:'Klientendatensätze gesamt',value:number(summary.inventory.clients+summary.inventory.deletedClients),hint:'Einschließlich gelöschter Datensätze'},
            {label:'Mitarbeitendendatensätze gesamt',value:number(summary.inventory.employees+summary.inventory.deletedEmployees),hint:'Einschließlich gelöschter Datensätze'},
            {label:'Gelöschte Klienten',value:number(summary.inventory.deletedClients)},{label:'Gelöschte Mitarbeitende',value:number(summary.inventory.deletedEmployees)}]:[]),
        ]}/>
        <p>Der Bestand enthält erhaltene Datensätze aller Unternehmen. Test- und Produktivdaten stehen getrennt in der folgenden Übersicht. Bereits endgültig entfernte Datensätze lassen sich daraus nicht rekonstruieren.</p>
        <div className="cs-table-scroll"><table className="cs-table"><thead><tr><th scope="col">Datenumgebung</th><th scope="col">Unternehmen</th><th scope="col">Klienten</th><th scope="col">Mitarbeitende</th></tr></thead><tbody>{summary.inventory.environments.map(row=><tr key={row.mode}><td>{consoleLabel(row.mode)}</td><td>{number(row.companies)}</td><td>{number(row.clients)}</td><td>{number(row.employees)}</td></tr>)}</tbody></table></div>
      </>}
      {summary&&canMonitor&&(!full||tab==='live')&&<>
        <ConsoleStats items={[
          {label:'Website: aktive Ansichten',value:live(t?.websiteViews),hint:'Einschließlich Firmenregistrierung'},
          {label:'Software: aktive Konten',value:live(t?.softwareAccounts),hint:'Bestätigte Anmeldungen, jedes Konto einmal'},
          {label:'Unternehmen gerade aktiv',value:live(t?.softwareCompanies)},
          {label:'Registrierungen gerade aktiv',value:live(t?.registrationsLive)},
          ...(full?[{label:'Plattformkonten gerade aktiv',value:live(t?.platformAccounts)}]:[]),
        ]}/>
        {!activated&&<p className="cs-notice" role="status">Erfassung noch nicht aktiviert. Es liegen keine gemessenen Live-Zahlen vor.</p>}
        {activated&&!measured&&<p className="cs-notice" role="status">Es wurden noch keine Betriebsmeldungen empfangen. Live-Werte werden erst nach Beginn der Erfassung angezeigt.</p>}
        <p>„Live“ bedeutet: eine sichtbare Seite hat innerhalb der letzten 90 Sekunden eine Meldung gesendet. Offene Websiteansichten können mehrere Fenster derselben Person enthalten. Softwarekonten werden anhand der bestätigten Anmeldung zusammengefasst.</p>
        <p>Erfasst werden Web und Desktop auf caresuiteplus.app. Die unveränderte Android-App, blockierte Meldungen und Browser mit ausgeschalteter Erfassung sind nicht enthalten. Die Werte beginnen mit der Bereitstellung dieser Erfassung; frühere Besuche und Abbrüche werden nicht nachträglich erfunden.</p>
        {t?.lastEventAt&&<small>Letzte empfangene Meldung: {consoleDate(t.lastEventAt)}</small>}
      </>}
      {summary&&full&&tab==='inventory'&&<ConsoleStats items={[
        {label:'Offene Supporttickets',value:number(summary.operations.openSupportTickets)},
        {label:'Genehmigte Datenzugriffe',value:number(summary.operations.approvedSupportAccess)},
        {label:'Willkommensmail ausstehend',value:number(summary.operations.welcomePending)},
        {label:'Mailversand zu prüfen',value:number(summary.operations.welcomeNeedsReview)},
        {label:'Kontovorgänge zu prüfen',value:number(summary.operations.accountOperationsNeedReview)},
      ]}/>}
      {summary&&full&&canMonitor&&!activated&&['registrations','errors'].includes(tab)&&<p className="cs-notice" role="status">Erfassung noch nicht aktiviert. Die Bestandsübersicht funktioniert bereits; Registrierungsverläufe und automatische Fehlermeldungen benötigen die gesonderte Freigabe ihrer Erfassung.</p>}
      {summary&&full&&canMonitor&&activated&&tab==='registrations'&&<>
        <ConsoleStats items={[{label:'Begonnen, letzte 24 Stunden',value:measured?number(t?.registrationsToday):'—'},
          {label:'Abgeschlossen, letzte 24 Stunden',value:measured?number(t?.registrationsCompletedToday):'—'},
          {label:'Aktuell mit Hinweis',value:measured?number(t?.registrationsWithIssue):'—'}]}/>
        <p>Vor der abgeschlossenen Kontoanlage bleibt ein Versuch anonym. Erfasst werden nur Schritte und Ergebnisse. Ein verlassener oder inaktiver Versuch zeigt einen möglichen Abbruch; sein persönlicher Grund ist dadurch nicht bekannt.</p>
        <label className="cs-field">Registrierungsstand<select value={registrationState} onChange={e=>{setRegistrationState(e.target.value);setOffset(0);setRegistrations([]);}}><option value="">Alle Versuche</option>{['active','recent','completed','failed','left','inactive','uncertain'].map(key=><option key={key} value={key}>{REGISTRATION_STATES[key]}</option>)}</select></label>
        <div className="cs-table-scroll"><table className="cs-table"><thead><tr><th scope="col">Unternehmen / Versuch</th><th scope="col">Stand</th><th scope="col">Letzter Schritt</th><th scope="col">Letzte Meldung</th><th scope="col">Hinweis</th></tr></thead><tbody>{registrations.map(row=><tr key={row.id}><td><button className="cs-link" onClick={()=>setSelectedRegistration(row)}>{row.company_name??`Anonymer Versuch ${row.id.slice(0,8)}`}</button>{row.owner_name&&<small>{row.owner_name}</small>}</td><td><ConsoleBadge value={row.state==='completed'?'active':row.state==='failed'?'failed':'pending'} label={REGISTRATION_STATES[row.state]??'Zu prüfen'}/></td><td>{REGISTRATION_STAGES[row.stage]??'Noch nicht erfasst'}</td><td>{consoleDate(row.last_seen_at)}</td><td>{issue(row.issue)}</td></tr>)}</tbody></table></div>
        {!busy&&!error&&!registrations.length&&<p>Keine Registrierungsversuche für diese Auswahl erfasst.</p>}
        <p><small>Verlauf der letzten 14 Tage. Jede Seite enthält bis zu 50 Versuche.</small></p>
      </>}
      {summary&&full&&canMonitor&&activated&&tab==='errors'&&<>
        <ConsoleStats items={[{label:'Offene Fehlergruppen',value:measured?number(t?.openIncidents):'—'},
          {label:'Letzte Fehlermeldung',value:consoleDate(t?.latestIncidentAt)}]}/>
        <p>Automatisch erfasste Verbindungs-, Server- und Seitenfehler sowie abgewiesene Anfragen. Eine verweigerte Berechtigung kann gewollt sein. Die Übersicht enthält keine Formulareingaben, Passwörter oder persönlichen Falldetails; solche Details bleiben an die Supportfreigabe gebunden.</p>
        <label className="cs-field">Bearbeitungsstand<select value={incidentStatus} onChange={e=>{setIncidentStatus(e.target.value);setOffset(0);setIncidents([]);}}><option value="open">Offen</option><option value="resolved">Erledigt</option><option value="">Alle Meldungen</option></select></label>
        <div className="cs-table-scroll"><table className="cs-table"><thead><tr><th scope="col">Fehler / Hinweis</th><th scope="col">Bereich</th><th scope="col">Unternehmen</th><th scope="col">Meldungen</th><th scope="col">Zuletzt</th><th scope="col">Stand</th></tr></thead><tbody>{incidents.map(row=><tr key={row.id}><td><button className="cs-link" onClick={()=>setSelectedIncident(row)}>{issue(row.category)}</button><small>{OBSERVATION_OPERATIONS[row.operation]??'Betriebsvorgang'}</small></td><td>{OBSERVATION_AREAS[row.area]??'Weiterer Bereich'}</td><td>{row.company_name??'Ohne Unternehmenszuordnung'}</td><td>{number(row.occurrences)}</td><td>{consoleDate(row.last_seen_at)}</td><td>{row.resolved?'Erledigt':'Offen'}</td></tr>)}</tbody></table></div>
        {!busy&&!error&&!incidents.length&&<p>Keine erfassten Meldungen für diese Auswahl. Das belegt keine Fehlerfreiheit der gesamten Software.</p>}
        <p><small>Erfasste Meldungen der letzten 30 Tage. Wiederkehrende Meldungen werden zusammengefasst; erneutes Auftreten öffnet einen erledigten Fehler wieder.</small></p>
      </>}
      {full&&activated&&['registrations','errors'].includes(tab)&&<div className="cs-pager"><span>Datenseite {Math.floor(offset/50)+1}</span><div className="cs-actions"><button className="cs-btn" disabled={busy||offset===0} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Zurück</button><button className="cs-btn" disabled={busy||!hasMore} onClick={()=>setOffset(n=>n+50)}>Weiter</button></div></div>}
      {selectedRegistration&&<ConsoleDialog title="Registrierungsverlauf" description={selectedRegistration.company_name??'Anonymer Registrierungsversuch'} onClose={()=>setSelectedRegistration(null)}>
        <p>Begonnen: {consoleDate(selectedRegistration.started_at)} · Letzter Stand: {REGISTRATION_STATES[selectedRegistration.state]??'Zu prüfen'}</p>
        <p>Weitester Schritt: {REGISTRATION_STAGES[selectedRegistration.furthest_stage]} · {issue(selectedRegistration.issue)}</p>
        {selectedRegistration.events.map((event,i)=><div className="cs-task" key={i}><div><b>{REGISTRATION_STAGES[event.stage]} · {REGISTRATION_STATES[event.state]??'Zu prüfen'}</b><p>{consoleDate(event.created_at)}{event.issue?` · ${issue(event.issue)}`:''}</p></div></div>)}
        {selectedRegistration.tenant_id&&<button className="cs-btn" onClick={()=>openCompany(selectedRegistration.tenant_id!)}>Unternehmensakte öffnen</button>}
      </ConsoleDialog>}
      {selectedIncident&&<IncidentEditor row={selectedIncident} canResolve={canResolve} onClose={()=>setSelectedIncident(null)} onSaved={()=>{setSelectedIncident(null);refresh();}}/>}
    </div>
  </ConsolePanel>;
}

function IncidentEditor({row,canResolve,onClose,onSaved}:{row:RuntimeIncident;canResolve:boolean;onClose:()=>void;onSaved:()=>void}){
  const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);
  const confirmLeave=useUnsavedWebChanges(Boolean(reason.trim()),busy);
  const close=async()=>{if(await confirmLeave())onClose();};
  async function save(){
    if(lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try{await setIncidentResolution(row,!row.resolved,reason);onSaved();}
    catch(cause){setError(cause instanceof Error?cause.message:'Der Bearbeitungsstand konnte nicht bestätigt werden.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <ConsoleDialog title={issue(row.category)} description={OBSERVATION_AREAS[row.area]??'Softwarebetrieb'} busy={busy} onClose={()=>void close()}>
    <dl className="cs-kv"><dt>Vorgang</dt><dd>{OBSERVATION_OPERATIONS[row.operation]}</dd><dt>Unternehmen</dt><dd>{row.company_name??'Ohne Unternehmenszuordnung'}</dd>
      <dt>Erstmals</dt><dd>{consoleDate(row.first_seen_at)}</dd><dt>Zuletzt</dt><dd>{consoleDate(row.last_seen_at)}</dd><dt>Meldungen</dt><dd>{number(row.occurrences)}</dd>
      <dt>Stand</dt><dd>{row.resolved?'Erledigt':'Offen'}</dd><dt>Letzte Bearbeitung</dt><dd>{row.resolution??'Noch keine Bearbeitung dokumentiert'}</dd></dl>
    <details><summary>Technische Referenz anzeigen</summary><p>Fehlerreferenz: {row.id} · Serverantwort: {row.http_status??'Keine Antwort erfasst'}</p></details>
    {canResolve&&<form onSubmit={e=>{e.preventDefault();void save();}}><label className="cs-field">Begründung *<textarea required minLength={5} maxLength={1000} disabled={busy} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ursache, Bearbeitung und Ergebnis dokumentieren"/></label><button className="cs-btn primary" disabled={busy||reason.trim().length<5}>{busy?'Wird gespeichert…':row.resolved?'Wieder öffnen':'Als erledigt markieren'}</button></form>}
    {error&&<p className="cs-notice error" role="alert">{error}</p>}
  </ConsoleDialog>;
}
