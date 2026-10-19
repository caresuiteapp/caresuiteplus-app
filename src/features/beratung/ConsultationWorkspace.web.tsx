import { useEffect, useMemo, useState } from 'react';
import { KIND_LABELS, STATUS_LABELS, nextEncounterAction, consultationPeriod, type ConsultationEncounter, type ConsultationKind, type ConsultationWorkspace as Workspace } from '../../lib/beratung/workspaceModel';
import { Dialog, SelectField, TextField } from './ConsultationControls.web';
import { ConsultationEditor, type WorkspaceCommand } from './ConsultationEditor.web';
import { consultationStyles } from './consultationStyles';
export type ConsultationWorkspaceProps = {
    workspace: Workspace | null;
    loading: boolean;
    busy: boolean;
    error: string | null;
    notice: string | null;
    employeeView: boolean;
    caseId?: string | null;
    encounterId?: string | null;
    initialKind?: ConsultationKind;
    createInitially?: boolean;
    draftScope?: string;
    onCommand: WorkspaceCommand;
    onReload: () => void;
    onOpenCase: (id: string | null, encounterId?: string) => void;
};
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Termin offen';
function visitPeriod(e: ConsultationEncounter) { if (e.service_kind !== '37_3' || !e.scheduled_start)
    return null; const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(e.scheduled_start)); return consultationPeriod(date, Number(e.client_snapshot.care_grade)).label; }
export function ConsultationWorkspaceView({ workspace: w, loading, busy, error, notice, employeeView, caseId, encounterId, initialKind, createInitially = false, draftScope = '', onCommand, onReload, onOpenCase }: ConsultationWorkspaceProps) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [kind, setKind] = useState(initialKind ?? 'all');
    const [create, setCreate] = useState(createInitially);
    const [qualify, setQualify] = useState(false);
    const [followUp, setFollowUp] = useState(false);
    const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
    useEffect(() => { const change = () => setOnline(navigator.onLine); window.addEventListener('online', change); window.addEventListener('offline', change); return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); }; }, []);
    const selected = caseId ? w?.encounters.find(e => e.case_id === caseId && (!encounterId || e.id === encounterId)) : null;
    const visible = useMemo(() => { const q = search.trim().toLocaleLowerCase('de'); return (w?.encounters ?? []).filter(e => (kind === 'all' || e.service_kind === kind) && (filter === 'all' || filter === 'open' && ['draft', 'scheduled', 'in_progress', 'documentation_pending', 'returned'].includes(e.status) || filter === 'review' && e.status === 'submitted' || filter === 'returned' && e.status === 'returned' || filter === 'done' && e.status === 'approved' || filter === 'followup' && Boolean(e.answers.followUpDate)) && (!q || [e.client_snapshot.name, e.employee_name, w?.cases.find(c => c.id === e.case_id)?.title, e.client_snapshot.address].filter(Boolean).join(' ').toLocaleLowerCase('de').includes(q))).sort((a, b) => { const priority = (e: ConsultationEncounter) => e.status === 'returned' ? 0 : e.status === 'documentation_pending' ? 1 : e.status === 'in_progress' ? 2 : 3; return priority(a) - priority(b) || (a.scheduled_start ?? '9999').localeCompare(b.scheduled_start ?? '9999'); }); }, [w, search, filter, kind]);
    const counts = { open: w?.encounters.filter(e => ['draft', 'scheduled', 'in_progress', 'documentation_pending'].includes(e.status)).length ?? 0, review: w?.encounters.filter(e => e.status === 'submitted').length ?? 0, returned: w?.encounters.filter(e => e.status === 'returned').length ?? 0, done: w?.encounters.filter(e => e.status === 'approved').length ?? 0 };
    return <div className="cw-root"><style>{consultationStyles}</style><main className="cw-workspace" aria-label={employeeView ? 'Meine Beratung und Schulungen' : 'Beratung und Schulungen'}>
  <header className="cw-header"><div><p className="cw-kicker">CARESUITE HEALTHOS <span>/</span> {employeeView ? 'MEIN ARBEITSPLATZ' : 'BERATUNG'}</p><h1>{selected ? selected.client_snapshot.name : employeeView ? 'Meine Beratung & Schulungen' : 'Beratung. Persönlich begleitet.'}</h1><p className="cw-subtitle">{selected ? `${KIND_LABELS[selected.service_kind]} · ${STATUS_LABELS[selected.status]}` : employeeView ? 'Ihre Besuche, die nächsten Schritte und alle Rückfragen an einem Ort.' : 'Beratungsbesuche nach § 37.3 und häusliche Schulungen nach § 45.'}</p></div><div className="cw-header-actions">{w?.canQualify && !caseId && <button className="cw-button" onClick={() => setQualify(true)}>Qualifikationen</button>}{w?.canManage && <button className="cw-button cw-primary" onClick={() => caseId ? setFollowUp(true) : setCreate(true)}>{caseId ? '+ Weiteren Besuch planen' : '+ Neuen Fall anlegen'}</button>}</div></header>
  {!online && <div role="status" className="cw-alert cw-alert-warning"><strong>Keine Netzverbindung.</strong> Ihr geöffneter Entwurf kann weiter bearbeitet werden. Speichern und Statusänderungen benötigen eine Verbindung. Lassen Sie diese Seite geöffnet.</div>}
  {error && <div role="alert" className="cw-alert cw-alert-error"><strong>Bitte prüfen</strong><p>{error}</p><button className="cw-button" disabled={busy || loading || !online} onClick={onReload}>Serverstand erneut laden</button></div>}
  {notice && <p className="cw-alert cw-alert-success cw-notice" role="status">{notice}</p>}
  {loading && !w && <div className="cw-loading" role="status" aria-live="polite"><span className="cw-spinner"/>Beratungsarbeitsplatz wird geladen …</div>}
  {!loading && !w && !error && <div className="cw-empty"><h2>Arbeitsplatz wird vorbereitet</h2><p>Die Anmeldung und Zuordnung zum Unternehmen werden geprüft.</p></div>}
  {w && !caseId && <>
   <div className="cw-metrics" aria-label="Besuchsübersicht">{([{ label: employeeView ? 'Meine offenen Besuche' : 'Offene Besuche', value: counts.open, filter: 'open', tone: 'blue', hint: 'Planen & durchführen' }, { label: 'Zur fachlichen Prüfung', value: counts.review, filter: 'review', tone: 'violet', hint: 'Dokumentation eingereicht' }, { label: 'Rückfragen', value: counts.returned, filter: 'returned', tone: 'amber', hint: 'Gemeinsam vervollständigen' }, { label: 'Fachlich freigegeben', value: counts.done, filter: 'done', tone: 'green', hint: 'Prüfung abgeschlossen' }]).map(m => <button key={m.filter} className={`cw-metric cw-tone-${m.tone}`} onClick={() => setFilter(m.filter)} aria-pressed={filter === m.filter}><span>{m.label}</span><strong>{m.value}</strong><small>{m.hint}<span aria-hidden>↗</span></small></button>)}</div>
   <section className="cw-panel cw-list-panel"><div className="cw-list-heading"><div><p className="cw-kicker">{employeeView ? 'PERSÖNLICH ZUGEWIESEN' : 'GEMEINSAME FALLAKTE'}</p><h2>{filter === 'review' ? 'Bereit für die Prüfung' : filter === 'returned' ? 'Rückfragen bearbeiten' : filter === 'followup' ? 'Wiedervorlagen' : 'Alle Besuche im Blick'}</h2></div><button className="cw-button" onClick={onReload} disabled={busy || loading || !online}>{loading ? 'Wird geladen …' : 'Aktualisieren'}</button></div>
    <div className="cw-filter-row"><TextField label="Besuche suchen" value={search} onChange={setSearch} placeholder="Name, Beratungsperson oder Ort …"/><SelectField label="Leistungsart" value={kind} onChange={setKind}><option value="all">Alle Leistungsarten</option><option value="37_3">Beratung § 37.3</option><option value="45">Häusliche Schulung § 45</option></SelectField><SelectField label="Bearbeitungsstand" value={filter} onChange={setFilter}><option value="all">Alle Besuche</option><option value="open">Offene Besuche</option><option value="review">Zur Prüfung</option><option value="returned">Rückfragen</option><option value="done">Fachlich freigegeben</option><option value="followup">Mit Wiedervorlage</option></SelectField></div>
    <div className="cw-list-meta"><span>{visible.length} {visible.length === 1 ? 'Besuch' : 'Besuche'}</span><span>Rückfragen und offene Dokumentationen zuerst</span></div>
    <div className="cw-visits">{visible.map(e => <button className="cw-visit" key={e.id} onClick={() => onOpenCase(e.case_id, e.id)}><span className={`cw-visit-icon ${e.service_kind === '45' ? 'cw-training' : ''}`} aria-hidden>{e.service_kind === '45' ? '45' : '37.3'}</span><span className="cw-visit-person"><strong>{e.client_snapshot.name}</strong><span>{KIND_LABELS[e.service_kind]}</span><small>{e.employee_name ?? 'Beratungsperson noch offen'}</small></span><span className="cw-visit-date"><strong>{dateTime(e.scheduled_start)}</strong><small>{e.client_snapshot.address || 'Adresse offen'}</small>{filter === 'followup' && <small>Wiedervorlage: {e.answers.followUpDate}</small>}</span><span className="cw-visit-progress"><span className={`cw-status cw-status-${e.status}`}>{STATUS_LABELS[e.status]}</span><small>{nextEncounterAction(e)}</small></span><span className="cw-visit-arrow" aria-hidden>↗</span></button>)}</div>
    {!visible.length && <div className="cw-empty"><span className="cw-empty-icon" aria-hidden>◎</span><h3>{w.encounters.length ? 'Keine passenden Besuche' : 'Noch keine Besuche vorhanden'}</h3><p>{w.encounters.length ? 'Passen Sie die Suche oder Filter an.' : employeeView ? 'Sobald Ihnen ein Besuch zugewiesen wurde, finden Sie hier Vorbereitung und Durchführung.' : 'Legen Sie einen Fall für einen bestehenden Klienten an und weisen Sie eine qualifizierte Beratungsperson zu.'}</p>{w.canManage && !w.encounters.length && <button className="cw-button cw-primary" onClick={() => setCreate(true)}>Ersten Fall anlegen</button>}</div>}
   </section>
   <div className="cw-bottom-notes"><div><span className="cw-dot"/><span>Ein gemeinsamer Stand für Verwaltung und Mitarbeitende</span></div><p>Fachliche Freigaben, Kassenversand und Abrechnung werden getrennt geführt.</p></div>
  </>}
  {w && caseId && selected && <><div className="cw-case-visits"><span className={`cw-status cw-status-${selected.status}`}>{STATUS_LABELS[selected.status]}</span>{visitPeriod(selected) && <span className="cw-tag">{visitPeriod(selected)}</span>}{w.encounters.filter(e => e.case_id === caseId).length > 1 && <SelectField label="Besuch in dieser Fallakte" value={selected.id} onChange={id => onOpenCase(caseId, id)}>{w.encounters.filter(e => e.case_id === caseId).map(e => <option key={e.id} value={e.id}>{dateTime(e.scheduled_start)} · {KIND_LABELS[e.service_kind]} · {STATUS_LABELS[e.status]}</option>)}</SelectField>}</div><ConsultationEditor key={selected.id} draftScope={draftScope} encounter={selected} workspace={w} busy={busy || !online} error={error} onCommand={onCommand} onBack={() => onOpenCase(null)} onRefresh={onReload}/></>}
  {w && caseId && !selected && <div className="cw-empty"><h2>Besuch nicht verfügbar</h2><p>Der Besuch ist nicht vorhanden oder wurde Ihnen nicht mehr zugewiesen.</p><button className="cw-button" onClick={() => onOpenCase(null)}>Zur Übersicht</button></div>}
  {create && w?.canManage && <CreateCase busy={busy || !online} error={error} workspace={w} onClose={() => setCreate(false)} onCommand={onCommand} onCreated={(id, e) => { setCreate(false); onOpenCase(id, e); }}/>}
  {qualify && w?.canQualify && <QualificationDialog busy={busy || !online} error={error} workspace={w} onClose={() => setQualify(false)} onCommand={onCommand}/>}
  {followUp && w?.canManage && caseId && <AddVisit caseId={caseId} busy={busy || !online} error={error} onClose={() => setFollowUp(false)} onCommand={onCommand} onCreated={(id, e) => { setFollowUp(false); onOpenCase(id, e); }}/>}
 </main></div>;
}
function CreateCase({ workspace, busy, error, onClose, onCommand, onCreated }: {
    workspace: Workspace;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onCommand: WorkspaceCommand;
    onCreated: (id: string, e: string) => void;
}) {
    const [client, setClient] = useState('');
    const [kind, setKind] = useState<ConsultationKind>('37_3');
    const [title, setTitle] = useState('Beratung und Begleitung');
    const [preparation, setPreparation] = useState('');
    return <Dialog title="Neuen Beratungsfall anlegen" busy={busy} onClose={onClose}><form onSubmit={e => { e.preventDefault(); void onCommand('create', { client_id: client, title, service_kind: kind, preparation }).then(r => { if (r)
        onCreated(r.case_id, r.encounter_id); }); }}><fieldset className="cw-reset-fieldset" disabled={busy}><SelectField label="Klientin / Klient" value={client} onChange={setClient}><option value="">Aus den Klientenstammdaten auswählen</option>{workspace.clients.map(c => <option value={c.id} key={c.id}>{c.name}{c.address ? ` · ${c.address}` : ''}</option>)}</SelectField><TextField label="Bezeichnung der Fallakte" value={title} onChange={setTitle} required/><KindSelect value={kind} onChange={setKind}/><TextField label="Anlass und Hinweise für die Beratungsperson" value={preparation} onChange={setPreparation} multiline/><p className="cw-muted">Im nächsten Schritt legen Sie den Termin und die persönliche Zuweisung fest.</p>{error && <p role="alert" className="cw-alert cw-alert-error">{error}</p>}<div className="cw-actions"><button type="button" className="cw-button" onClick={onClose}>Abbrechen</button><button type="submit" className="cw-button cw-primary" disabled={!client || !title.trim() || busy}>Fallakte anlegen</button></div></fieldset></form></Dialog>;
}
function KindSelect({ value, onChange }: {
    value: ConsultationKind;
    onChange: (v: ConsultationKind) => void;
}) { return <SelectField label="Leistungsart" value={value} onChange={v => onChange(v as ConsultationKind)}>{Object.entries(KIND_LABELS).map(([k, l]) => <option value={k} key={k}>{l}</option>)}</SelectField>; }
function AddVisit({ caseId, busy, error, onClose, onCommand, onCreated }: {
    caseId: string;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onCommand: WorkspaceCommand;
    onCreated: (id: string, e: string) => void;
}) { const [kind, setKind] = useState<ConsultationKind>('37_3'); return <Dialog title="Weiteren Besuch planen" busy={busy} onClose={onClose}><KindSelect value={kind} onChange={setKind}/><p>Ein neuer Besuch wird in derselben Fallakte angelegt. Dokumentation und Unterschriften werden für jeden Besuch gesondert geführt.</p>{error && <p role="alert" className="cw-alert cw-alert-error">{error}</p>}<button className="cw-button cw-primary" disabled={busy} onClick={() => void onCommand('add_visit', { case_id: caseId, service_kind: kind }).then(r => { if (r)
    onCreated(r.case_id, r.encounter_id); })}>Besuch anlegen</button></Dialog>; }
function QualificationDialog({ workspace, busy, error, onClose, onCommand }: {
    workspace: Workspace;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onCommand: WorkspaceCommand;
}) {
    const [employee, setEmployee] = useState('');
    const [kind, setKind] = useState<ConsultationKind>('37_3');
    const [from, setFrom] = useState('');
    const [until, setUntil] = useState('');
    const [evidence, setEvidence] = useState('');
    const [active, setActive] = useState(true);
    const [saved, setSaved] = useState(false);
    function choose(person: string, service: ConsultationKind) { const q = workspace.employees.find(e => e.id === person)?.qualifications.find(q => q.service_kind === service); setEmployee(person); setKind(service); setFrom(q?.valid_from ?? ''); setUntil(q?.valid_until ?? ''); setEvidence(q?.evidence ?? ''); setActive(q?.active ?? true); setSaved(false); }
    return <Dialog title="Qualifikationsfreigaben" busy={busy} onClose={onClose}><p>Die fachliche Befähigung und die vertragsbezogenen Voraussetzungen werden je Leistungsart geprüft und dokumentiert.</p><form onSubmit={e => { e.preventDefault(); void onCommand('qualify', { employee_id: employee, service_kind: kind, valid_from: from, valid_until: until, evidence, active }).then(r => { if (r)
        setSaved(true); }); }}><fieldset disabled={busy} className="cw-reset-fieldset"><SelectField label="Mitarbeitende Person" value={employee} onChange={v => choose(v, kind)}><option value="">Bitte auswählen</option>{workspace.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</SelectField><KindSelect value={kind} onChange={v => choose(employee, v)}/><div className="cw-form-grid"><TextField label="Gültig ab" type="date" value={from} onChange={setFrom} required/><TextField label="Gültig bis (optional)" type="date" value={until} onChange={setUntil}/></div><TextField label="Geprüfte Nachweise / Vertragsgrundlage" value={evidence} onChange={setEvidence} multiline required/><label className="cw-check"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}/>Für diese Leistungsart freigegeben</label>{error && <p role="alert" className="cw-alert cw-alert-error">{error}</p>}{saved && <p role="status" className="cw-alert cw-alert-success">Qualifikationsfreigabe gespeichert.</p>}<button type="submit" className="cw-button cw-primary" disabled={!employee || !from || !evidence.trim() || busy}>Freigabe speichern</button></fieldset></form></Dialog>;
}
