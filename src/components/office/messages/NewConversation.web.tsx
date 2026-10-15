import { withMessagingTimeout } from '@/lib/office/voicemessageutils';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { fetchClientList } from '@/lib/office/clientListService';
import { fetchEmployeeList } from '@/lib/office/employeeListService';
import { fetchInternalUsersList } from '@/lib/auth/accessManagementService';
import { getInternalRoleLabel } from '@/lib/auth/internalRoleLabels';
import { resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import { fetchOfficeMessageCategories } from '@/lib/office/messagethreadservice';
import { createConversation, sendWorkspaceMessage, type MessagingActor, type ConversationOperation, type MessageOperation } from '@/lib/office/messageWorkspaceService.web';
import { MESSAGE_PRIORITIES } from '@/lib/office/messageWorkspace.web';
import { messagingScope, useMessageResource, emptyMessageDraft, type MessageDraft } from '@/hooks/useMessageWorkspace.web';
import { MessageAvatar, MessageButton, MessageDialog, MessageIcon, MessageNotice } from './MessagePrimitives.web';
import type { OfficeMessagePriority } from '@/types/office/messaging';

export type ConversationMode = 'employee' | 'client' | 'internal' | 'group';
const NO_RECIPIENTS: Recipient[] = [];
type Recipient = { id: string; label: string; subtitle?: string };
const titles = { employee: 'Nachricht an Mitarbeitende', client: 'Nachricht an Klient:innen', internal: 'Interne Unterhaltung', group: 'Neue Teamgruppe' };
export function NewConversation({ actor, mode, onClose, onCreated, onDirtyChange, onBusyChange, initialRecipientId }: {
  actor: MessagingActor; mode: ConversationMode; onClose: () => void;
  onCreated: (id: string, draft: MessageDraft) => void; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void; initialRecipientId?: string;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>(initialRecipientId ? [initialRecipientId] : []);
  const [subject, setSubject] = useState(''); const [body, setBody] = useState('');
  const [category, setCategory] = useState(''); const [priority, setPriority] = useState<OfficeMessagePriority>('normal');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [operation, setOperation] = useState<ConversationOperation | null>(null);
  const flight = useRef(false); const alive = useRef(true);
  const multiple = mode === 'group' || mode === 'internal';
  const dirty = !!subject.trim() || !!body.trim() || !!selected.length || !!operation;
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const resource = useMessageResource(`${messagingScope(actor)}:recipients:${mode}`, async () => {
    const [categories, people] = await Promise.all([fetchOfficeMessageCategories(actor.tenantId, actor.roleKey), (async () => {
      if (mode === 'client') { const result = await fetchClientList(actor.tenantId, actor.roleKey); return result.ok ? { ok: true as const, data: result.data.filter(item => item.status !== 'archiviert' && item.status !== 'gesperrt').map(item => ({ id: item.id, label: `${item.firstName} ${item.lastName}`.trim(), subtitle: item.city || 'Klient:in' })) } : result; }
      if (mode === 'internal') { const result = await fetchInternalUsersList(actor.tenantId, actor.roleKey); return result.ok ? { ok: true as const, data: result.data.filter(item => item.id !== actor.profileId && item.status === 'active').map(item => ({ id: item.id, label: item.displayName, subtitle: getInternalRoleLabel(item.roleKey) })) } : result; }
      const result = await fetchEmployeeList(actor.tenantId, actor.roleKey); return result.ok ? { ok: true as const, data: result.data.filter(item => item.status !== 'archiviert' && item.status !== 'gesperrt').map(item => ({ id: item.id, label: `${item.firstName} ${item.lastName}`.trim(), subtitle: resolveEmployeeRoleLabel(item.jobTitle) })) } : result;
    })()]);
    if (!categories.ok) return categories; if (!people.ok) return people;
    const audience = mode === 'group' ? 'employee' : mode;
    return { ok: true as const, data: { categories: categories.data.filter(item => item.audience === audience || item.audience === 'all'), people: people.data as Recipient[] } };
  });
  const people = resource.data?.people ?? NO_RECIPIENTS;
  const selectedPeople = people.filter(item => selected.includes(item.id));
  const matches = useMemo(() => people.filter(item => `${item.label} ${item.subtitle ?? ''}`.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'))), [people, search]);
  const close = () => { if (!busy && (!dirty || window.confirm(operation ? 'Die Unterhaltung wurde möglicherweise bereits angelegt. Einrichtung verlassen? Sie finden angelegte Gespräche in der Übersicht.' : 'Den Nachrichtenentwurf verwerfen?'))) onClose(); };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (flight.current) return;
    if (resource.error || !resource.data) { setError('Bitte zunächst die Empfänger laden.'); return; }
    if (selectedPeople.length < (mode === 'group' ? 2 : 1)) { setError(mode === 'group' ? 'Bitte mindestens zwei Mitarbeitende auswählen.' : 'Bitte eine Person auswählen.'); return; }
    if (!subject.trim()) { setError('Bitte einen Betreff eingeben.'); return; }
    flight.current = true; setBusy(true); setError('');
    const current = operation ?? { id: crypto.randomUUID(), input: { threadType: mode === 'group' ? 'employee_group_office' : mode === 'internal' ? 'internal' : mode === 'client' ? 'client_office' : 'employee_office', subject: subject.trim(), categoryId: category || null, priority, clientId: mode === 'client' ? selectedPeople[0].id : null, employeeId: mode === 'employee' ? selectedPeople[0].id : null, employeeParticipantIds: mode === 'group' ? selectedPeople.map(item => item.id) : undefined, participantProfileIds: mode === 'internal' ? selectedPeople.map(item => item.id) : undefined } } satisfies ConversationOperation;
    setOperation(current);
    try {
      const result = await withMessagingTimeout(createConversation(actor, current), 30000, 'Einrichtung nicht bestätigt.');
      if (!alive.current) return;
      if (!result.ok) { setError(result.error); return; }
      let draft = emptyMessageDraft();
      if (body.trim()) {
        const messageOperation: MessageOperation = { id: crypto.randomUUID(), body: body.trim(), internal: false, attachments: [] };
        const sent = await withMessagingTimeout(sendWorkspaceMessage(actor, result.data.id, messageOperation), 45000, 'Versand nicht bestätigt.').catch(() => ({ ok: false as const, error: 'Der Versand ist noch nicht bestätigt. Bitte denselben Vorgang im Gespräch fortsetzen.' }));
        if (!alive.current) return;
        if (!sent.ok) draft = { text: body, internal: false, attachments: [], operation: messageOperation, error: sent.error };
      }
      onDirtyChange(false); onBusyChange(false); onCreated(result.data.id, draft);
    } catch { if (alive.current) setError('Die Einrichtung ist noch nicht bestätigt. Bitte fortsetzen, um denselben Vorgang abzuschließen.'); }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  return <MessageDialog title={titles[mode]} onClose={close} busy={busy}>
    <form onSubmit={event => void submit(event)} aria-busy={busy}>
      <div className="mw-dialog-scroll">
        {error && <MessageNotice error>{error}</MessageNotice>}
        {resource.error && <MessageNotice error onRetry={() => void resource.refresh()}>{resource.error}</MessageNotice>}
        <section className="mw-step"><div className="mw-step-heading"><span>1</span><h3>{multiple ? 'Teilnehmende auswählen' : 'An wen geht die Nachricht?'}</h3><small>{selectedPeople.length} ausgewählt</small></div>
          <div className="mw-search"><MessageIcon name="search" /><input aria-label="Empfänger suchen" placeholder="Name oder Funktion suchen" value={search} onChange={event => setSearch(event.target.value)} disabled={busy || !!operation} />{search && <button type="button" onClick={() => setSearch('')} aria-label="Empfängersuche leeren"><MessageIcon name="close" /></button>}</div>
          {selectedPeople.length > 0 && <div className="mw-selected">{selectedPeople.map(person => <button type="button" key={person.id} disabled={busy || !!operation} onClick={() => setSelected(values => values.filter(value => value !== person.id))} aria-label={`${person.label} aus Auswahl entfernen`}>{person.label}<MessageIcon name="close" /></button>)}</div>}
          {resource.loading && !resource.data ? <div className="mw-loading" role="status">Empfänger werden geladen</div> : <div className="mw-recipients" role="group" aria-label={multiple ? 'Teilnehmende' : 'Empfänger'}>{matches.map(person => <button type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={selected.includes(person.id)} key={person.id} className="mw-recipient" disabled={busy || !!operation} onClick={() => setSelected(values => multiple ? values.includes(person.id) ? values.filter(value => value !== person.id) : [...values, person.id] : [person.id])}><MessageAvatar name={person.label} /><span className="mw-recipient-copy"><strong>{person.label}</strong><small>{person.subtitle}</small></span><span className="mw-recipient-check">{selected.includes(person.id) && <MessageIcon name="check" />}</span></button>)}{!matches.length && <div className="mw-list-footer">{people.length ? 'Keine Person passt zur Suche.' : 'Keine verfügbaren Empfänger gefunden.'}</div>}</div>}
          {mode === 'internal' && <small>Interne Gespräche sind für berechtigte Personen in der Verwaltung sichtbar.</small>}
          {mode === 'group' && <small>Alle ausgewählten Mitarbeitenden sehen den gemeinsamen Verlauf und die Antworten.</small>}
        </section>
        <section className="mw-step"><div className="mw-step-heading"><span>2</span><h3>{mode === 'group' ? 'Gruppe benennen' : 'Anliegen beschreiben'}</h3></div>
          <div className="mw-field"><label htmlFor={`${id}-subject`}>{mode === 'group' ? 'Gruppenname' : 'Betreff'} *</label><input id={`${id}-subject`} required maxLength={180} disabled={busy || !!operation} placeholder={mode === 'group' ? 'z. B. Team Nord' : 'Worum geht es?'} value={subject} onChange={event => setSubject(event.target.value)} /></div>
          <div className="mw-form-grid"><div className="mw-field"><label htmlFor={`${id}-category`}>Kategorie</label><select id={`${id}-category`} value={category} disabled={busy || !!operation} onChange={event => setCategory(event.target.value)}><option value="">Ohne Kategorie</option>{resource.data?.categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="mw-field"><label htmlFor={`${id}-priority`}>Priorität</label><select id={`${id}-priority`} value={priority} disabled={busy || !!operation} onChange={event => setPriority(event.target.value as OfficeMessagePriority)}>{MESSAGE_PRIORITIES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div></div>
          <div className="mw-field"><label htmlFor={`${id}-body`}>Erste Nachricht <small>optional</small></label><textarea id={`${id}-body`} maxLength={12000} disabled={busy || !!operation} value={body} onChange={event => setBody(event.target.value)} placeholder="Ihre Nachricht …" /><small>Weitere Nachrichten, Dateien und Sprachnachrichten können Sie anschließend im Gespräch ergänzen.</small></div>
        </section>
      </div>
      <footer className="mw-dialog-footer"><p>{selectedPeople.length ? `An ${selectedPeople.slice(0, 2).map(person => person.label).join(', ')}${selectedPeople.length > 2 ? ` und ${selectedPeople.length - 2} weitere Personen` : ''}` : 'Wählen Sie zuerst die Empfänger aus.'}</p><div className="mw-actions"><MessageButton disabled={busy} onClick={close}>Abbrechen</MessageButton><MessageButton tone="primary" type="submit" icon={body.trim() ? 'send' : 'chat'} disabled={busy || resource.loading || !!resource.error}>{busy ? 'Wird eingerichtet …' : operation ? 'Einrichtung fortsetzen' : body.trim() ? 'Gespräch eröffnen & senden' : 'Gespräch eröffnen'}</MessageButton></div></footer>
    </form>
  </MessageDialog>;
}
