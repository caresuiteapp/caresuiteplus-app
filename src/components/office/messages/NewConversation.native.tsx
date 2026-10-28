// Generated native presentation from src/components/office/messages/NewConversation.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeForm,NativeDiv,NativeSection,NativeSpan,NativeH3,NativeSmall,NativeInput,NativeButton,NativeStrong,NativeLabel,NativeSelect,NativeOption,NativeTextarea,NativeFooter,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { withMessagingTimeout } from '@/lib/office/voicemessageutils';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { fetchClientList } from '@/lib/office/clientListService';
import { fetchEmployeeList } from '@/lib/office/employeeListService';
import { fetchInternalUsersList } from '@/lib/auth/accessManagementService';
import { getInternalRoleLabel } from '@/lib/auth/internalRoleLabels';
import { resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import { fetchOfficeMessageCategories } from '@/lib/office/messagethreadservice';
import { createConversation, sendWorkspaceMessage, type MessagingActor, type ConversationOperation, type MessageOperation } from "../../../lib/office/messageWorkspaceService.native.ts";
import { MESSAGE_PRIORITIES } from "../../../lib/office/messageWorkspace.native.ts";
import { messagingScope, useMessageResource, emptyMessageDraft, type MessageDraft } from "../../../hooks/useMessageWorkspace.native.ts";
import { MessageAvatar, MessageButton, MessageDialog, MessageIcon, MessageNotice } from "./MessagePrimitives.native.tsx";
import type { OfficeMessagePriority } from '@/types/office/messaging';
export type ConversationMode = 'employee' | 'client' | 'internal' | 'group';
const NO_RECIPIENTS: Recipient[] = [];
type Recipient = {
    id: string;
    label: string;
    subtitle?: string;
};
const titles = { employee: 'Nachricht an Mitarbeitende', client: 'Nachricht an Klient:innen', internal: 'Interne Unterhaltung', group: 'Neue Teamgruppe' };
export function NewConversation({ actor, mode, onClose, onCreated, onDirtyChange, onBusyChange, initialRecipientId }: {
    actor: MessagingActor;
    mode: ConversationMode;
    onClose: () => void;
    onCreated: (id: string, draft: MessageDraft) => void;
    onDirtyChange: (dirty: boolean) => void;
    onBusyChange: (busy: boolean) => void;
    initialRecipientId?: string;
}) {
    const id = useId();
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<string[]>(initialRecipientId ? [initialRecipientId] : []);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [category, setCategory] = useState('');
    const [priority, setPriority] = useState<OfficeMessagePriority>('normal');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [operation, setOperation] = useState<ConversationOperation | null>(null);
    const flight = useRef(false);
    const alive = useRef(true);
    const multiple = mode === 'group' || mode === 'internal';
    const dirty = !!subject.trim() || !!body.trim() || !!selected.length || !!operation;
    useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
    useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const resource = useMessageResource(`${messagingScope(actor)}:recipients:${mode}`, async () => {
        const [categories, people] = await Promise.all([fetchOfficeMessageCategories(actor.tenantId, actor.roleKey), (async () => {
                if (mode === 'client') {
                    const result = await fetchClientList(actor.tenantId, actor.roleKey);
                    return result.ok ? { ok: true as const, data: result.data.filter(item => item.status !== 'archiviert' && item.status !== 'gesperrt').map(item => ({ id: item.id, label: `${item.firstName} ${item.lastName}`.trim(), subtitle: item.city || 'Klient:in' })) } : result;
                }
                if (mode === 'internal') {
                    const result = await fetchInternalUsersList(actor.tenantId, actor.roleKey);
                    return result.ok ? { ok: true as const, data: result.data.filter(item => item.id !== actor.profileId && item.status === 'active').map(item => ({ id: item.id, label: item.displayName, subtitle: getInternalRoleLabel(item.roleKey) })) } : result;
                }
                const result = await fetchEmployeeList(actor.tenantId, actor.roleKey);
                return result.ok ? { ok: true as const, data: result.data.filter(item => item.status !== 'archiviert' && item.status !== 'gesperrt').map(item => ({ id: item.id, label: `${item.firstName} ${item.lastName}`.trim(), subtitle: resolveEmployeeRoleLabel(item.jobTitle) })) } : result;
            })()]);
        if (!categories.ok)
            return categories;
        if (!people.ok)
            return people;
        const audience = mode === 'group' ? 'employee' : mode;
        return { ok: true as const, data: { categories: categories.data.filter(item => item.audience === audience || item.audience === 'all'), people: people.data as Recipient[] } };
    });
    const people = resource.data?.people ?? NO_RECIPIENTS;
    const selectedPeople = people.filter(item => selected.includes(item.id));
    const matches = useMemo(() => people.filter(item => `${item.label} ${item.subtitle ?? ''}`.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'))), [people, search]);
    const close = async () => { if (!busy && (!dirty || await confirmNativeWorkspaceAction(operation ? 'Die Unterhaltung wurde möglicherweise bereits angelegt. Einrichtung verlassen? Sie finden angelegte Gespräche in der Übersicht.' : 'Den Nachrichtenentwurf verwerfen?')))
        onClose(); };
    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (flight.current)
            return;
        if (resource.error || !resource.data) {
            setError('Bitte zunächst die Empfänger laden.');
            return;
        }
        if (selectedPeople.length < (mode === 'group' ? 2 : 1)) {
            setError(mode === 'group' ? 'Bitte mindestens zwei Mitarbeitende auswählen.' : 'Bitte eine Person auswählen.');
            return;
        }
        if (!subject.trim()) {
            setError('Bitte einen Betreff eingeben.');
            return;
        }
        flight.current = true;
        setBusy(true);
        setError('');
        const current = operation ?? { id: crypto.randomUUID(), input: { threadType: mode === 'group' ? 'employee_group_office' : mode === 'internal' ? 'internal' : mode === 'client' ? 'client_office' : 'employee_office', subject: subject.trim(), categoryId: category || null, priority, clientId: mode === 'client' ? selectedPeople[0].id : null, employeeId: mode === 'employee' ? selectedPeople[0].id : null, employeeParticipantIds: mode === 'group' ? selectedPeople.map(item => item.id) : undefined, participantProfileIds: mode === 'internal' ? selectedPeople.map(item => item.id) : undefined } } satisfies ConversationOperation;
        setOperation(current);
        try {
            const result = await withMessagingTimeout(createConversation(actor, current), 30000, 'Einrichtung nicht bestätigt.');
            if (!alive.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            let draft = emptyMessageDraft();
            if (body.trim()) {
                const messageOperation: MessageOperation = { id: crypto.randomUUID(), body: body.trim(), internal: false, attachments: [] };
                const sent = await withMessagingTimeout(sendWorkspaceMessage(actor, result.data.id, messageOperation), 45000, 'Versand nicht bestätigt.').catch(() => ({ ok: false as const, error: 'Der Versand ist noch nicht bestätigt. Bitte denselben Vorgang im Gespräch fortsetzen.' }));
                if (!alive.current)
                    return;
                if (!sent.ok)
                    draft = { text: body, internal: false, attachments: [], operation: messageOperation, error: sent.error };
            }
            onDirtyChange(false);
            onBusyChange(false);
            onCreated(result.data.id, draft);
        }
        catch {
            if (alive.current)
                setError('Die Einrichtung ist noch nicht bestätigt. Bitte fortsetzen, um denselben Vorgang abzuschließen.');
        }
        finally {
            flight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    return <MessageDialog title={titles[mode]} onClose={close} busy={busy}>
    <NativeForm onSubmit={event => void submit(event)} aria-busy={busy}>
      <NativeDiv className="mw-dialog-scroll">
        {error && <MessageNotice error>{error}</MessageNotice>}
        {resource.error && <MessageNotice error onRetry={() => void resource.refresh()}>{resource.error}</MessageNotice>}
        <NativeSection className="mw-step"><NativeDiv className="mw-step-heading"><NativeSpan>1</NativeSpan><NativeH3>{multiple ? 'Teilnehmende auswählen' : 'An wen geht die Nachricht?'}</NativeH3><NativeSmall>{selectedPeople.length} ausgewählt</NativeSmall></NativeDiv>
          <NativeDiv className="mw-search"><MessageIcon name="search"/><NativeInput aria-label="Empfänger suchen" placeholder="Name oder Funktion suchen" value={search} onChange={event => setSearch(event.target.value)} disabled={busy || !!operation}/>{search && <NativeButton type="button" onClick={() => setSearch('')} aria-label="Empfängersuche leeren"><MessageIcon name="close"/></NativeButton>}</NativeDiv>
          {selectedPeople.length > 0 && <NativeDiv className="mw-selected">{selectedPeople.map(person => <NativeButton type="button" key={person.id} disabled={busy || !!operation} onClick={() => setSelected(values => values.filter(value => value !== person.id))} aria-label={`${person.label} aus Auswahl entfernen`}>{person.label}<MessageIcon name="close"/></NativeButton>)}</NativeDiv>}
          {resource.loading && !resource.data ? <NativeDiv className="mw-loading" role="status">Empfänger werden geladen</NativeDiv> : <NativeDiv className="mw-recipients" role="group" aria-label={multiple ? 'Teilnehmende' : 'Empfänger'}>{matches.map(person => <NativeButton type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={selected.includes(person.id)} key={person.id} className="mw-recipient" disabled={busy || !!operation} onClick={() => setSelected(values => multiple ? values.includes(person.id) ? values.filter(value => value !== person.id) : [...values, person.id] : [person.id])}><MessageAvatar name={person.label}/><NativeSpan className="mw-recipient-copy"><NativeStrong>{person.label}</NativeStrong><NativeSmall>{person.subtitle}</NativeSmall></NativeSpan><NativeSpan className="mw-recipient-check">{selected.includes(person.id) && <MessageIcon name="check"/>}</NativeSpan></NativeButton>)}{!matches.length && <NativeDiv className="mw-list-footer">{people.length ? 'Keine Person passt zur Suche.' : 'Keine verfügbaren Empfänger gefunden.'}</NativeDiv>}</NativeDiv>}
          {mode === 'internal' && <NativeSmall>Interne Gespräche sind für berechtigte Personen in der Verwaltung sichtbar.</NativeSmall>}
          {mode === 'group' && <NativeSmall>Alle ausgewählten Mitarbeitenden sehen den gemeinsamen Verlauf und die Antworten.</NativeSmall>}
        </NativeSection>
        <NativeSection className="mw-step"><NativeDiv className="mw-step-heading"><NativeSpan>2</NativeSpan><NativeH3>{mode === 'group' ? 'Gruppe benennen' : 'Anliegen beschreiben'}</NativeH3></NativeDiv>
          <NativeDiv className="mw-field"><NativeLabel htmlFor={`${id}-subject`}>{mode === 'group' ? 'Gruppenname' : 'Betreff'} *</NativeLabel><NativeInput id={`${id}-subject`} required maxLength={180} disabled={busy || !!operation} placeholder={mode === 'group' ? 'z. B. Team Nord' : 'Worum geht es?'} value={subject} onChange={event => setSubject(event.target.value)}/></NativeDiv>
          <NativeDiv className="mw-form-grid"><NativeDiv className="mw-field"><NativeLabel htmlFor={`${id}-category`}>Kategorie</NativeLabel><NativeSelect id={`${id}-category`} value={category} disabled={busy || !!operation} onChange={event => setCategory(event.target.value)}><NativeOption value="">Ohne Kategorie</NativeOption>{resource.data?.categories.map(item => <NativeOption key={item.id} value={item.id}>{item.label}</NativeOption>)}</NativeSelect></NativeDiv><NativeDiv className="mw-field"><NativeLabel htmlFor={`${id}-priority`}>Priorität</NativeLabel><NativeSelect id={`${id}-priority`} value={priority} disabled={busy || !!operation} onChange={event => setPriority(event.target.value as OfficeMessagePriority)}>{MESSAGE_PRIORITIES.map(item => <NativeOption key={item.key} value={item.key}>{item.label}</NativeOption>)}</NativeSelect></NativeDiv></NativeDiv>
          <NativeDiv className="mw-field"><NativeLabel htmlFor={`${id}-body`}>Erste Nachricht <NativeSmall>optional</NativeSmall></NativeLabel><NativeTextarea id={`${id}-body`} maxLength={12000} disabled={busy || !!operation} value={body} onChange={event => setBody(event.target.value)} placeholder="Ihre Nachricht …"/><NativeSmall>Weitere Nachrichten, Dateien und Sprachnachrichten können Sie anschließend im Gespräch ergänzen.</NativeSmall></NativeDiv>
        </NativeSection>
      </NativeDiv>
      <NativeFooter className="mw-dialog-footer"><NativeP>{selectedPeople.length ? `An ${selectedPeople.slice(0, 2).map(person => person.label).join(', ')}${selectedPeople.length > 2 ? ` und ${selectedPeople.length - 2} weitere Personen` : ''}` : 'Wählen Sie zuerst die Empfänger aus.'}</NativeP><NativeDiv className="mw-actions"><MessageButton disabled={busy} onClick={close}>Abbrechen</MessageButton><MessageButton tone="primary" type="submit" icon={body.trim() ? 'send' : 'chat'} disabled={busy || resource.loading || !!resource.error}>{busy ? 'Wird eingerichtet …' : operation ? 'Einrichtung fortsetzen' : body.trim() ? 'Gespräch eröffnen & senden' : 'Gespräch eröffnen'}</MessageButton></NativeDiv></NativeFooter>
    </NativeForm>
  </MessageDialog>;
}
