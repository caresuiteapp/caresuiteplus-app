import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import { listInternalNotes, updateInternalDelivery } from '@/lib/office/notes/internalService.web';
import { INTERNAL_NOTE_KINDS, INTERNAL_NOTE_PRIORITIES, INTERNAL_NOTE_STATUSES } from '@/lib/office/notes/internalModel.web';
import type { InternalDelivery, InternalNote, InternalNoteActor } from '@/lib/office/notes/internalTypes.web';
import { employeeInternalNotesCss } from './EmployeeInternalNotesStyles.web';

type Filter = 'active' | 'unread' | 'done' | 'all';
type InboxEntry = { note: InternalNote; delivery: InternalDelivery };
const when = (value: string) => new Date(value).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const due = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const label = (items: readonly { value: string; label: string }[], value: string) => items.find(item => item.value === value)?.label ?? value;
const searchable = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').toLocaleLowerCase('de-DE');

/** A new account, employee mapping, tenant or read-only state drops all previous data and drafts. */
export function EmployeeInternalNotes({ actor }: { actor: InternalNoteActor }) {
  const { tenantId, userId, roleKey, employeeId, readOnly } = actor;
  const stableActor = useMemo<InternalNoteActor>(() => ({ tenantId, userId, roleKey, employeeId, readOnly }), [tenantId, userId, roleKey, employeeId, readOnly]);
  const scope = JSON.stringify([tenantId, userId, roleKey, employeeId, !!readOnly]);
  return <EmployeeInternalNotesInbox key={scope} actor={stableActor} />;
}

function EmployeeInternalNotesInbox({ actor }: { actor: InternalNoteActor }) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<InboxEntry | null>(null);
  const [status, setStatus] = useState<InternalDelivery['status']>('open');
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [issue, setIssue] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const alive = useRef(true);
  const lock = useRef(false);
  const request = useRef(0);
  const dirty = !!selection && (status !== selection.delivery.status || response !== (selection.delivery.response ?? ''));
  const confirmLeave = useUnsavedWebChanges(dirty, busy);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current += 1; }; }, []);

  const fetchNotes = useCallback(async () => {
    const version = ++request.current;
    setLoading(true); setLoadError('');
    try {
      const result = await listInternalNotes(actor, 'inbox');
      if (!alive.current || version !== request.current) return null;
      if (!result.ok) { setLoadError(result.error); return null; }
      // The service and RLS enforce this boundary too. Never render a foreign delivery.
      const own = result.data.filter(note => note.tenantId === actor.tenantId)
        .map(note => ({ ...note, recipients: note.recipients.filter(recipient => recipient.employeeId === actor.employeeId && recipient.recipientUserId === actor.userId) }))
        .filter(note => note.recipients.length === 1);
      setNotes(own);
      return own;
    } catch {
      if (alive.current && version === request.current) setLoadError('Die Aufgaben konnten nicht geladen werden. Bitte erneut versuchen.');
      return null;
    } finally { if (alive.current && version === request.current) setLoading(false); }
  }, [actor]);
  useEffect(() => { void fetchNotes(); }, [fetchNotes]);

  const adopt = (entry: InboxEntry | null) => {
    setSelection(entry); setStatus(entry?.delivery.status ?? 'open'); setResponse(entry?.delivery.response ?? '');
    setNotice(''); setIssue(''); setNeedsReload(false);
  };
  const choose = async (entry: InboxEntry | null) => {
    if (lock.current || entry?.delivery.id === selection?.delivery.id || !(await confirmLeave()) || !alive.current) return;
    adopt(entry);
  };
  const reload = async () => {
    if (lock.current || !(await confirmLeave()) || !alive.current) return;
    lock.current = true;
    try {
      const current = await fetchNotes();
      if (!alive.current || !current) return;
      if (selection) {
        const note = current.find(item => item.id === selection.note.id);
        adopt(note ? { note, delivery: note.recipients[0] } : null);
        setNotice(note ? 'Der gespeicherte Stand wurde geladen.' : 'Dieser Eintrag ist für Ihren Zugang nicht mehr verfügbar.');
      }
    } finally { lock.current = false; }
  };

  const update = async (action: 'read' | 'status') => {
    if (lock.current || !selection || actor.readOnly || needsReload || (action === 'status' && !dirty)) return;
    const entry = selection;
    lock.current = true; setBusy(true); setIssue(''); setNotice('');
    // A list request started earlier may not overwrite a later acknowledged mutation.
    request.current += 1; setLoading(false);
    try {
      const result = await updateInternalDelivery(actor, {
        deliveryId: entry.delivery.id, employeeId: entry.delivery.employeeId,
        expectedRevision: entry.delivery.revision, action,
        ...(action === 'status' ? { status, response } : {}),
      });
      if (!alive.current) return;
      if (!result.ok) {
        setIssue(result.error); setNeedsReload(!!(result.conflict || result.uncertain)); return;
      }
      const delivery = result.data;
      if (delivery.id !== entry.delivery.id || delivery.employeeId !== actor.employeeId) {
        setIssue('Die Bestätigung konnte Ihrem Eintrag nicht zugeordnet werden. Bitte den gespeicherten Stand laden.'); setNeedsReload(true); return;
      }
      const next = { note: { ...entry.note, recipients: [delivery] }, delivery };
      setSelection(next);
      setNotes(current => current.map(note => note.id === entry.note.id ? next.note : note));
      if (action === 'status') { setStatus(delivery.status); setResponse(delivery.response ?? ''); }
      setNotice(action === 'read' ? 'Als gelesen bestätigt. Das Büro sieht Ihre Bestätigung.' : 'Bearbeitungsstand und Rückmeldung wurden gespeichert.');
    } catch {
      if (alive.current) { setIssue('Die Änderung ist noch nicht bestätigt. Bitte den gespeicherten Stand laden, bevor Sie erneut speichern.'); setNeedsReload(true); }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };

  const entries = useMemo(() => notes.map(note => ({ note, delivery: note.recipients[0] }))
    .sort((a, b) => Number(!!a.delivery.readAt) - Number(!!b.delivery.readAt) || b.note.createdAt.localeCompare(a.note.createdAt)), [notes]);
  const unread = entries.filter(item => !item.delivery.readAt).length;
  const active = entries.filter(item => item.delivery.status !== 'done').length;
  const done = entries.length - active;
  const visible = entries.filter(({ note, delivery }) => (filter === 'all' || filter === 'unread' && !delivery.readAt || filter === 'active' && delivery.status !== 'done' || filter === 'done' && delivery.status === 'done')
    && (!query.trim() || searchable(`${note.title} ${note.body} ${note.senderName}`).includes(searchable(query.trim()))));
  const disabled = busy || loading || !!actor.readOnly || needsReload;

  return <section className="ein" aria-label="Weitergegebene Aufgaben und Notizen" data-employee-internal-notes="web-v1">
    <style>{employeeInternalNotesCss}</style>
    <header className="ein-header">
      <div><span className="ein-eyebrow">AUS IHREM BÜRO</span><h2>Ihr Eingang</h2><p>Hier finden Sie die Informationen und Aufgaben, die Ihnen persönlich zugewiesen wurden.</p></div>
      <button type="button" className="ein-button" disabled={busy || loading} onClick={() => void reload()}>↻ {loading ? 'Wird geladen…' : 'Aktualisieren'}</button>
    </header>
    <div className="ein-counts" aria-label="Überblick">
      <div><strong>{(loading || loadError) && !notes.length ? '–' : unread}</strong><span>Ungelesen</span></div>
      <div><strong>{(loading || loadError) && !notes.length ? '–' : active}</strong><span>In Bearbeitung / offen</span></div>
      <div><strong>{(loading || loadError) && !notes.length ? '–' : done}</strong><span>Erledigt</span></div>
    </div>
    {actor.readOnly ? <div className="ein-notice">Ihr Zugang ist derzeit nur lesend verfügbar. Sobald Ihre Mitarbeiterzuordnung online bestätigt ist, können Sie Rückmeldungen und Bearbeitungsstände speichern.</div> : null}
    {notice ? <p className="ein-notice ein-success" role="status">{notice}</p> : null}
    {loadError ? <div className="ein-error" role="alert">{loadError}<button type="button" className="ein-button" disabled={busy || loading} onClick={() => void reload()}>Erneut versuchen</button></div> : null}
    <div className={`ein-workspace${selection ? ' ein-has-selection' : ''}`}>
      <div className="ein-list-panel">
        <div className="ein-filters" aria-label="Eingang filtern">
          {([['active', 'Offen'], ['unread', 'Ungelesen'], ['done', 'Erledigt'], ['all', 'Alle']] as const).map(([value, title]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{title}</button>)}
        </div>
        <label className="ein-search"><span className="ein-sr">Aufgaben und Notizen durchsuchen</span><input type="search" aria-label="Aufgaben und Notizen durchsuchen" placeholder="Titel, Inhalt oder Absender suchen" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="ein-list" aria-label="Ihre Einträge" aria-busy={loading}>
          {loading && !notes.length ? <div className="ein-empty" role="status"><span className="ein-empty-icon">↻</span><h3>Eingang wird geladen</h3><p>Ihre persönlichen Zuweisungen werden abgefragt.</p></div>
            : loadError && !notes.length ? <div className="ein-empty"><span className="ein-empty-icon">!</span><h3>Eingang nicht verfügbar</h3><p>Bitte versuchen Sie die Abfrage erneut.</p></div>
            : !visible.length ? <div className="ein-empty"><span className="ein-empty-icon">✓</span><h3>{query || filter !== 'active' ? 'Keine passenden Einträge' : 'Aktuell nichts offen'}</h3><p>{query || filter !== 'active' ? 'Wählen Sie einen anderen Filter oder Suchbegriff.' : 'Neue Notizen und Aufgaben aus Ihrem Büro erscheinen hier.'}</p></div>
              : visible.map(entry => <button key={entry.delivery.id} type="button" className={`ein-entry${selection?.delivery.id === entry.delivery.id ? ' ein-selected' : ''}`} aria-pressed={selection?.delivery.id === entry.delivery.id} disabled={busy} onClick={() => void choose(entry)}>
                <span className="ein-entry-top"><span className="ein-kind">{label(INTERNAL_NOTE_KINDS, entry.note.kind)}</span>{!entry.delivery.readAt ? <span className="ein-unread">Neu</span> : null}</span>
                <strong>{entry.note.title}</strong><span className="ein-preview">{entry.note.body}</span>
                <span className="ein-sender">{entry.note.senderName} · {when(entry.note.createdAt)}</span>
                <span className="ein-entry-bottom"><span className={`ein-status ein-status-${entry.delivery.status}`}>{label(INTERNAL_NOTE_STATUSES, entry.delivery.status)}</span>{entry.note.dueDate ? <span>Bis {due(entry.note.dueDate)}</span> : null}</span>
              </button>)}
        </div>
      </div>
      <div className="ein-detail-panel">
        {selection ? <article aria-label="Geöffneter Eintrag">
          <div className="ein-detail-tools"><button type="button" className="ein-button" disabled={busy} onClick={() => void choose(null)}>← Zur Liste</button><span className="ein-kind">{label(INTERNAL_NOTE_KINDS, selection.note.kind)}</span></div>
          <h3 className="ein-title">{selection.note.title}</h3>
          <p className="ein-detail-sender">Von <strong>{selection.note.senderName}</strong> · {when(selection.note.createdAt)}</p>
          <div className="ein-metadata"><span className={`ein-status ein-status-${selection.delivery.status}`}>{label(INTERNAL_NOTE_STATUSES, selection.delivery.status)}</span><span>Priorität: {label(INTERNAL_NOTE_PRIORITIES, selection.note.priority)}</span>{selection.note.dueDate ? <span>Fällig: {due(selection.note.dueDate)}</span> : null}</div>
          <div className="ein-body">{selection.note.body}</div>
          <div className="ein-read-state">{selection.delivery.readAt ? <span>✓ Gelesen bestätigt am {when(selection.delivery.readAt)}</span> : <><span>Die Lesebestätigung ist noch offen.</span><button type="button" className="ein-button" disabled={disabled} onClick={() => void update('read')}>Als gelesen bestätigen</button></>}</div>
          <form className="ein-response" onSubmit={event => { event.preventDefault(); void update('status'); }}>
            <h4>Ihr Bearbeitungsstand</h4><p>Das Büro sieht Ihren Status und Ihre Rückmeldung.</p>
            <label><span>Status</span><select aria-label="Bearbeitungsstand" disabled={disabled} value={status} onChange={event => setStatus(event.target.value as InternalDelivery['status'])}>{INTERNAL_NOTE_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label><span>Rückmeldung <small>optional · bis zu 2.000 Zeichen</small></span><textarea aria-label="Rückmeldung an das Büro" disabled={disabled} rows={4} maxLength={2000} placeholder="Zum Beispiel: Rückruf erfolgt, nächster Schritt vereinbart …" value={response} onChange={event => setResponse(event.target.value)} /></label>
            {issue ? <div className="ein-error" role="alert">{issue}{needsReload ? <button type="button" className="ein-button" disabled={busy || loading} onClick={() => void reload()}>Gespeicherten Stand laden</button> : null}</div> : null}
            <div className="ein-save-row"><span>{dirty ? 'Noch nicht gespeichert' : `Zuletzt aktualisiert: ${when(selection.delivery.updatedAt)}`}</span><button className="ein-button ein-primary" type="submit" disabled={disabled || !dirty}>{busy ? 'Wird gespeichert…' : 'Rückmeldung speichern'}</button></div>
          </form>
        </article> : <div className="ein-empty ein-detail-empty"><span className="ein-empty-icon">↗</span><h3>Alles Wichtige im Blick</h3><p>Öffnen Sie einen Eintrag, bestätigen Sie den Empfang und halten Sie Ihr Büro über den Fortschritt auf dem Laufenden.</p></div>}
      </div>
    </div>
  </section>;
}
