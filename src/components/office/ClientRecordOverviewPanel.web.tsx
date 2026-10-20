import type { ReactNode } from 'react';
import { DocumentRecommendations } from '@/components/documents/DocumentRecommendations';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchClientAssignments } from '@/lib/assist/assignmentListService';
import { selectNextClientAssignment, type ClientRecordOverview } from '@/lib/clients/clientRecordOverview.web';
import type { ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { formatDate, formatDateTime, formatTimeRange, formatWeekday } from '@/lib/formatters/dateTimeFormatters';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';

type Props = {
  clientId?: string;
  overview: ClientRecordOverview;
  onNavigateTab: (tab: ClientRecordTabKey) => void;
};

type IconName = 'calendar' | 'file' | 'arrow' | 'check' | 'phone' | 'clock' | 'person' | 'list';
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    calendar: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16m-11 5h.01M15 16h.01" /></>,
    file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5M9 12h6m-6 4h6" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    phone: <path d="M8 3H5a2 2 0 0 0-2 2c0 9 7 16 16 16a2 2 0 0 0 2-2v-3l-5-2-2 2a13 13 0 0 1-6-6l2-2z" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11m-17-12 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function CardHeader({ icon, title, action }: { icon: IconName; title: string; action?: ReactNode }) {
  return <div className="cs-record-overview-heading"><span className="cs-record-overview-symbol"><Icon name={icon} /></span><h3>{title}</h3>{action}</div>;
}
function Field({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd className={value === '—' ? 'cs-record-overview-missing' : undefined}>{value === '—' ? 'Nicht hinterlegt' : value}</dd></div>;
}
function Phone({ value }: { value: string | null }) {
  const target = value?.replace(/[^\d+]/g, '');
  return target && /\d/.test(target) ? <a className="cs-record-overview-phone" href={`tel:${target}`}><Icon name="phone" />{value}</a> : <span className="cs-record-overview-muted">Keine Telefonnummer hinterlegt</span>;
}

function UpcomingAssignment({ clientId, onOpen }: { clientId: string; onOpen: () => void }) {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const query = useAsyncQuery(
    () => tenantId ? fetchClientAssignments(tenantId, clientId, profile?.roleKey, { userId: profile?.id, employeeId: profile?.employeeId }) : Promise.resolve({ ok: false as const, error: 'Kein Unternehmen ausgewählt.' }),
    [tenantId, clientId, profile?.roleKey, profile?.id, profile?.employeeId],
    { enabled: Boolean(tenantId && clientId), queryKey: `client-assignments:${tenantId}:${clientId}:${profile?.id}:${profile?.roleKey}` },
  );
  const next = selectNextClientAssignment(query.data ?? []);
  const dateParts = next ? formatDate(next.scheduledStart).split('.') : [];
  return <section className="cs-record-overview-card cs-record-overview-appointment" aria-label="Nächster Einsatz">
    <CardHeader icon="calendar" title="Nächster Einsatz" />
    {!tenantId ? <p>Wählen Sie ein Unternehmen, um die Einsatzplanung zu sehen.</p> : query.loading && !query.data ? <p role="status">Einsatzplanung wird geladen…</p> : query.error && !query.data ? <div className="cs-record-overview-empty"><strong>Einsatzplanung gerade nicht verfügbar</strong><p role="alert">Die Termine konnten nicht geladen werden.</p><button type="button" className="cs-record-overview-text-button" onClick={() => void query.refresh()}>Erneut laden</button></div> : next ? <>
      <div className="cs-record-overview-appointment-main"><div className="cs-record-overview-date" aria-hidden="true"><span>{formatWeekday(next.scheduledStart)}</span><strong>{dateParts[0]}</strong><span>{dateParts[1]}.{dateParts[2]}</span></div><div className="cs-record-overview-appointment-copy"><span className="cs-record-overview-status">{next.assignmentStatus ? ASSIGNMENT_STATUS_LABELS[next.assignmentStatus] : 'Im Einsatzplan'}</span><h4>{next.serviceName || next.title}</h4><p>{formatDate(next.scheduledStart)} · {formatTimeRange(next.scheduledStart, next.scheduledEnd)}</p><p>{next.employeeName || 'Mitarbeitende noch nicht zugewiesen'}</p>{next.location ? <p className="cs-record-overview-muted">{next.location}</p> : null}</div></div>
    </> : <div className="cs-record-overview-empty"><strong>{query.refreshError ? 'Im zuletzt geladenen Stand kein anstehender Einsatz' : 'Kein aktueller oder zukünftiger Einsatz'}</strong><p>{query.refreshError ? 'Ob inzwischen neue Einsätze geplant wurden, konnte nicht geprüft werden.' : 'Die gespeicherten Einsätze enthalten derzeit keinen anstehenden Termin.'}</p></div>}
    {query.refreshError ? <p role="alert">Die letzte Aktualisierung ist fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand. <button type="button" className="cs-record-overview-text-button" onClick={() => void query.refresh()}>Erneut laden</button></p> : null}
    <button type="button" className="cs-record-overview-primary" onClick={onOpen}>Einsätze & Termine öffnen <Icon name="arrow" /></button>
  </section>;
}

const quickCopy: Partial<Record<ClientRecordTabKey, { title: string; hint: string; icon: IconName }>> = {
  stammdaten: { title: 'Angaben ansehen', hint: 'Persönliche Daten und Versorgung', icon: 'person' },
  einsaetze: { title: 'Einsätze planen', hint: 'Zeiten, Aufgaben und Nachweise', icon: 'calendar' },
  dokumente: { title: 'Unterlagen öffnen', hint: 'Dokumente, Verträge und Einwilligungen', icon: 'file' },
  portal: { title: 'Zugang & Freigaben', hint: 'Was Klient:innen und Angehörige sehen', icon: 'check' },
};

export function ClientRecordOverviewPanel({ overview, onNavigateTab, clientId }: Props) {
  const canOpen = (tab: ClientRecordTabKey) => overview.availableTabs.includes(tab);
  const link = (tab: ClientRecordTabKey, label: string) => canOpen(tab) ? <button type="button" className="cs-record-overview-text-button" onClick={() => onNavigateTab(tab)}>{label}<Icon name="arrow" /></button> : null;
  return <div className="cs-record-overview">
    <style>{clientRecordOverviewCss}</style>
    <div className="cs-record-overview-quicklinks" aria-label="Schnellzugriff">
      {overview.quickLinks.map((item) => {
        const copy = quickCopy[item.tab];
        return <button type="button" key={item.tab} onClick={() => onNavigateTab(item.tab)}><span className="cs-record-overview-symbol"><Icon name={copy?.icon ?? 'file'} /></span><span><strong>{copy?.title ?? item.label}</strong><small>{copy?.hint}</small></span><Icon name="arrow" /></button>;
      })}
    </div>
    <div className="cs-record-overview-grid">
      {clientId && canOpen('einsaetze') ? <UpcomingAssignment key={clientId} clientId={clientId} onOpen={() => onNavigateTab('einsaetze')} /> : null}
      <section className="cs-record-overview-card cs-record-overview-review" aria-label="Prüfen und ergänzen">
        <CardHeader icon="list" title="Prüfen & ergänzen" action={<span className="cs-record-overview-count">{overview.openItemsCount}</span>} />
        {overview.openItems.length ? <div className="cs-record-overview-review-list">{overview.openItems.map((item) => <div key={item.id} className="cs-record-overview-review-item"><span className="cs-record-overview-review-dot" aria-hidden="true" /><div><strong>{item.title}</strong><p>{item.description}</p>{link(item.tab, 'Ansehen')}</div></div>)}</div> : <div className="cs-record-overview-empty"><strong>Keine Hinweise aus den gespeicherten Angaben</strong><p>Das ersetzt keine vollständige Prüfung der Akte.</p></div>}
        {overview.openItems.length ? <p className="cs-record-overview-note">Hinweise zur Durchsicht. Fehlende Angaben sind nicht automatisch Pflichtfelder.</p> : null}
      </section>
      <section className="cs-record-overview-card" aria-label="Kontaktdaten und Versorgung">
        <CardHeader icon="person" title="Kontakt & Versorgung" action={link('stammdaten', 'Alle Angaben')} />
        <dl className="cs-record-overview-fields"><Field label="Geburtsdatum" value={overview.dateOfBirth} /><Field label="Aufnahmedatum" value={overview.admissionDate} /><div className="cs-record-overview-full-field"><dt>Adresse</dt><dd>{overview.address === '—' ? 'Nicht hinterlegt' : overview.address}</dd></div><div className="cs-record-overview-full-field"><dt>Telefon</dt><dd><Phone value={overview.phone === '—' ? null : overview.phone} /></dd></div><Field label="Pflegegrad" value={overview.careLevel} /><div className="cs-record-overview-insurance"><dt>Kostenträger</dt><dd>{overview.primaryCostBearer === '—' ? 'Nicht hinterlegt' : overview.primaryCostBearer}</dd><dt>Versichertennummer</dt><dd>{overview.insuranceNumber}</dd></div><div className="cs-record-overview-full-field"><dt>Vereinbarte Leistungsarten</dt><dd>{overview.serviceTypes === '—' ? 'Nicht hinterlegt' : overview.serviceTypes}</dd></div></dl>
        <div className="cs-record-overview-contact-heading"><h4>Im Notfall erreichbar</h4>{link('kontakt', 'Kontakte')}</div>
        {overview.emergencyContacts.length ? <div className="cs-record-overview-contacts">{overview.emergencyContacts.map((contact) => <div key={contact.id}><strong>{contact.name || 'Kontakt ohne Namen'}</strong><span>{contact.relationship}</span><Phone value={contact.phone} /></div>)}</div> : <p className="cs-record-overview-muted">Kein Notfallkontakt hinterlegt.</p>}
      </section>
      <section className="cs-record-overview-card" aria-label="Dokumente und Einwilligungen">
        <CardHeader icon="file" title="Dokumente & Einwilligungen" action={link('dokumente', 'Öffnen')} />
        <div className="cs-record-overview-document-stats"><div><strong>{overview.documentCount}</strong><span>Dokumente in der Akte</span></div><div><strong>{overview.signedContractCount}</strong><span>Verträge mit erfasster Unterschrift</span></div><div><strong>{overview.consentGrantedCount}<small> / {overview.consentTotalCount}</small></strong><span>Einwilligungen erteilt und gültig</span></div></div>
        {overview.signedDocuments.length ? <div className="cs-record-overview-documents"><h4>Zuletzt unterschriebene Verträge</h4>{overview.signedDocuments.map((document) => <div key={document.id}><span className="cs-record-overview-document-check"><Icon name="check" /></span><div><strong>{document.title}</strong><span>Unterzeichnet am {formatDate(document.signedAt)}</span></div></div>)}</div> : <p className="cs-record-overview-note">Bei den Verträgen ist noch kein Unterschriftsdatum erfasst.</p>}
        <p className="cs-record-overview-note">Erteilte Einwilligungen und hochgeladene Dateien sind kein Nachweis einer Unterschrift.</p>
      </section>
      <section className="cs-record-overview-card" aria-label="Letzte Einträge">
        <CardHeader icon="clock" title="Letzte Einträge" action={link('verlauf', 'Verlauf')} />
        {overview.recentActivity.length ? <ol className="cs-record-overview-timeline">{overview.recentActivity.map((entry) => <li key={entry.id}><span className="cs-record-overview-timeline-dot" aria-hidden="true" /><div><strong>{entry.title}</strong><span>{formatDateTime(entry.timestamp)}{entry.actorName ? ` · ${entry.actorName}` : ''}</span></div></li>)}</ol> : <p className="cs-record-overview-muted">Noch keine Einträge im Verlauf vorhanden.</p>}
        <p className="cs-record-overview-note">Letzte gespeicherte Änderung: {overview.lastActivity === '—' ? 'Nicht bekannt' : overview.lastActivity}</p>
      </section>
      <section className="cs-record-overview-card" aria-label="Vereinbarte Unterstützung">
        <CardHeader icon="list" title="Vereinbarte Unterstützung" action={link('einsaetze', 'Einsatzplanung')} />
        {overview.supportTasks.length ? <ul className="cs-record-overview-tasks">{overview.supportTasks.slice(0, 5).map((task) => <li key={task.id}><strong>{task.title}</strong><span>{task.frequency}</span></li>)}</ul> : <p className="cs-record-overview-muted">Noch keine aktiven Aufgaben oder Wünsche hinterlegt.</p>}
        {overview.supportTasks.length > 5 ? <p className="cs-record-overview-note">{overview.supportTasks.length - 5} weitere Aufgaben in der Einsatzplanung.</p> : null}
        {overview.supportTasks.length ? <p className="cs-record-overview-note">Wiederkehrende Aufgaben. Der Abschluss wird beim jeweiligen Einsatz dokumentiert.</p> : null}
      </section>
    </div>
    {clientId && canOpen('dokumente') ? <DocumentRecommendations module="office" workflow="client_intake" clientId={clientId} compact title="Passende Vorlagen für diese Akte" /> : null}
  </div>;
}

export const clientRecordOverviewCss = `
.cs-record-overview{container-type:inline-size;min-width:0;width:100%;font-family:CenturyGothic,Arial,sans-serif;color:#142b46;font-size:14px;line-height:1.5;--overview-line:#dce8f4;--overview-blue:#155ad7}
.cs-record-overview *{box-sizing:border-box}.cs-record-overview button,.cs-record-overview a{font:inherit}.cs-record-overview button{cursor:pointer}.cs-record-overview button:focus-visible,.cs-record-overview a:focus-visible{outline:3px solid #3185ee;outline-offset:4px}.cs-record-overview svg{width:20px;height:20px;flex-shrink:0}.cs-record-overview h3,.cs-record-overview h4,.cs-record-overview p{margin:0}.cs-record-overview p{line-height:1.65}.cs-record-overview h4{font-size:15px;line-height:1.5}.cs-record-overview strong{font-weight:700}.cs-record-overview-muted,.cs-record-overview-note{color:#53677f}.cs-record-overview-note{font-size:13px!important;line-height:1.65!important;margin-top:16px!important}.cs-record-overview-empty{display:grid;gap:8px;padding:6px 0 14px}.cs-record-overview-empty>strong{font-size:16px}.cs-record-overview-empty p{color:#53677f;font-size:14px}
.cs-record-overview-quicklinks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}.cs-record-overview-quicklinks button{min-width:0;display:flex;align-items:center;gap:12px;text-align:left;padding:15px;border:1px solid var(--overview-line);border-radius:18px;background:linear-gradient(140deg,#fff,#f4f8fe);color:#142b46;box-shadow:0 5px 18px #193e7010;transition:border-color .18s,transform .18s}.cs-record-overview-quicklinks button:hover{border-color:#75a8eb;transform:translateY(-2px)}.cs-record-overview-quicklinks button>span:nth-child(2){flex:1;min-width:0}.cs-record-overview-quicklinks strong{display:block;font-size:14px}.cs-record-overview-quicklinks small{display:block;font-size:13px;color:#53677f;margin-top:4px}.cs-record-overview-quicklinks button>svg{width:17px;color:#4679ba}.cs-record-overview-symbol{width:38px;height:38px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(140deg,#eff6ff,#e0ecff);color:var(--overview-blue);flex-shrink:0}
.cs-record-overview-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);align-items:start;gap:18px}.cs-record-overview-card{min-width:0;overflow-wrap:anywhere;padding:23px;border:1px solid var(--overview-line);border-radius:23px;background:linear-gradient(145deg,#fff 30%,#f7faff);box-shadow:0 8px 28px #1a407409,inset 0 1px 0 #fff}.cs-record-overview-heading{display:flex;align-items:center;gap:11px;flex-wrap:wrap;margin-bottom:21px}.cs-record-overview-heading h3{font-size:17px;line-height:1.45;letter-spacing:-.3px;flex:1;min-width:100px}.cs-record-overview-heading .cs-record-overview-text-button{margin-left:auto}.cs-record-overview-text-button{display:inline-flex;align-items:center;gap:7px;color:#1556bf;font-size:13px!important;font-weight:700!important;min-height:34px;border:0;background:transparent;padding:4px 0;text-align:left}.cs-record-overview-text-button svg{width:15px;height:15px}.cs-record-overview-text-button:hover{text-decoration:underline}.cs-record-overview-primary{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:45px;margin-top:20px;padding:11px 16px;border:1px solid #2a68d5;border-radius:12px;background:linear-gradient(120deg,#215bd6,#3477e9);box-shadow:0 4px 14px #2266d523;color:#fff;font-weight:700!important;font-size:14px!important;text-align:left}.cs-record-overview-primary:hover{background:#164fc0}.cs-record-overview-appointment{background:radial-gradient(ellipse at 100% 0,#ddeeff99,transparent 62%),linear-gradient(140deg,#fff,#f5f9ff)}.cs-record-overview-appointment-main{display:flex;align-items:center;gap:23px}.cs-record-overview-date{flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100px;min-height:127px;padding:10px;background:linear-gradient(155deg,#fff,#e8f1ff);box-shadow:0 8px 22px #2758a014,inset 0 1px 1px #fff;border:1px solid #d3e3fa;border-radius:18px;color:#235291}.cs-record-overview-date strong{font-size:44px;line-height:1.3;color:#174580;letter-spacing:-2px}.cs-record-overview-date span{font-size:13px}.cs-record-overview-appointment-copy{min-width:0;flex:1}.cs-record-overview-appointment-copy h4{font-size:20px;line-height:1.45;margin:9px 0}.cs-record-overview-appointment-copy p{font-size:14px;margin-top:4px}.cs-record-overview-status{display:inline-flex;font-size:13px;border:1px solid #c6daf6;background:#edf4ff;border-radius:20px;color:#245591;padding:3px 10px}.cs-record-overview-count{font-size:14px;min-width:32px;min-height:32px;display:flex;align-items:center;justify-content:center;background:#f1f5fb;border:1px solid #dce5f0;border-radius:11px;font-weight:700}.cs-record-overview-review-list{display:grid;gap:15px}.cs-record-overview-review-item{display:flex;gap:11px;align-items:flex-start}.cs-record-overview-review-item>div{min-width:0}.cs-record-overview-review-item p{font-size:13px;color:#53677f;margin-top:3px}.cs-record-overview-review-dot{height:8px;width:8px;flex-shrink:0;margin-top:7px;border-radius:50%;background:#c88c36;box-shadow:0 0 0 4px #fff4e4}
.cs-record-overview-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px 20px;margin:0}.cs-record-overview-fields>div{min-width:0}.cs-record-overview-fields dt{color:#596c82;font-size:13px;margin-bottom:5px}.cs-record-overview-fields dd{margin:0;font-size:14px;font-weight:600;line-height:1.65}.cs-record-overview-insurance dt:not(:first-child){margin-top:12px}.cs-record-overview-insurance dd:last-child{font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.cs-record-overview-full-field{grid-column:1/-1}.cs-record-overview-missing{color:#687a8f;font-weight:400!important}.cs-record-overview-phone{display:inline-flex;align-items:center;gap:7px;color:#1759ba;text-decoration:none;overflow-wrap:anywhere}.cs-record-overview-phone:hover{text-decoration:underline}.cs-record-overview-phone svg{width:16px;height:16px}.cs-record-overview-contact-heading{border-top:1px solid var(--overview-line);margin-top:20px;padding-top:17px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.cs-record-overview-contacts{display:grid;gap:14px;margin-top:8px}.cs-record-overview-contacts>div{display:flex;flex-direction:column;gap:4px;align-items:flex-start}.cs-record-overview-contacts>div>span{font-size:13px;color:#53677f}.cs-record-overview-contact-heading+p{margin-top:10px}
.cs-record-overview-document-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.cs-record-overview-document-stats>div{min-width:0;padding:13px;border:1px solid #e0eaf5;border-radius:13px;background:#f7faff}.cs-record-overview-document-stats strong{display:block;font-size:29px;letter-spacing:-1px;color:#225da5;line-height:1.3}.cs-record-overview-document-stats strong small{font-size:14px;letter-spacing:0;font-weight:400;color:#53677f}.cs-record-overview-document-stats span{display:block;font-size:13px;line-height:1.5;margin-top:8px;color:#425c77}.cs-record-overview-documents{border-top:1px solid var(--overview-line);margin-top:21px;padding-top:17px}.cs-record-overview-documents h4{margin-bottom:14px}.cs-record-overview-documents>div{display:flex;align-items:flex-start;gap:10px;margin-top:13px}.cs-record-overview-documents>div>div{min-width:0}.cs-record-overview-documents>div>div>span{display:block;color:#53677f;font-size:13px;margin-top:4px}.cs-record-overview-document-check{color:#218471;margin-top:2px}.cs-record-overview-document-check svg{width:19px;height:19px}
.cs-record-overview-timeline,.cs-record-overview-tasks{list-style:none;padding:0;margin:0}.cs-record-overview-timeline li{position:relative;display:flex;align-items:flex-start;gap:13px;padding-bottom:21px}.cs-record-overview-timeline li:last-child{padding-bottom:0}.cs-record-overview-timeline li:not(:last-child):before{content:'';position:absolute;left:5px;top:14px;bottom:0;width:1px;background:#d8e6f7}.cs-record-overview-timeline-dot{position:relative;flex-shrink:0;width:11px;height:11px;margin-top:6px;border:3px solid #d5e8ff;border-radius:50%;background:#377bdb}.cs-record-overview-timeline li>div{min-width:0}.cs-record-overview-timeline li>div>span{display:block;font-size:13px;color:#53677f;margin-top:5px}.cs-record-overview-tasks li{display:flex;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid #e7eef6;flex-wrap:wrap}.cs-record-overview-tasks li:first-child{padding-top:0}.cs-record-overview-tasks li>strong{flex:1;min-width:120px}.cs-record-overview-tasks li>span{font-size:13px;color:#53677f}.cs-record-overview .cs-doc-rec{margin-bottom:0}.cs-record-overview .cs-doc-rec-summary,.cs-record-overview .cs-doc-rec-card strong{font-size:14px}.cs-record-overview .cs-doc-rec-summary>span:last-child,.cs-record-overview .cs-doc-rec-card small,.cs-record-overview .cs-doc-rec-card em,.cs-record-overview .cs-doc-rec p,.cs-record-overview .cs-doc-rec-actions button{font-size:13px}
@container(max-width:1000px){.cs-record-overview-quicklinks{grid-template-columns:repeat(2,minmax(0,1fr))}.cs-record-overview-card{padding:20px}.cs-record-overview-document-stats{grid-template-columns:1fr}.cs-record-overview-document-stats>div{display:flex;align-items:center;gap:15px;padding:10px 13px}.cs-record-overview-document-stats span{margin:0}.cs-record-overview-document-stats strong{min-width:42px;font-size:25px}.cs-record-overview-appointment-main{gap:16px}.cs-record-overview-date{width:84px}.cs-record-overview-appointment-copy h4{font-size:18px}}
@container(max-width:760px){.cs-record-overview-grid{grid-template-columns:1fr}.cs-record-overview-document-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.cs-record-overview-document-stats>div{display:block}.cs-record-overview-document-stats span{margin-top:8px}.cs-record-overview-heading h3{font-size:17px}}
@container(max-width:460px){.cs-record-overview-quicklinks{grid-template-columns:1fr}.cs-record-overview-quicklinks button{padding:13px}.cs-record-overview-card{padding:17px;border-radius:18px}.cs-record-overview-document-stats{grid-template-columns:1fr}.cs-record-overview-document-stats>div{display:flex}.cs-record-overview-document-stats span{margin:0}.cs-record-overview-appointment-main{align-items:flex-start}.cs-record-overview-date{width:74px;min-height:110px}.cs-record-overview-date strong{font-size:36px}.cs-record-overview-date span{font-size:13px}.cs-record-overview-heading{gap:9px}.cs-record-overview-fields{grid-template-columns:1fr}.cs-record-overview-heading .cs-record-overview-text-button{margin-left:49px}.cs-record-overview-primary{width:100%}}
@media(prefers-reduced-motion:reduce){.cs-record-overview-quicklinks button{transition:none}.cs-record-overview-quicklinks button:hover{transform:none}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
