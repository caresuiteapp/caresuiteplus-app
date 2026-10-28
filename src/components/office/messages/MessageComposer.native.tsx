// Generated native presentation from src/components/office/messages/MessageComposer.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeButton,NativeSmall,NativeSpan,NativeInput,NativeI,NativeLabel,NativeTextarea} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useId, useRef, useState } from 'react';
import { useVoiceMessage } from "../../../hooks/communication/useVoiceMessage.native.ts";
import { messagingScope, useMessageResource, type MessageDraft } from "../../../hooks/useMessageWorkspace.native.ts";
import { listQuickReplyTemplates } from '@/lib/office/messageQuickReplyTemplateService';
import { OFFICE_QUICK_REPLY_TEMPLATES } from '@/lib/office/messagequickreplies';
import { MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES, normalizeAttachmentMimeType, validateMessageAttachment, type PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import { bytesLabel } from "../../../lib/office/messageWorkspace.native.ts";
import type { MessagingActor } from "../../../lib/office/messageWorkspaceService.native.ts";
import type { MessagePreferences } from "../../../lib/office/messageWorkspaceSettings.native.ts";
import { MessageButton, MessageIcon, MessageNotice } from "./MessagePrimitives.native.tsx";
export function MessageComposer({ actor, draft, onChange, onSend, sending, canNote, onBusyChange, onOpenTemplates, preferences, templateVersion, canVoice }: {
    actor: MessagingActor;
    draft: MessageDraft;
    onChange: (draft: MessageDraft) => void;
    onSend: () => void;
    sending: boolean;
    canNote: boolean;
    onBusyChange: (busy: boolean) => void;
    onOpenTemplates: () => void;
    preferences: MessagePreferences;
    templateVersion: number;
    canVoice: boolean;
}) {
    const id = useId();
    const input = useRef<HTMLInputElement>(null);
    const text = useRef<HTMLTextAreaElement>(null);
    const draftRef = useRef(draft);
    draftRef.current = draft;
    const alive = useRef(true);
    const filesFlight = useRef(false);
    const [fileBusy, setFileBusy] = useState(false);
    const [voiceBusy, setVoiceBusy] = useState(false);
    const [error, setError] = useState('');
    const [showReplies, setShowReplies] = useState(false);
    const [replySearch, setReplySearch] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const voice = useVoiceMessage();
    const templates = useMessageResource(`${messagingScope(actor)}:replies:${templateVersion}`, () => listQuickReplyTemplates(actor.tenantId, actor.roleKey));
    const locked = sending || fileBusy || voiceBusy || voice.isRecording || !!draft.operation;
    useEffect(() => { onBusyChange(fileBusy || voiceBusy || voice.isRecording); return () => onBusyChange(false); }, [fileBusy, voiceBusy, voice.isRecording, onBusyChange]);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const append = (value: string) => {
        const current = draftRef.current;
        const start = text.current?.selectionStart ?? current.text.length;
        const end = text.current?.selectionEnd ?? start;
        onChange({ ...current, text: current.text.slice(0, start) + value + current.text.slice(end), error: undefined });
        text.current?.focus();
    };
    async function addFiles(files: File[]) {
        if (locked || filesFlight.current || !files.length || !preferences.attachmentsEnabled)
            return;
        filesFlight.current = true;
        setFileBusy(true);
        setError('');
        const next = [...draftRef.current.attachments];
        const errors: string[] = [];
        try {
            for (const file of files) {
                if (next.length >= 6) {
                    errors.push('Pro Nachricht sind höchstens sechs Anhänge möglich.');
                    break;
                }
                const mimeType = normalizeAttachmentMimeType(file.type);
                if (mimeType.startsWith('audio/') && !canVoice) {
                    errors.push('Für Audionachrichten fehlt die Berechtigung.');
                    continue;
                }
                const valid = validateMessageAttachment({ fileName: file.name, fileSizeBytes: file.size, mimeType });
                if (!valid.ok) {
                    errors.push(`${file.name}: ${valid.error}`);
                    continue;
                }
                if (next.some(item => item.fileName === file.name && item.fileSizeBytes === file.size && item.mimeType === mimeType))
                    continue;
                if (next.reduce((sum, item) => sum + item.fileSizeBytes, 0) + file.size > 100 * 1024 * 1024) {
                    errors.push('Die Anhänge dürfen zusammen höchstens 100 MB groß sein.');
                    continue;
                }
                const fileData = new Uint8Array(await file.arrayBuffer());
                if (!alive.current)
                    return;
                next.push({ id: crypto.randomUUID(), fileName: file.name, mimeType, fileSizeBytes: file.size, fileData });
            }
            if (alive.current) {
                onChange({ ...draftRef.current, attachments: next });
                setError(errors.join(' '));
            }
        }
        catch {
            if (alive.current)
                setError('Eine Datei konnte nicht gelesen werden. Ihre bisherigen Anhänge bleiben erhalten.');
        }
        finally {
            filesFlight.current = false;
            if (alive.current)
                setFileBusy(false);
        }
    }
    async function record() {
        if (locked || !preferences.voiceMessagesEnabled || !canVoice)
            return;
        setVoiceBusy(true);
        setError('');
        try {
            const result = await voice.start();
            if (!result.ok && alive.current)
                setError(result.error);
        }
        finally {
            if (alive.current)
                setVoiceBusy(false);
        }
    }
    async function stop() {
        if (voiceBusy)
            return;
        setVoiceBusy(true);
        try {
            const result = await voice.stop();
            if (!alive.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            const attachment: PendingMessageAttachment = { id: crypto.randomUUID(), fileName: result.data.fileName, mimeType: normalizeAttachmentMimeType(result.data.mimeType), fileSizeBytes: result.data.bytes.byteLength, fileData: result.data.bytes };
            const valid = validateMessageAttachment(attachment);
            if (!valid.ok) {
                setError(valid.error);
                return;
            }
            if (draftRef.current.attachments.length >= 6) {
                setError('Bitte einen Anhang entfernen, bevor Sie eine weitere Aufnahme hinzufügen.');
                return;
            }
            onChange({ ...draftRef.current, attachments: [...draftRef.current.attachments, attachment] });
        }
        finally {
            if (alive.current)
                setVoiceBusy(false);
        }
    }
    const savedTemplates = templates.data?.filter(item => item.isActive) ?? [];
    const replies = [...savedTemplates, ...OFFICE_QUICK_REPLY_TEMPLATES.filter(item => !savedTemplates.some(saved => saved.key === item.key))].filter(item => `${item.label} ${item.body}`.toLocaleLowerCase('de-DE').includes(replySearch.toLocaleLowerCase('de-DE')));
    return <NativeDiv className={`mw-composer${draft.internal ? ' mw-composer--note' : ''}`} onDragOver={event => { if (!locked)
        event.preventDefault(); }} onDrop={event => { event.preventDefault(); void addFiles(Array.from(event.dataTransfer.files)); }}>
    <NativeDiv className="mw-compose-modes"><NativeButton type="button" disabled={locked} aria-pressed={!draft.internal} onClick={() => onChange({ ...draft, internal: false })}>Antwort</NativeButton>{canNote && <NativeButton type="button" className="is-note" disabled={locked} aria-pressed={draft.internal} onClick={() => onChange({ ...draft, internal: true })}>Interne Notiz</NativeButton>}{draft.internal && <NativeSmall>Nur für die Verwaltung sichtbar</NativeSmall>}</NativeDiv>
    {(error || draft.error) && <MessageNotice error>{error || draft.error}</MessageNotice>}
    {!!draft.attachments.length && <NativeDiv className="mw-pending">{draft.attachments.map(file => <NativeSpan className="mw-pending-file" key={file.id}><MessageIcon name={file.mimeType.startsWith('audio/') ? 'mic' : 'file'}/><NativeSpan>{file.fileName}<NativeSmall> · {bytesLabel(file.fileSizeBytes)}</NativeSmall></NativeSpan><NativeButton type="button" aria-label={`${file.fileName} entfernen`} disabled={locked} onClick={() => onChange({ ...draft, attachments: draft.attachments.filter(item => item.id !== file.id) })}><MessageIcon name="close"/></NativeButton></NativeSpan>)}</NativeDiv>}
    {showReplies && <NativeDiv className="mw-replies"><NativeInput className="mw-reply-search" aria-label="Schnellantwort suchen" placeholder="Schnellantwort suchen …" value={replySearch} onChange={event => setReplySearch(event.target.value)}/>{templates.error && <NativeSmall>Eigene Vorlagen konnten nicht geladen werden.</NativeSmall>}{replies.map(reply => <NativeButton type="button" key={reply.key} disabled={locked} title={reply.body} onClick={() => { append(`${draft.text ? '\n' : ''}${reply.body}`); setShowReplies(false); }}>{reply.label}</NativeButton>)}<NativeButton type="button" disabled={locked} onClick={onOpenTemplates}>Vorlagen verwalten</NativeButton></NativeDiv>}
    {showEmoji && preferences.emojisEnabled && <NativeDiv className="mw-replies" role="group" aria-label="Emoji auswählen">{['👍', '✅', '🙂', '🙏', '📅', '📌', '💬', '❤️'].map(emoji => <NativeButton type="button" key={emoji} disabled={locked} aria-label={`Emoji ${emoji} einfügen`} onClick={() => { append(emoji); setShowEmoji(false); }}>{emoji}</NativeButton>)}</NativeDiv>}
    {voice.isRecording && <NativeDiv className="mw-recording" role="status"><NativeI />Aufnahme {Math.floor(voice.durationSeconds / 60)}:{String(voice.durationSeconds % 60).padStart(2, '0')}<MessageButton disabled={voiceBusy} onClick={() => void stop()} icon="stop">Übernehmen</MessageButton><MessageButton disabled={voiceBusy} onClick={voice.cancel}>Verwerfen</MessageButton></NativeDiv>}
    <NativeDiv className="mw-compose-box"><NativeLabel className="mw-sr" htmlFor={id}>{draft.internal ? 'Interne Notiz schreiben' : 'Nachricht schreiben'}</NativeLabel><NativeTextarea id={id} ref={text} value={draft.text} disabled={locked} maxLength={12000} placeholder={draft.internal ? 'Interne Notiz für die Verwaltung …' : 'Nachricht schreiben …'} onChange={event => onChange({ ...draft, text: event.target.value, error: undefined })} onPaste={event => { const files = Array.from(event.clipboardData.files); if (files.length) {
        event.preventDefault();
        void addFiles(files);
    } }} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
        event.preventDefault();
        if (!locked && (draft.text.trim() || draft.attachments.length))
            onSend();
    } }}/>
      <NativeDiv className="mw-compose-toolbar"><NativeDiv className="mw-actions"><NativeInput ref={input} type="file" multiple accept={MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES.join(',')} hidden onChange={event => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }}/><MessageButton tone="quiet" icon="clip" aria-label="Dateien anhängen" title="Dateien anhängen · auch per Drag & Drop" disabled={locked || !preferences.attachmentsEnabled} onClick={() => input.current?.click()}/><MessageButton tone="quiet" icon="mic" aria-label="Sprachnachricht aufnehmen" title={voice.isSupported ? 'Sprachnachricht aufnehmen' : voice.unsupportedMessage} disabled={locked || !voice.isSupported || !preferences.voiceMessagesEnabled || !canVoice} onClick={() => void record()}/><MessageButton tone="quiet" icon="smile" aria-label="Emojis öffnen" aria-expanded={showEmoji} disabled={locked || !preferences.emojisEnabled} onClick={() => setShowEmoji(value => !value)}/><MessageButton tone="quiet" icon="file" aria-expanded={showReplies} disabled={locked} onClick={() => setShowReplies(value => !value)}>Schnellantwort</MessageButton></NativeDiv><MessageButton tone="primary" icon="send" onClick={onSend} disabled={sending || fileBusy || voiceBusy || voice.isRecording || (!draft.text.trim() && !draft.attachments.length)}>{sending ? 'Wird gesendet …' : draft.operation ? 'Versand fortsetzen' : draft.internal ? 'Notiz speichern' : 'Senden'}</MessageButton></NativeDiv>
    </NativeDiv><NativeDiv className="mw-compose-hint"><NativeSpan>{fileBusy ? 'Dateien werden vorbereitet …' : 'Enter: neue Zeile · Strg/⌘ + Enter: senden'}</NativeSpan><NativeSpan>{draft.operation ? 'Vorgang wird sicher fortgesetzt' : `${draft.text.length.toLocaleString('de-DE')} / 12.000`}</NativeSpan></NativeDiv>
  </NativeDiv>;
}
