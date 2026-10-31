// Generated native presentation from src/components/office/messages/MessageTemplates.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto,nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeForm,NativeDiv,NativeP,NativeSection,NativeH3,NativeInput,NativeButton,NativeStrong,NativeSpan,NativeSmall,NativeDetails,NativeSummary,NativeLabel,NativeTextarea,NativeFooter} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useId, useRef, useState } from 'react';
import { messagingScope, useMessageResource } from "../../../hooks/useMessageWorkspace.native.ts";
import { listQuickReplyTemplates, saveQuickReplyTemplate, type QuickReplyTemplateRecord } from '@/lib/office/messageQuickReplyTemplateService';
import { OFFICE_QUICK_REPLY_TEMPLATES } from '@/lib/office/messagequickreplies';
import type { MessagingActor } from "../../../lib/office/messageWorkspaceService.native.ts";
import { MessageButton, MessageDialog, MessageIcon, MessageNotice } from "./MessagePrimitives.native.tsx";
type TemplateForm = {
    id?: string;
    key: string;
    label: string;
    body: string;
    sortOrder: number;
    isActive: boolean;
};
const blank = (): TemplateForm => ({ key: crypto.randomUUID(), label: '', body: '', sortOrder: 0, isActive: true });
export function MessageTemplates({ actor, canEdit, onClose, onDirtyChange, onBusyChange, onSaved }: {
    actor: MessagingActor;
    canEdit: boolean;
    onClose: () => void;
    onDirtyChange: (value: boolean) => void;
    onBusyChange: (value: boolean) => void;
    onSaved: () => void;
}) {
    const id = useId();
    const [form, setForm] = useState<TemplateForm>(blank);
    const [baseline, setBaseline] = useState('');
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const flight = useRef(false);
    const alive = useRef(true);
    const dirty = baseline ? JSON.stringify(form) !== baseline : !!form.label || !!form.body;
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
    useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
    const resource = useMessageResource(`${messagingScope(actor)}:template-management`, () => listQuickReplyTemplates(actor.tenantId, actor.roleKey));
    const close = async () => { if (!busy && (!dirty || await confirmNativeWorkspaceAction('Änderungen an der Vorlage verwerfen?')))
        onClose(); };
    async function select(record?: QuickReplyTemplateRecord) { if (busy || (dirty && !await confirmNativeWorkspaceAction('Änderungen an der Vorlage verwerfen?')))
        return; const next = record ? { ...record } : blank(); setForm(next); setBaseline(record ? JSON.stringify(next) : ''); setError(''); setNotice(''); }
    async function save(event: React.FormEvent) {
        event.preventDefault();
        if (flight.current || !canEdit)
            return;
        if (!form.label.trim() || !form.body.trim()) {
            setError('Bitte Bezeichnung und Antworttext ausfüllen.');
            return;
        }
        flight.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            // Resolve a lost insert response by the immutable key before attempting another insert.
            const latest = await listQuickReplyTemplates(actor.tenantId, actor.roleKey);
            if (!latest.ok) {
                if (alive.current)
                    setError(latest.error);
                return;
            }
            const existing = latest.data.find(item => item.key === form.key);
            const result = await saveQuickReplyTemplate(actor.tenantId, { ...form, id: form.id ?? existing?.id }, actor.roleKey);
            if (!alive.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            setForm(result.data);
            setBaseline(JSON.stringify(result.data));
            setNotice('Vorlage gespeichert.');
            onSaved();
            await resource.refresh();
        }
        catch {
            if (alive.current)
                setError('Die Vorlage konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten.');
        }
        finally {
            flight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    const records = (resource.data ?? []).filter(item => `${item.label} ${item.body}`.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE')));
    return <MessageDialog title="Schnellantworten" wide busy={busy} onClose={close}><NativeForm onSubmit={event => void save(event)}><NativeDiv className="mw-dialog-scroll"><NativeP>Wiederkehrende Antworten zentral vorbereiten und beim Schreiben mit einem Klick einfügen.</NativeP>{error && <MessageNotice error>{error}</MessageNotice>}{notice && <MessageNotice>{notice}</MessageNotice>}{resource.error && <MessageNotice error onRetry={() => void resource.refresh()}>{resource.error}</MessageNotice>}<NativeDiv className="mw-management-layout"><NativeSection className="mw-management-card"><NativeDiv className="mw-actions"><NativeH3>Eigene Vorlagen</NativeH3>{canEdit && <MessageButton icon="plus" disabled={busy} onClick={async () => await select()}>Neu</MessageButton>}</NativeDiv><NativeDiv className="mw-search"><MessageIcon name="search"/><NativeInput aria-label="Vorlagen durchsuchen" placeholder="Vorlage suchen" value={search} onChange={event => setSearch(event.target.value)}/></NativeDiv>{resource.loading && !resource.data ? <NativeDiv className="mw-loading">Vorlagen werden geladen</NativeDiv> : records.length ? records.map(item => <NativeButton type="button" className="mw-template" key={item.id} aria-pressed={form.id === item.id} disabled={busy} onClick={async () => await select(item)}><NativeStrong>{item.label}{!item.isActive && <NativeSpan className="mw-tag"> · Inaktiv</NativeSpan>}</NativeStrong><NativeP>{item.body.length > 140 ? `${item.body.slice(0, 140)}…` : item.body}</NativeP></NativeButton>) : <NativeSmall>Keine eigenen Vorlagen gefunden.</NativeSmall>}<NativeDetails><NativeSummary>Mitgelieferte Schnellantworten</NativeSummary><NativeDiv style={{ display: 'grid', gap: 8, marginTop: 12 }}>{OFFICE_QUICK_REPLY_TEMPLATES.map(item => <NativeDiv className="mw-template" key={item.key}><NativeStrong>{item.label}</NativeStrong><NativeP>{item.body}</NativeP></NativeDiv>)}</NativeDiv></NativeDetails></NativeSection><NativeSection className="mw-management-card"><NativeH3>{form.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</NativeH3><NativeDiv className="mw-field"><NativeLabel htmlFor={`${id}-label`}>Bezeichnung *</NativeLabel><NativeInput id={`${id}-label`} value={form.label} maxLength={100} disabled={busy || !canEdit} onChange={event => setForm(value => ({ ...value, label: event.target.value }))} placeholder="z. B. Terminbestätigung"/></NativeDiv><NativeDiv className="mw-field"><NativeLabel htmlFor={`${id}-body`}>Antworttext *</NativeLabel><NativeTextarea id={`${id}-body`} value={form.body} maxLength={12000} rows={9} disabled={busy || !canEdit} onChange={event => setForm(value => ({ ...value, body: event.target.value }))} placeholder="Text der Schnellantwort …"/></NativeDiv><NativeLabel className="mw-check"><NativeInput type="checkbox" checked={form.isActive} disabled={busy || !canEdit} onChange={event => setForm(value => ({ ...value, isActive: event.target.checked }))}/><NativeSpan>Im Schreibbereich anbieten<NativeSmall>Deaktivierte Vorlagen bleiben zur späteren Bearbeitung erhalten.</NativeSmall></NativeSpan></NativeLabel></NativeSection></NativeDiv></NativeDiv><NativeFooter className="mw-dialog-footer"><NativeP>{dirty ? 'Noch nicht gespeicherte Änderungen' : 'Die Auswahl einer Vorlage versendet keine Nachricht.'}</NativeP><NativeDiv className="mw-actions"><MessageButton disabled={busy} onClick={close}>Schließen</MessageButton>{canEdit && <MessageButton type="submit" tone="primary" icon="check" disabled={busy || !dirty || !!resource.error}>{busy ? 'Wird gespeichert …' : 'Vorlage speichern'}</MessageButton>}</NativeDiv></NativeFooter></NativeForm></MessageDialog>;
}
