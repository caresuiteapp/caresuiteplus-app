import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InternalNote, InternalNoteActor } from '@/lib/office/notes/internalTypes.web';
import { listInternalNotes } from '@/lib/office/notes/internalService.web';
import { INTERNAL_NOTE_KINDS, INTERNAL_NOTE_STATUSES } from '@/lib/office/notes/internalModel.web';

const when = (value: string) => new Date(value).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
export function InternalNotesOutbox({ actor, onCompose, refreshKey = 0, canCompose = true }: { actor: InternalNoteActor; onCompose: () => void; refreshKey?: number; canCompose?: boolean }) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const serial = ++request.current; setLoading(true); setError('');
    try {
      const result = await listInternalNotes(actor, 'sent');
      if (serial !== request.current) return;
      if (result.ok) setNotes(result.data); else setError(result.error);
    } catch { if (serial === request.current) setError('Die übermittelten Einträge konnten nicht geladen werden.'); }
    finally { if (serial === request.current) setLoading(false); }
  }, [actor]);
  useEffect(() => { void refresh(); return () => { request.current++; }; }, [refresh, refreshKey]);
  useEffect(() => { const focus = () => { void refresh(); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [refresh]);
  const visible = useMemo(() => notes.filter(note => {
    const complete = note.recipients.length > 0 && note.recipients.every(person => person.status === 'done');
    return (filter === 'all' || (filter === 'done' ? complete : !complete)) && [note.title, note.body, ...note.recipients.map(person => person.displayName)].join(' ').toLocaleLowerCase('de').includes(query.trim().toLocaleLowerCase('de'));
  }), [notes, filter, query]);
  return <section className="ni-outbox ni-scroll" aria-label="Weitergegebene Einträge">
    <div className="ni-section-heading"><div><span className="nw-eyebrow">IHRE INTERNEN ÜBERMITTLUNGEN</span><h2>Weitergegeben</h2><p>Verfolgen Sie den Bearbeitungsstand und die Rückmeldungen Ihrer Mitarbeitenden.</p></div><div className="nw-actions"><button className="nw-button" disabled={loading} onClick={() => void refresh()}>Aktualisieren</button>{canCompose && <button className="nw-button nw-button--primary" onClick={onCompose}>Neue Übermittlung</button>}</div></div>
    <div className="ni-outbox-filters"><input type="search" aria-label="Übermittlungen durchsuchen" placeholder="Betreff, Inhalt oder Person suchen …" value={query} onChange={event => setQuery(event.target.value)}/><select aria-label="Bearbeitungsstand filtern" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Alle Übermittlungen</option><option value="open">Noch offen</option><option value="done">Bei allen erledigt</option></select></div>
    {error && <div className="nw-notice nw-notice--error" role="alert">{error}<button className="nw-text-button" disabled={loading} onClick={() => void refresh()}>Erneut versuchen</button></div>}
    <div className="ni-outbox-list" aria-busy={loading}>{loading && !notes.length ? <p role="status" className="ni-empty">Übermittlungen werden geladen …</p> : !visible.length ? <div className="ni-empty"><h3>{error ? 'Einträge nicht geladen' : notes.length ? 'Keine passenden Einträge' : 'Noch nichts weitergegeben'}</h3><p>{error ? 'Bitte die Abfrage erneut versuchen.' : notes.length ? 'Passen Sie die Suche oder den Bearbeitungsstand an.' : 'Erstellen Sie eine interne Aufgabe oder öffnen Sie eine persönliche Notiz und wählen Sie „Intern weitergeben“.'}</p></div> : visible.map(note => <article className="ni-sent-card" key={note.id}>
      <div className="ni-sent-head"><span className="ni-pill">{INTERNAL_NOTE_KINDS.find(item => item.value === note.kind)?.label}</span>{note.priority === 'high' && <span className="ni-pill ni-pill--high">Hohe Priorität</span>}<time dateTime={note.createdAt}>{when(note.createdAt)}</time></div><h3>{note.title}</h3>{note.dueDate && <p className="ni-due">Frist: {note.dueDate.split('-').reverse().join('.')}</p>}
      <details className="ni-sent-body"><summary>Übermittelten Inhalt anzeigen</summary><p className="ni-body">{note.body}</p></details>
      <ul className="ni-deliveries">{note.recipients.map(person => <li key={person.employeeId}><div className="ni-delivery-heading"><strong>{person.displayName}</strong><span className={`ni-pill ni-pill--${person.status}`}>{INTERNAL_NOTE_STATUSES.find(item => item.value === person.status)?.label}</span></div><small>{person.readAt ? `Gelesen am ${when(person.readAt)}` : 'Noch nicht gelesen'}</small>{person.response && <div className="ni-response"><span>Rückmeldung</span><p>{person.response}</p></div>}</li>)}</ul>
    </article>)}</div>
  </section>;
}
