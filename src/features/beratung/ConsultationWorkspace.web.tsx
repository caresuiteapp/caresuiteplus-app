import { useEffect, useMemo, useState } from 'react';
import { KIND_LABELS, STATUS_LABELS, nextEncounterAction, consultationPeriod, type ConsultationClient, type ConsultationEncounter, type ConsultationKind, type ConsultationWorkspace as Workspace } from '../../lib/beratung/workspaceModel';
import { Dialog, SelectField, TextField } from './ConsultationControls.web';
import { ConsultationEditor, type WorkspaceCommand } from './ConsultationEditor.web';
import { consultationStyles } from './consultationStyles';
import { ConsultationIcon } from './ConsultationIcon.web';
import { EvidenceBuilder, PreparationPicker, TemplateLibrary } from './ConsultationTemplates.web';
import { berlinDate, consultationTemplateCatalog, type ConsultationTemplate } from '../../lib/beratung/workspaceTemplates';
import { ConsultationFollowUps } from './ConsultationFollowUps.web';
import { ConsultationTeamTemplates } from './ConsultationTeamTemplates.web';
import { filterConsultationVisits, matchesVisitStatus, nextConsultationFollowUp } from '../../lib/beratung/workspaceFilters';
import { ConsultationFirstContact } from './ConsultationFirstContact.web';
import { clientIntakeResumeRoute } from '@/lib/navigation/clientRoutes';
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
    tenantId?: string | null;
    canCreateClient?: boolean;
    onCommand: WorkspaceCommand;
    onReload: () => void;
    onOpenCase: (id: string | null, encounterId?: string) => void;
};
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Termin offen';
function visitPeriod(e: ConsultationEncounter) { if (e.service_kind !== '37_3' || !e.scheduled_start)
    return null; const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(e.scheduled_start)); return consultationPeriod(date, Number(e.client_snapshot.care_grade)).label; }
export function ConsultationWorkspaceView({ workspace: w, loading, busy, error, notice, employeeView, caseId, encounterId, initialKind, createInitially = false, draftScope = '', tenantId, canCreateClient = false, onCommand, onReload, onOpenCase }: ConsultationWorkspaceProps) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [kind, setKind] = useState(initialKind ?? 'all');
    const [create, setCreate] = useState(createInitially);
    const [qualify, setQualify] = useState(false);
    const [followUp, setFollowUp] = useState(false);
    const [library, setLibrary] = useState(false);
    const [teamLibrary, setTeamLibrary] = useState(false);
    const catalog = consultationTemplateCatalog(w?.teamTemplates);
    const [createTemplate, setCreateTemplate] = useState<ConsultationTemplate | null>(null);
    const [employee, setEmployee] = useState('all');
    const [sort, setSort] = useState('priority');
    const [from, setFrom] = useState('');
    const [until, setUntil] = useState('');
    const today = berlinDate();
    const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
    useEffect(() => { const change = () => setOnline(navigator.onLine); window.addEventListener('online', change); window.addEventListener('offline', change); return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); }; }, []);
    const selected = caseId ? w?.encounters.find(e => e.case_id === caseId && (!encounterId || e.id === encounterId)) : null;
    const visible = useMemo(() => filterConsultationVisits(w, { search, kind, status: filter, employee, sort, from, until }, today), [w, search, filter, kind, employee, sort, from, until, today]);
    const counts = { open: w?.encounters.filter(e => matchesVisitStatus(e, 'open', today, w)).length ?? 0, review: w?.encounters.filter(e => e.status === 'submitted').length ?? 0, returned: w?.encounters.filter(e => e.status === 'returned').length ?? 0, done: w?.encounters.filter(e => e.status === 'approved').length ?? 0 };
    return <div className="cw-root"><style>{consultationStyles}</style><main className="cw-workspace" aria-label={employeeView ? 'Meine Beratung und Schulungen' : 'Beratung und Schulungen'}>
  <header className="cw-header"><div><p className="cw-kicker">CARESUITE HEALTHOS <span>/</span> {employeeView ? 'MEIN ARBEITSPLATZ' : 'BERATUNG'}</p><h1>{selected ? selected.client_snapshot.name : employeeView ? 'Meine Beratung & Schulungen' : 'Beratung. Persönlich begleitet.'}</h1><p className="cw-subtitle">{selected ? `${KIND_LABELS[selected.service_kind]} · ${STATUS_LABELS[selected.status]}` : employeeView ? 'Ihre Besuche, die nächsten Schritte und alle Rückfragen an einem Ort.' : 'Beratungsbesuche nach § 37.3 und häusliche Schulungen nach § 45.'}</p></div><div className="cw-header-actions">{!caseId && <button className="cw-button" onClick={() => setLibrary(true)}>Vorlagenbibliothek</button>}{w?.capabilities?.teamTemplates && (w.canManage || w.canReview) && !caseId && <button className="cw-button" onClick={() => setTeamLibrary(true)}>Teamvorlagen</button>}{w?.canQualify && !caseId && <button className="cw-button" onClick={() => setQualify(true)}>Qualifikationen</button>}{w?.canManage && <button className="cw-button cw-primary" onClick={() => { setCreateTemplate(null); caseId ? setFollowUp(true) : setCreate(true); }}>{caseId ? '+ Weiteren Besuch planen' : '+ Neuen Fall anlegen'}</button>}</div></header>
  {!online && <div role="status" className="cw-alert cw-alert-warning"><strong>Keine Netzverbindung.</strong> Ihr geöffneter Entwurf kann weiter bearbeitet werden. Speichern und Statusänderungen benötigen eine Verbindung. Lassen Sie diese Seite geöffnet.</div>}
  {error && <div role="alert" className="cw-alert cw-alert-error"><strong>Bitte prüfen</strong><p>{error}</p><button className="cw-button" disabled={busy || loading || !online} onClick={onReload}>Serverstand erneut laden</button></div>}
  {notice && <p className="cw-alert cw-alert-success cw-notice" role="status">{notice}</p>}
  {loading && !w && <div className="cw-loading" role="status" aria-live="polite"><span className="cw-spinner"/>Beratungsarbeitsplatz wird geladen …</div>}
  {!loading && !w && !error && <div className="cw-empty"><h2>Arbeitsplatz wird vorbereitet</h2><p>Die Anmeldung und Zuordnung zum Unternehmen werden geprüft.</p></div>}
  {w && !caseId && <>
   <div className="cw-metrics" aria-label="Besuchsübersicht">{([{ label: employeeView ? 'Meine offenen Besuche' : 'Offene Besuche', value: counts.open, filter: 'open', tone: 'blue', hint: 'Planen & durchführen' }, { label: 'Zur fachlichen Prüfung', value: counts.review, filter: 'review', tone: 'violet', hint: 'Dokumentation eingereicht' }, { label: 'Rückfragen', value: counts.returned, filter: 'returned', tone: 'amber', hint: 'Gemeinsam vervollständigen' }, { label: 'Fachlich freigegeben', value: counts.done, filter: 'done', tone: 'green', hint: 'Prüfung abgeschlossen' }]).map(m => <button key={m.filter} className={`cw-metric cw-tone-${m.tone}`} onClick={() => setFilter(m.filter)} aria-pressed={filter === m.filter}><span>{m.label}</span><span className="cw-metric-icon"><ConsultationIcon name={m.filter as 'open' | 'review' | 'returned' | 'done'}/></span><strong>{m.value}</strong><small>{m.hint}<span aria-hidden>↗</span></small></button>)}</div>
   <div className="cw-workspace-intro"><div><span className="cw-kicker">GUT VORBEREITET</span><strong>Passende Bausteine für Ihren nächsten Besuch</strong><p>Beratung, Entlastung, Mobilität und Alltag – individuell kombinierbar.</p></div><button className="cw-button" onClick={() => setLibrary(true)}>{catalog.length} Vorlagen entdecken →</button></div>
   <ConsultationFollowUps workspace={w} busy={busy || !online} error={error} onCommand={onCommand} onReload={onReload} onOpenCase={onOpenCase}/>
   <section className="cw-panel cw-list-panel"><div className="cw-list-heading"><div><p className="cw-kicker">{employeeView ? 'PERSÖNLICH ZUGEWIESEN' : 'GEMEINSAME FALLAKTE'}</p><h2>{filter === 'review' ? 'Bereit für die Prüfung' : filter === 'returned' ? 'Rückfragen bearbeiten' : filter === 'followup' ? 'Wiedervorlagen' : 'Alle Besuche im Blick'}</h2></div><button className="cw-button" onClick={onReload} disabled={busy || loading || !online}>{loading ? 'Wird geladen …' : 'Aktualisieren'}</button></div>
    <div className="cw-filter-chips" role="group" aria-label="Schnellfilter">{[["all", "Alle"], ["today", "Heute"], ["draft", "Noch zu planen"], ["documentation_pending", "Dokumentation offen"], ["due", "Wiedervorlage fällig"]].map(([key, label]) => <button className="cw-choice" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{w.encounters.filter(e => matchesVisitStatus(e, key, today, w)).length}</span></button>)}</div>
    <div className="cw-filter-row"><TextField label="Besuche suchen" value={search} onChange={setSearch} placeholder="Name, Beratungsperson oder Ort …"/><SelectField label="Leistungsart" value={kind} onChange={setKind}><option value="all">Alle Leistungsarten</option><option value="37_3">Beratung § 37.3</option><option value="45">Häusliche Schulung § 45</option></SelectField><SelectField label="Bearbeitungsstand" value={filter} onChange={setFilter}><option value="all">Alle Besuche</option><option value="open">Offene Besuche</option><option value="review">Zur Prüfung</option><option value="returned">Rückfragen</option><option value="done">Fachlich freigegeben</option><option value="followup">Mit Wiedervorlage</option><option value="today">Heute</option><option value="draft">Noch zu planen</option><option value="scheduled">Geplant</option><option value="in_progress">In Durchführung</option><option value="documentation_pending">Dokumentation offen</option><option value="due">Wiedervorlage fällig</option><option value="cancelled">Abgesagt</option><option value="no_show">Nicht angetroffen</option></SelectField></div>
    <details className="cw-advanced-filters"><summary>Person, Zeitraum & Sortierung</summary><div className="cw-filter-details">{!employeeView && <SelectField label="Zugewiesene Person" value={employee} onChange={setEmployee}><option value="all">Alle Personen</option><option value="unassigned">Ohne Zuweisung</option>{w.employees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</SelectField>}<TextField label="Termin ab" type="date" value={from} onChange={setFrom}/><TextField label="Termin bis" type="date" value={until} onChange={setUntil}/><SelectField label="Sortierung" value={sort} onChange={setSort}><option value="priority">Handlungsbedarf zuerst</option><option value="date">Nächster Termin zuerst</option><option value="name">Name A–Z</option><option value="followup">Nächste Wiedervorlage</option></SelectField></div>{from && until && from > until && <p role="alert" className="cw-muted">Das Enddatum liegt vor dem Anfangsdatum.</p>}</details>
    <div className="cw-list-meta"><span>{visible.length} {visible.length === 1 ? 'Besuch' : 'Besuche'}</span><button className="cw-link" onClick={() => { setSearch(''); setKind('all'); setFilter('all'); setEmployee('all'); setFrom(''); setUntil(''); setSort('priority'); }}>Filter zurücksetzen</button></div>
    <div className="cw-visits">{visible.map(e => <button className="cw-visit" key={e.id} onClick={() => onOpenCase(e.case_id, e.id)}><span className={`cw-visit-icon ${e.service_kind === '45' ? 'cw-training' : ''}`} aria-hidden>{e.service_kind === '45' ? '45' : '37.3'}</span><span className="cw-visit-person"><strong>{e.client_snapshot.name}</strong><span>{KIND_LABELS[e.service_kind]}</span><small>{e.employee_name ?? 'Beratungsperson noch offen'}</small></span><span className="cw-visit-date"><strong>{dateTime(e.scheduled_start)}</strong><small>{e.client_snapshot.address || 'Adresse offen'}</small>{['followup', 'due'].includes(filter) && <small>Nächster Schritt: {nextConsultationFollowUp(e, w)}</small>}</span><span className="cw-visit-progress"><span className={`cw-status cw-status-${e.status}`}>{STATUS_LABELS[e.status]}</span><small>{nextEncounterAction(e)}</small></span><span className="cw-visit-arrow" aria-hidden>↗</span></button>)}</div>
    {!visible.length && <div className="cw-empty"><span className="cw-empty-icon" aria-hidden>◎</span><h3>{w.encounters.length ? 'Keine passenden Besuche' : 'Noch keine Besuche vorhanden'}</h3><p>{w.encounters.length ? 'Passen Sie die Suche oder Filter an.' : employeeView ? 'Sobald Ihnen ein Besuch zugewiesen wurde, finden Sie hier Vorbereitung und Durchführung.' : canCreateClient && w.capabilities?.centralContact ? 'Wählen Sie eine vorhandene Person oder erfassen Sie zuerst die Eckdaten für einen neuen Erstkontakt.' : 'Legen Sie einen Fall für einen bestehenden Klienten an und weisen Sie eine qualifizierte Beratungsperson zu.'}</p>{w.canManage && !w.encounters.length && <button className="cw-button cw-primary" onClick={() => setCreate(true)}>Ersten Fall anlegen</button>}</div>}
   </section>
   <div className="cw-bottom-notes"><div><span className="cw-dot"/><span>Ein gemeinsamer Stand für Verwaltung und Mitarbeitende</span></div><p>Fachliche Freigaben, Kassenversand und Abrechnung werden getrennt geführt.</p></div>
  </>}
  {w && caseId && selected && <><div className="cw-case-visits"><span className={`cw-status cw-status-${selected.status}`}>{STATUS_LABELS[selected.status]}</span>{visitPeriod(selected) && <span className="cw-tag">{visitPeriod(selected)}</span>}{w.encounters.filter(e => e.case_id === caseId).length > 1 && <SelectField label="Besuch in dieser Fallakte" value={selected.id} onChange={id => onOpenCase(caseId, id)}>{w.encounters.filter(e => e.case_id === caseId).map(e => <option key={e.id} value={e.id}>{dateTime(e.scheduled_start)} · {KIND_LABELS[e.service_kind]} · {STATUS_LABELS[e.status]}</option>)}</SelectField>}</div><ConsultationEditor key={selected.id} draftScope={draftScope} encounter={selected} workspace={w} busy={busy || !online} error={error} onCommand={onCommand} onBack={() => onOpenCase(null)} onRefresh={onReload}/></>}
  {w && caseId && !selected && <div className="cw-empty"><h2>Besuch nicht verfügbar</h2><p>Der Besuch ist nicht vorhanden oder wurde Ihnen nicht mehr zugewiesen.</p><button className="cw-button" onClick={() => onOpenCase(null)}>Zur Übersicht</button></div>}
  {create && w?.canManage && <CreateCase template={createTemplate} initialKind={initialKind} busy={busy || !online} error={error} workspace={w} tenantId={tenantId} draftScope={draftScope} canCreateClient={canCreateClient && !employeeView} onContactSaved={onReload} onClose={() => setCreate(false)} onCommand={onCommand} onCreated={(id, e) => { setCreate(false); onOpenCase(id, e); }}/>}
  {library && <TemplateLibrary catalog={catalog} initialKind={initialKind} onClose={() => setLibrary(false)} onUse={w?.canManage ? t => { setCreateTemplate(t); setLibrary(false); setCreate(true); } : undefined}/>}
  {teamLibrary && w?.capabilities?.teamTemplates && (w.canManage || w.canReview) && <ConsultationTeamTemplates workspace={w} busy={busy || !online} error={error} onCommand={onCommand} onClose={() => setTeamLibrary(false)} onReload={onReload}/>}
  {qualify && w?.canQualify && <QualificationDialog busy={busy || !online} error={error} workspace={w} onClose={() => setQualify(false)} onCommand={onCommand}/>}
  {followUp && w?.canManage && caseId && <AddVisit workspace={w} initialKind={selected?.service_kind} caseId={caseId} busy={busy || !online} error={error} onClose={() => setFollowUp(false)} onCommand={onCommand} onCreated={(id, e) => { setFollowUp(false); onOpenCase(id, e); }}/>}
 </main></div>;
}
function CreateCase({ workspace, busy, error, onClose, onCommand, onCreated, template, initialKind, tenantId, draftScope, canCreateClient, onContactSaved }: {
    template?: ConsultationTemplate | null;
    initialKind?: ConsultationKind;
    workspace: Workspace;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onCommand: WorkspaceCommand;
    onCreated: (id: string, e: string) => void;
    tenantId?: string | null;
    draftScope: string;
    canCreateClient: boolean;
    onContactSaved: () => void;
}) {
    const [client, setClient] = useState('');
    const [kind, setKind] = useState<ConsultationKind>(template?.kind ?? initialKind ?? '37_3');
    const [title, setTitle] = useState(template?.title ?? 'Beratung und Begleitung');
    const [preparation, setPreparation] = useState(template?.preparation ?? '');
    const [contactBusy, setContactBusy] = useState(false);
    const [savedClients, setSavedClients] = useState<ConsultationClient[]>([]);
    const contactAvailable = canCreateClient && workspace.capabilities?.centralContact === true;
    const newContact = client === '__new__' && Boolean(tenantId) && contactAvailable;
    const clients = [...workspace.clients, ...savedClients.filter(c => !workspace.clients.some(existing => existing.id === c.id))];
    return <Dialog title="Neuen Beratungsfall anlegen" busy={busy || contactBusy} onClose={onClose} wide={newContact}>
      <SelectField label="Klientin / Klient" value={client} disabled={busy || contactBusy} onChange={setClient}>
        <option value="">Aus den Klientenstammdaten auswählen</option>
        <option value="__new__" disabled={!contactAvailable || !tenantId}>+ Neu anlegen · Eckdaten erfassen</option>
        {clients.map(c => <option value={c.id} key={c.id}>{c.name}{c.address ? ` · ${c.address}` : ''}</option>)}
      </SelectField>
      {!canCreateClient && <p className="cw-muted">Zum Anlegen einer neuen Person benötigen Sie die Berechtigung zur Klientenaufnahme.</p>}
      {canCreateClient && !contactAvailable && <p className="cw-muted">Die direkte Klientenaufnahme wird für diesen Arbeitsplatz noch bereitgestellt.</p>}
      {newContact ? <ConsultationFirstContact tenantId={tenantId!} draftScope={draftScope} clients={clients} onBusyChange={setContactBusy}
        onBack={() => setClient('')} onSelect={c => setClient(c.id)} onSaved={(c, notes) => {
          setSavedClients(previous => [...previous.filter(existing => existing.id !== c.id), c]); setClient(c.id);
          if (notes.trim()) setPreparation(previous => [previous.trim(), notes.trim()].filter(Boolean).join('\n\n'));
          onContactSaved();
        }} /> : <form onSubmit={e => { e.preventDefault(); if (!client || client === '__new__') return;
          void onCommand('create', { client_id: client, title, service_kind: kind, preparation }).then(r => { if (r) onCreated(r.case_id, r.encounter_id); });
        }}><fieldset className="cw-reset-fieldset" disabled={busy}>
          {savedClients.some(c => c.id === client) && <div className="cw-contact-saved" role="status"><span>✓ Eckdaten unter „Klienten“ gespeichert</span><a href={clientIntakeResumeRoute(client)} target="_blank" rel="noopener noreferrer">Aufnahme öffnen ↗</a></div>}
          <TextField label="Bezeichnung der Fallakte" maxLength={200} value={title} onChange={setTitle} required/><KindSelect value={kind} onChange={setKind}/>
          <PreparationPicker templates={consultationTemplateCatalog(workspace.teamTemplates)} kind={kind} value={preparation} onChange={setPreparation}/>
          <TextField label="Anlass und Hinweise für die Beratungsperson" value={preparation} onChange={setPreparation} multiline/>
          <p className="cw-muted">Im nächsten Schritt legen Sie den Termin und die persönliche Zuweisung fest.</p>
          {error && <p role="alert" className="cw-alert cw-alert-error">{error}</p>}
          <div className="cw-actions"><button type="button" className="cw-button" onClick={onClose}>Abbrechen</button><button type="submit" className="cw-button cw-primary" disabled={!client || client === '__new__' || !title.trim() || busy}>Fallakte anlegen</button></div>
        </fieldset></form>}
    </Dialog>;
}
function KindSelect({ value, onChange }: {
    value: ConsultationKind;
    onChange: (v: ConsultationKind) => void;
}) { return <SelectField label="Leistungsart" value={value} onChange={v => onChange(v as ConsultationKind)}>{Object.entries(KIND_LABELS).map(([k, l]) => <option value={k} key={k}>{l}</option>)}</SelectField>; }
function AddVisit({ workspace, caseId, busy, error, onClose, onCommand, onCreated, initialKind }: {
    initialKind?: ConsultationKind;
    workspace: Workspace;
    caseId: string;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onCommand: WorkspaceCommand;
    onCreated: (id: string, e: string) => void;
}) { const [kind, setKind] = useState<ConsultationKind>(initialKind ?? '37_3'); const [preparation, setPreparation] = useState(''); return <Dialog title="Weiteren Besuch planen" busy={busy} onClose={onClose}><KindSelect value={kind} onChange={setKind}/><PreparationPicker templates={consultationTemplateCatalog(workspace.teamTemplates)} kind={kind} value={preparation} onChange={setPreparation}/><TextField label="Vorbereitung und Übergabe" value={preparation} onChange={setPreparation} multiline/><p>Ein neuer Besuch wird in derselben Fallakte angelegt. Dokumentation und Unterschriften werden für jeden Besuch gesondert geführt.</p>{error && <p role="alert" className="cw-alert cw-alert-error">{error}</p>}<button className="cw-button cw-primary" disabled={busy} onClick={() => void onCommand('add_visit', { case_id: caseId, service_kind: kind, preparation }).then(r => { if (r)
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
    const [active, setActive] = useState(false);
    const [saved, setSaved] = useState(false);
    function choose(person: string, service: ConsultationKind) { const q = workspace.employees.find(e => e.id === person)?.qualifications.find(q => q.service_kind === service); setEmployee(person); setKind(service); setFrom(q?.valid_from ?? ''); setUntil(q?.valid_until ?? ''); setEvidence(q?.evidence ?? ''); setActive(q?.active ?? false); setSaved(false); }
    return <Dialog title="Qualifikationsfreigaben" busy={busy} onClose={onClose}><p>Die fachliche Befähigung und die vertragsbezogenen Voraussetzungen werden je Leistungsart geprüft und dokumentiert.</p><form onSubmit={e => { e.preventDefault(); if (evidence.length > 2000 || until && until < from) return; void onCommand('qualify', { employee_id: employee, service_kind: kind, valid_from: from, valid_until: until, evidence, active }).then(r => { if (r)
        setSaved(true); }); }}><fieldset disabled={busy} className="cw-reset-fieldset"><SelectField label="Mitarbeitende Person" value={employee} onChange={v => choose(v, kind)}><option value="">Bitte auswählen</option>{workspace.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</SelectField><KindSelect value={kind} onChange={v => choose(employee, v)}/><div className="cw-form-grid"><TextField label="Gültig ab" type="date" value={from} onChange={setFrom} required/><TextField label="Gültig bis (optional)" type="date" value={until} onChange={setUntil}/></div><EvidenceBuilder key={`${employee}:${kind}`} value={evidence} onChange={setEvidence}/><TextField label="Geprüfte Nachweise / Vertragsgrundlage" maxLength={2000} value={evidence} onChange={setEvidence} multiline required/><p className="cw-muted">{evidence.length} / 2.000 Zeichen</p>{until && from && until < from && <p className="cw-alert cw-alert-warning" role="alert">Das Gültigkeitsende liegt vor dem Beginn.</p>}<p className="cw-muted">Eine neue Freigabe wird erst mit Ihrer ausdrücklichen Bestätigung aktiv. Prüfen Sie Befähigung und Leistungsberechtigung für die gewählte Leistung.</p><label className="cw-check"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}/>Für diese Leistungsart freigegeben</label>{error && <p role="alert" className="cw-alert cw-alert-error">{error}</p>}{saved && <p role="status" className="cw-alert cw-alert-success">Qualifikationsfreigabe gespeichert.</p>}<button type="submit" className="cw-button cw-primary" disabled={!employee || !from || !evidence.trim() || evidence.length > 2000 || Boolean(until && until < from) || busy}>Freigabe speichern</button></fieldset></form></Dialog>;
}
