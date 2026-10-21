import { useState } from 'react';
import { berlinDate } from '../../lib/beratung/workspaceTemplates';
import type { ConsultationEncounter, ConsultationFollowUp, ConsultationWorkspace } from '../../lib/beratung/workspaceModel';
import { Dialog, SelectField, TextField } from './ConsultationControls.web';
import type { WorkspaceCommand } from './ConsultationEditor.web';
const statusLabel = { open: 'Offen', done: 'Erledigt', cancelled: 'Entfallen' };
const dateLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
export function ConsultationFollowUps({ workspace: w, encounter, busy, error, onCommand, onOpenCase, onReload }: {
  workspace: ConsultationWorkspace; encounter?: ConsultationEncounter; busy: boolean; error: string | null;
  onCommand: WorkspaceCommand; onOpenCase?: (id: string, encounterId: string) => void; onReload: () => void;
}) {
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState<ConsultationFollowUp | 'new' | null>(null);
  const today = berlinDate();
  const tasks = (w.followUps ?? []).filter(t => !encounter || t.encounter_id === encounter.id);
  const open = tasks.filter(t => t.status === 'open');
  const due = open.filter(t => t.due_date <= today);
  const findVisit = (t: ConsultationFollowUp) => w.encounters.find(e => e.id === t.encounter_id);
  const filtered = tasks.filter(t => (filter === 'all' || filter === 'due' ? filter === 'all' || t.status === 'open' && t.due_date <= today : t.status === filter)
    && `${t.title} ${t.owner_label} ${findVisit(t)?.client_snapshot.name ?? ''}`.toLocaleLowerCase('de').includes(search.trim().toLocaleLowerCase('de')))
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id));
  const visible = all ? filtered : filtered.slice(0, 6);
  if (!w.capabilities?.followUps) return null;
  const canCreate = encounter && (w.canManage || w.employeeView);
  const dialogVisit = editing === 'new' ? encounter : editing ? findVisit(editing) : undefined;
  return <section className="cw-panel cw-followups" aria-label="Aufgaben und Nachverfolgung">
    <div className="cw-list-heading"><div><p className="cw-kicker">NACH DEM BESUCH</p><h2>{encounter ? 'Vereinbarungen nachverfolgen' : 'Was als Nächstes ansteht'}</h2><p className="cw-muted">{open.length} offen · {due.length} heute fällig oder überfällig</p></div>{canCreate && <button className="cw-button cw-primary" disabled={busy} onClick={() => setEditing('new')}>+ Aufgabe ergänzen</button>}</div>
    <div className="cw-filter-chips" role="group" aria-label="Aufgabenstatus">{[['open', 'Offen'], ['due', 'Jetzt fällig'], ['done', 'Erledigt'], ['cancelled', 'Entfallen'], ['all', 'Alle']].map(([value, label]) => <button key={value} className="cw-choice" aria-pressed={filter === value} onClick={() => { setFilter(value); setAll(false); }}>{label}</button>)}</div>
    {tasks.length > 6 && <TextField label="Aufgaben suchen" value={search} onChange={v => { setSearch(v); setAll(false); }} placeholder="Aufgabe, Zuständigkeit oder Name …"/>}
    <div className="cw-task-list">{visible.map(t => { const visit = findVisit(t); const overdue = t.status === 'open' && t.due_date < today; return <article key={t.id} className={`cw-task-card ${overdue ? 'cw-task-overdue' : ''}`}>
      <div className="cw-task-date"><strong>{dateLabel(t.due_date)}</strong><span>{overdue ? 'Überfällig' : t.status === 'open' && t.due_date === today ? 'Heute fällig' : statusLabel[t.status]}</span></div>
      <div className="cw-task-content"><h3>{t.title}</h3>{!encounter && <p>{visit?.client_snapshot.name} · {visit?.employee_name ?? 'Beratungsperson offen'}</p>}<p className="cw-muted">Vereinbarte Zuständigkeit: {t.owner_label || 'Noch offen'}</p>{t.description && <p className="cw-preserve-lines">{t.description}</p>}{t.outcome && <p className="cw-task-outcome cw-preserve-lines"><strong>Letzte Rückmeldung:</strong> {t.outcome}</p>}<small>{t.source_revision_id ? 'Aus der bestätigten Besuchsdokumentation' : 'Ergänzende Aufgabe zur Besuchsakte'}</small></div>
      <div className="cw-task-actions">{t.can_edit && <button className="cw-button" disabled={busy} onClick={() => setEditing(t)}>Rückmeldung erfassen</button>}{visit && onOpenCase && <button className="cw-link" onClick={() => onOpenCase(visit.case_id, visit.id)}>Besuchsakte öffnen →</button>}</div>
    </article>; })}</div>
    {!visible.length && <p className="cw-empty">{tasks.length ? 'Keine Aufgaben für diese Auswahl.' : 'Offene Empfehlungen und Wiedervorlagen werden bei der fachlichen Freigabe hier übernommen.'}</p>}
    {!all && filtered.length > 6 && <button className="cw-button" onClick={() => setAll(true)}>Alle {filtered.length} Aufgaben anzeigen</button>}
    {encounter?.status === 'approved' && w.canManage && <details className="cw-template-history"><summary>Empfehlungen aus einem früher freigegebenen Besuch übernehmen</summary><p>Bereits übernommene Empfehlungen werden nicht erneut angelegt. Rückmeldungen und Erledigungen bleiben erhalten.</p><button className="cw-button" disabled={busy} onClick={() => void onCommand('followup_import', {}, { id: encounter.id, version: 0 })}>Offene Empfehlungen übernehmen</button></details>}
    {encounter && <p className="cw-template-note">Die zugewiesene Beratungsperson und die Verwaltung führen diese Nachverfolgung gemeinsam. Rückmeldungen ergänzen den Verlauf der Besuchsakte.</p>}
    {editing && dialogVisit && <FollowUpDialog key={editing === 'new' ? 'new' : editing.id} task={editing === 'new' ? null : editing} current={editing === 'new' ? undefined : w.followUps?.find(t => t.id === editing.id)} encounter={dialogVisit} busy={busy} error={error} onClose={() => setEditing(null)} onCommand={onCommand} onReload={onReload}/>}
  </section>;
}
function FollowUpDialog({ task, current, encounter, busy, error, onClose, onCommand, onReload }: {
  task: ConsultationFollowUp | null; current?: ConsultationFollowUp; encounter: ConsultationEncounter; busy: boolean;
  error: string | null; onClose: () => void; onCommand: WorkspaceCommand; onReload: () => void;
}) {
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [due, setDue] = useState(task?.due_date ?? '');
  const [status, setStatus] = useState(task?.status ?? 'open');
  const [note, setNote] = useState('');
  const [version, setVersion] = useState(task?.version);
  const conflict = Boolean(task && current && version !== current.version);
  const save = () => void onCommand(task ? 'followup_update' : 'followup_create', task ? {
    followup_id: task.id, followup_version: version, due_date: due, status, note,
  } : { title, owner_label: owner, due_date: due }, { id: encounter.id, version: 0 }).then(r => { if (r) onClose(); });
  return <Dialog title={task ? 'Rückmeldung zur Aufgabe' : 'Aufgabe zur Besuchsakte ergänzen'} busy={busy} onClose={onClose}>
    <form onSubmit={e => { e.preventDefault(); if (!conflict) save(); }}><fieldset disabled={busy} className="cw-reset-fieldset">
      {task ? <><h3>{task.title}</h3><p>{encounter.client_snapshot.name}</p><SelectField label="Aufgabenstatus" value={status} onChange={v => setStatus(v as ConsultationFollowUp['status'])}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField></> : <><TextField label="Was ist zu tun?" maxLength={500} value={title} onChange={setTitle} required/><TextField label="Vereinbarte Zuständigkeit" maxLength={500} value={owner} onChange={setOwner} placeholder="Zum Beispiel Beratungsperson oder Angehörige"/></>}
      <TextField label="Fällig am" type="date" value={due} onChange={setDue} required/>
      {task && <TextField label="Rückmeldung / Ergebnis / Grund der Änderung" maxLength={5000} value={note} onChange={setNote} multiline required/>}
      {error && <div className="cw-alert cw-alert-error" role="alert"><p>{error}</p><button type="button" className="cw-button" onClick={onReload}>Aktuellen Stand laden</button></div>}
      {conflict && current && <div className="cw-alert cw-alert-warning" role="alert"><strong>Die Aufgabe wurde zwischenzeitlich geändert.</strong><p>Aktuell: {statusLabel[current.status]} · {dateLabel(current.due_date)}</p><p className="cw-preserve-lines">{current.outcome}</p><button type="button" className="cw-button" onClick={() => { setVersion(current.version); setStatus(current.status); setDue(current.due_date); }}>Aktuellen Status übernehmen – meine Rückmeldung behalten</button></div>}
      <div className="cw-actions"><button type="button" className="cw-button" onClick={onClose}>Abbrechen</button><button type="submit" className="cw-button cw-primary" disabled={busy || conflict || !due || (task ? !note.trim() : !title.trim())}>{task ? 'Rückmeldung speichern' : 'Aufgabe anlegen'}</button></div>
    </fieldset></form>
  </Dialog>;
}
