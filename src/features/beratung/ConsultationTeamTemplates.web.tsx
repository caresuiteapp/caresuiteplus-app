import { useState } from 'react';
import { KIND_LABELS, type ConsultationTeamTemplate, type ConsultationTemplateContent, type ConsultationWorkspace } from '../../lib/beratung/workspaceModel';
import { CONSULTATION_TEMPLATES } from '../../lib/beratung/workspaceTemplates';
import { Dialog, SelectField, TextField } from './ConsultationControls.web';
import type { WorkspaceCommand } from './ConsultationEditor.web';

const empty = (): ConsultationTemplateContent => ({ kind: '37_3', title: '', category: 'Team', description: '', preparation: '', prompts: [], goal: '' });
const historyLabel = (action: string) => ({ template_save: 'Entwurf gespeichert', template_publish: 'Für das Team freigegeben', template_archive: 'Archiviert' }[action] ?? action);
function ContentPreview({ content }: { content: ConsultationTemplateContent }) {
  return <div className="cw-template-preview"><span className="cw-tag">{KIND_LABELS[content.kind]} · {content.category}</span><h3>{content.title}</h3><p>{content.description}</p><p className="cw-preserve-lines">{content.preparation}</p>{content.prompts.length > 0 && <ul>{content.prompts.map((p, i) => <li key={i}>{p}</li>)}</ul>}{content.goal && <p><strong>Lernziel:</strong> {content.goal}</p>}</div>;
}
export function ConsultationTeamTemplates({ workspace: w, busy, error, onCommand, onClose, onReload }: {
  workspace: ConsultationWorkspace; busy: boolean; error: string | null; onCommand: WorkspaceCommand; onClose: () => void; onReload: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ id?: string; version?: number; content: ConsultationTemplateContent } | null>(null);
  const [base, setBase] = useState('');
  const [seed, setSeed] = useState('');
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const [note, setNote] = useState('');
  const [intent, setIntent] = useState<{ action: 'template_publish' | 'template_archive'; version: number } | null>(null);
  const [discard, setDiscard] = useState(false);
  const templates = w.teamTemplates ?? [];
  const active = templates.find(t => t.id === selected);
  const server = templates.find(t => t.id === editor?.id);
  const dirty = Boolean(editor && JSON.stringify(editor.content) !== base);
  const conflict = Boolean(editor?.id && server && editor.version !== server.version);
  const candidates = templates.filter(t => t.archived === archived && `${(t.draft ?? t.published)?.title} ${(t.draft ?? t.published)?.category}`.toLocaleLowerCase('de').includes(search.trim().toLocaleLowerCase('de')));
  const close = () => { if (dirty) setDiscard(true); else onClose(); };
  const begin = (template?: ConsultationTeamTemplate, copy = false) => {
    const content = template?.draft ?? template?.published ?? empty();
    const next = copy ? { ...content, title: `${content.title} – Kopie`.slice(0, 200) } : content;
    setEditor({ id: copy ? undefined : template?.id, version: copy ? undefined : template?.version, content: next });
    setBase(JSON.stringify(next)); setIntent(null); setNote(''); setDiscard(false);
  };
  function change<K extends keyof ConsultationTemplateContent>(key: K, value: ConsultationTemplateContent[K]) {
    setEditor(e => e ? { ...e, content: { ...e.content, [key]: value } } : e);
  }
  const valid = editor && editor.content.title.trim() && editor.content.category.trim() && editor.content.preparation.trim()
    && (editor.content.kind !== '45' || editor.content.goal.trim()) && editor.content.prompts.length <= 12 && editor.content.prompts.every(p => p.length <= 1000);
  const save = () => { if (!editor || !valid || conflict) return; void onCommand('template_save', {
    template_id: editor.id, template_version: editor.version, content: { ...editor.content, prompts: editor.content.prompts.filter(p => p.trim()) }, note,
  }).then(result => { if (result) { setSelected(result.template_id ?? null); setEditor(null); setNote(''); setDiscard(false); } }); };
  return <Dialog title="Teamvorlagen verwalten" wide busy={busy} onClose={close}>
    <p className="cw-muted">Eigene Bausteine für Beratung und Schulung. Freigegebene Fassungen stehen dem Team bei der Vorbereitung und im Mitarbeiterportal zur Verfügung.</p>
    {error && <div role="alert" className="cw-alert cw-alert-error"><p>{error}</p><button className="cw-button" disabled={busy} onClick={onReload}>Aktuellen Stand laden</button></div>}
    {discard && <div className="cw-alert cw-alert-warning" role="alert"><p>Dieser Vorlagenentwurf ist noch nicht gespeichert.</p><div className="cw-actions"><button className="cw-button" onClick={() => setDiscard(false)}>Weiter bearbeiten</button><button className="cw-button" onClick={onClose}>Entwurf verwerfen & schließen</button></div></div>}
    {editor ? <form onSubmit={e => { e.preventDefault(); save(); }}><fieldset disabled={busy} className="cw-reset-fieldset">
      <div className="cw-between"><h3>{editor.id ? 'Vorlagenentwurf bearbeiten' : 'Neue Teamvorlage'}</h3><button type="button" className="cw-link" onClick={() => { setEditor(null); setDiscard(false); }}>Entwurf verwerfen</button></div>
      {!editor.id && <div className="cw-template-picker"><SelectField label="Mit einem Standardbaustein beginnen" value={seed} onChange={setSeed}><option value="">Leere Vorlage</option>{CONSULTATION_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</SelectField><button type="button" className="cw-button" disabled={!seed || dirty} onClick={() => { const t = CONSULTATION_TEMPLATES.find(t => t.id === seed); if (t) { const { id: _id, sourceLabel: _label, ...content } = t; const next = { ...content, goal: content.goal ?? '' }; setEditor({ content: next }); setBase(JSON.stringify(next)); } }}>Standard als Ausgangspunkt übernehmen</button></div>}
      <div className="cw-form-grid"><TextField label="Vorlagentitel" maxLength={200} value={editor.content.title} onChange={v => change('title', v)} required/><SelectField label="Leistungsart der Vorlage" value={editor.content.kind} onChange={v => change('kind', v as ConsultationTemplateContent['kind'])}>{Object.entries(KIND_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</SelectField></div>
      <TextField label="Themenbereich" maxLength={80} value={editor.content.category} onChange={v => change('category', v)} required/>
      <TextField label="Kurzbeschreibung" maxLength={500} value={editor.content.description} onChange={v => change('description', v)}/>
      <TextField label="Vorbereitung für den Besuch" value={editor.content.preparation} onChange={v => change('preparation', v)} multiline required/>
      <TextField label="Gesprächsimpulse – eine Zeile je Impuls" maxLength={12000} value={editor.content.prompts.join('\n')} onChange={v => change('prompts', v.split('\n'))} multiline/>
      <p className="cw-muted">Bis zu zwölf Impulse mit jeweils höchstens 1.000 Zeichen.</p>
      {editor.content.kind === '45' && <TextField label="Vorgeschlagenes Lernziel" value={editor.content.goal} onChange={v => change('goal', v)} multiline required/>}
      <TextField label="Änderungsvermerk (optional)" maxLength={2000} value={note} onChange={setNote}/>
      {conflict && server && <div className="cw-alert cw-alert-warning" role="alert"><strong>Die Vorlage wurde zwischenzeitlich geändert.</strong><p>Ihr Entwurf bleibt erhalten. Vergleichen Sie ihn mit dem aktuellen Stand, bevor Sie erneut speichern.</p><details><summary>Aktuellen Vorlageninhalt vergleichen</summary><ContentPreview content={server.draft ?? server.published!}/></details><button type="button" className="cw-button" disabled={server.archived} onClick={() => setEditor(e => e ? { ...e, version: server.version } : e)}>Verglichen – meinen Entwurf weiterverwenden</button>{server.archived && <p>Die Vorlage wurde archiviert. Sie können Ihren Inhalt als neue Vorlage speichern.</p>}</div>}
      {server?.archived && <button type="button" className="cw-button" onClick={() => setEditor(e => e ? { content: e.content } : e)}>Als neue Vorlage vorbereiten</button>}
      <p className="cw-template-note">Im Entwurf nur allgemeine Vorbereitungshilfen erfassen. Individuelle Befunde und Ergebnisse gehören in die Besuchsakte. Eine bestehende Teamfreigabe bleibt bis zur erneuten Freigabe erhalten.</p>
      <div className="cw-actions"><button type="submit" className="cw-button cw-primary" disabled={!valid || conflict || server?.archived}>Vorlagenentwurf speichern</button></div>
    </fieldset></form> : <>
      <div className="cw-between"><div className="cw-filter-chips" role="group" aria-label="Vorlagenstatus"><button className="cw-choice" aria-pressed={!archived} onClick={() => { setArchived(false); setSelected(null); setIntent(null); }}>Aktive Vorlagen</button><button className="cw-choice" aria-pressed={archived} onClick={() => { setArchived(true); setSelected(null); setIntent(null); }}>Archiv</button></div>{w.canManage && <button className="cw-button cw-primary" disabled={busy} onClick={() => { setSeed(''); begin(); }}>+ Teamvorlage erstellen</button>}</div>
      <TextField label="Teamvorlagen suchen" value={search} onChange={setSearch}/>
      <div className="cw-template-cards">{candidates.map(t => <button key={t.id} className="cw-template-card" aria-pressed={active?.id === t.id} onClick={() => { setSelected(t.id); setNote(''); setIntent(null); }}><span className="cw-tag">{t.archived ? 'Archiviert' : t.publishedVersion ? `Freigabe ${t.publishedVersion}${JSON.stringify(t.draft) !== JSON.stringify(t.published) ? ' · Änderungen im Entwurf' : ''}` : 'Entwurf'}</span><strong>{(t.draft ?? t.published)?.title}</strong><span>{(t.draft ?? t.published)?.description}</span></button>)}</div>
      {!candidates.length && <p className="cw-empty">{archived ? 'Keine archivierten Teamvorlagen.' : 'Noch keine passenden Teamvorlagen. Erstellen Sie eine eigene Vorlage oder beginnen Sie mit einem Standardbaustein.'}</p>}
      {active && <section aria-label="Ausgewählte Teamvorlage">
        <ContentPreview content={active.draft ?? active.published!}/>
        <div className="cw-actions cw-template-actions">
          {w.canManage && !active.archived && <button className="cw-button" disabled={busy} onClick={() => begin(active)}>Entwurf bearbeiten</button>}
          {w.canManage && <button className="cw-button" disabled={busy} onClick={() => begin(active, true)}>Als neue Vorlage kopieren</button>}
          {w.canReview && !active.archived && <button className="cw-button cw-primary" disabled={busy} onClick={() => { setNote(''); setIntent({ action: 'template_publish', version: active.version }); }}>Teamfreigabe vorbereiten</button>}
          {w.canManage && !active.archived && <button className="cw-link" disabled={busy} onClick={() => { setNote(''); setIntent({ action: 'template_archive', version: active.version }); }}>Archivieren</button>}
        </div>
        {intent && <div className="cw-template-preview"><h3>{intent.action === 'template_publish' ? 'Inhalt geprüft und für das Team geeignet?' : 'Vorlage archivieren?'}</h3><p>{intent.action === 'template_publish' ? 'Diese Entwurfsfassung wird anschließend zur Auswahl angeboten. Bereits angelegte Besuche behalten ihre Inhalte.' : 'Die Vorlage entfällt aus der Auswahl. Ihre Fassungen und bereits übernommene Inhalte bleiben erhalten.'}</p>{intent.version !== active.version && <p role="alert">Die Vorlage wurde geändert. Prüfen Sie den neuen Inhalt und bereiten Sie die Freigabe oder Archivierung erneut vor.</p>}<TextField label={intent.action === 'template_publish' ? 'Prüfvermerk zur Teamfreigabe' : 'Archivierungsgrund'} maxLength={2000} value={note} onChange={setNote} multiline/><div className="cw-actions"><button className="cw-button" disabled={busy} onClick={() => setIntent(null)}>Abbrechen</button><button className="cw-button cw-primary" disabled={busy || !note.trim() || intent.version !== active.version} onClick={() => void onCommand(intent.action, { template_id: active.id, template_version: intent.version, note }).then(r => { if (r) { setIntent(null); setNote(''); } })}>{intent.action === 'template_publish' ? 'Geprüfte Fassung freigeben' : 'Vorlage archivieren'}</button></div></div>}
        <details className="cw-template-history"><summary>Fassungen & Freigabeverlauf ({active.history.length})</summary>{active.history.map(h => <article key={h.id}><strong>Fassung {h.version} · {historyLabel(h.action)}</strong><p>{h.actor_label} · {new Date(h.created_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}</p><p>{h.note}</p><details><summary>Inhalt dieser Fassung</summary><ContentPreview content={h.content}/></details></article>)}</details>
      </section>}
    </>}
  </Dialog>;
}
