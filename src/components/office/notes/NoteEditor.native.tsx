// Generated native presentation from src/components/office/notes/NoteEditor.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgRect,NativeSvgPath,NativeSvgCircle} from '@/components/layout/NativeSvgPresentation.native';
import {NativeDetails,NativeSummary,NativeSpan,NativeDiv,NativeFieldset,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeButton,NativeTextarea,NativeP,NativeProgress,NativeA,NativeUl,NativeLi} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../../icons/WebActionIcon.native.tsx";
import { useId, useState, type ReactNode } from 'react';
import type { NoteDraft, NoteContent, NoteField, NoteTask, NoteSource, NoteFormat } from "../../../lib/office/notes/types.native.ts";
import { NOTE_CATEGORIES, NOTE_FORMATS, NOTE_STATUSES, newNoteId } from "../../../lib/office/notes/model.native.ts";
import { safeNoteSourceUrl } from "../../../lib/office/notes/export.native.ts";
import { MindMapEditor } from "./MindMapEditor.native.tsx";
import { HandwritingEditor } from "./HandwritingEditor.native.tsx";
type Props = {
    draft: NoteDraft;
    onChange: (draft: NoteDraft) => void;
    disabled?: boolean;
};
function Section({ title, count, initialOpen, children }: {
    title: string;
    count: number;
    initialOpen: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(initialOpen);
    return <NativeDetails className="nw-editor-section" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <NativeSummary><NativeSpan>{title}</NativeSpan><NativeSpan className="nw-editor-count">{count}</NativeSpan></NativeSummary>
    <NativeDiv className="nw-editor-section-body">{children}</NativeDiv>
  </NativeDetails>;
}
function FormatIcon({ format }: {
    format: NoteFormat;
}) {
    return <WebActionIcon>
    {format === 'plain' ? <><NativeSvgRect x="5" y="3" width="14" height="18" rx="2"/><NativeSvgPath d="M9 8h6M9 12h6M9 16h4"/></> : format === 'cornell' ? <><NativeSvgRect x="3" y="4" width="18" height="16" rx="2"/><NativeSvgPath d="M9 4v11M3 15h18"/></> : format === 'mindmap' ? <><NativeSvgRect x="8" y="9" width="8" height="6" rx="2"/><NativeSvgPath d="m8 10-4-4m12 4 4-4m-4 8 4 4M8 14l-4 4"/><NativeSvgCircle cx="3" cy="5" r="2"/><NativeSvgCircle cx="21" cy="5" r="2"/><NativeSvgCircle cx="3" cy="19" r="2"/><NativeSvgCircle cx="21" cy="19" r="2"/></> : <><NativeSvgPath d="m4 17-1 4 4-1L20 7a2.2 2.2 0 0 0-3-3L4 17Zm11-11 3 3M4 17l3 3"/><NativeSvgPath d="M12 21h9"/></>}
  </WebActionIcon>;
}
export function NoteEditor({ draft, onChange, disabled = false }: Props) {
    const id = useId();
    const [tagText, setTagText] = useState('');
    const [tagMessage, setTagMessage] = useState('');
    const update = (patch: Partial<NoteDraft>) => { if (!disabled)
        onChange({ ...draft, ...patch }); };
    const content = (patch: Partial<NoteContent>) => update({ content: { ...draft.content, ...patch } });
    const field = (itemId: string, patch: Partial<NoteField>) => content({ fields: draft.content.fields.map(item => item.id === itemId ? { ...item, ...patch } : item) });
    const task = (itemId: string, patch: Partial<NoteTask>) => content({ tasks: draft.content.tasks.map(item => item.id === itemId ? { ...item, ...patch } : item) });
    const source = (itemId: string, patch: Partial<NoteSource>) => content({ sources: draft.content.sources.map(item => item.id === itemId ? { ...item, ...patch } : item) });
    const addTag = () => {
        if (disabled)
            return;
        const value = tagText.trim();
        if (!value)
            return;
        if (draft.tags.some(tag => tag.toLocaleLowerCase('de') === value.toLocaleLowerCase('de'))) {
            setTagMessage('Dieses Schlagwort ist schon vorhanden.');
            return;
        }
        if (draft.tags.length >= 30) {
            setTagMessage('Bis zu 30 Schlagwörter sind möglich.');
            return;
        }
        update({ tags: [...draft.tags, value] });
        setTagText('');
        setTagMessage('');
    };
    const completedTasks = draft.content.tasks.filter(item => item.status === 'done').length;
    return <NativeFieldset className="nw-note-editor" disabled={disabled} aria-label="Notiz bearbeiten" data-cs-notes-editor="structured-v1">
    <NativeLabel className="nw-editor-title"><NativeSpan>Titel</NativeSpan><NativeInput aria-label="Titel der Notiz" value={draft.title} onChange={event => update({ title: event.currentTarget.value })} maxLength={240} placeholder="Was möchten Sie festhalten?"/></NativeLabel>
    <NativeDiv className="nw-editor-meta">
      <NativeLabel><NativeSpan>Kategorie</NativeSpan><NativeSelect aria-label="Kategorie der Notiz" value={draft.category} onChange={event => update({ category: event.currentTarget.value as NoteDraft['category'] })}>{NOTE_CATEGORIES.map(item => <NativeOption key={item.value} value={item.value}>{item.label}</NativeOption>)}</NativeSelect></NativeLabel>
      <NativeLabel><NativeSpan>Status</NativeSpan><NativeSelect aria-label="Status der Notiz" value={draft.status} onChange={event => update({ status: event.currentTarget.value as NoteDraft['status'] })}>{NOTE_STATUSES.map(item => <NativeOption key={item.value} value={item.value}>{item.label}</NativeOption>)}</NativeSelect></NativeLabel>
      <NativeLabel><NativeSpan>Datum / Frist</NativeSpan><NativeInput aria-label="Datum oder Frist der Notiz" type="date" value={draft.dueDate} onChange={event => update({ dueDate: event.currentTarget.value })}/></NativeLabel>
    </NativeDiv>
    <NativeDiv className="nw-editor-format" role="group" aria-label="Schreibform">
      {NOTE_FORMATS.map(item => <NativeButton key={item.value} type="button" disabled={disabled} aria-pressed={draft.format === item.value} onClick={() => update({ format: item.value })}><FormatIcon format={item.value}/><NativeSpan>{item.label}</NativeSpan></NativeButton>)}
    </NativeDiv>
    {draft.format === 'cornell' ? <NativeDiv className="nw-editor-cornell">
      <NativeLabel className="nw-editor-cues"><NativeSpan>Schlüsselwörter & Fragen</NativeSpan><NativeTextarea aria-label="Schlüsselwörter und Fragen" value={draft.content.cues} onChange={event => content({ cues: event.currentTarget.value })} maxLength={100000} rows={10} placeholder="Kernbegriffe, Stichwörter, offene Fragen …"/></NativeLabel>
      <NativeLabel><NativeSpan>Notizfläche</NativeSpan><NativeTextarea aria-label="Notiztext" value={draft.content.text} onChange={event => content({ text: event.currentTarget.value })} maxLength={100000} rows={10} placeholder="Die wichtigsten Informationen in eigenen Worten …"/></NativeLabel>
      <NativeLabel className="nw-editor-summary"><NativeSpan>Zusammenfassung</NativeSpan><NativeTextarea aria-label="Zusammenfassung" value={draft.content.summary} onChange={event => content({ summary: event.currentTarget.value })} maxLength={100000} rows={3} placeholder="Was bleibt? Zwei oder drei kurze Sätze …"/></NativeLabel>
    </NativeDiv> : <>
      {draft.format === 'mindmap' && <MindMapEditor nodes={draft.content.nodes} onChange={nodes => content({ nodes })} disabled={disabled}/>}
      {draft.format === 'handwriting' && <HandwritingEditor strokes={draft.content.strokes} onChange={strokes => content({ strokes })} disabled={disabled}/>}
      <NativeLabel className="nw-editor-body"><NativeSpan>{draft.format === 'plain' ? 'Notiz' : 'Ergänzende Notizen'}</NativeSpan><NativeTextarea aria-label="Notiztext" value={draft.content.text} onChange={event => content({ text: event.currentTarget.value })} maxLength={100000} rows={draft.format === 'plain' ? 9 : 4} placeholder="Fakten, Gedanken, Entscheidungen oder Fragen festhalten …"/></NativeLabel>
    </>}
    <NativeP className="nw-editor-hint">Beim Wechsel der Schreibform bleiben alle Inhalte erhalten.</NativeP>
    <NativeDiv className="nw-editor-sections">
      <Section title="Fakten & Angaben" count={draft.content.fields.length} initialOpen={draft.content.fields.length > 0}>
        <NativeP className="nw-editor-hint">Zum Beispiel Name, Kontakt, Geburtstag, Definition oder Entscheidung.</NativeP>
        {draft.content.fields.map((item, index) => <NativeDiv className="nw-editor-field-row" key={item.id}>
          <NativeLabel><NativeSpan>Bezeichnung</NativeSpan><NativeInput aria-label={`Bezeichnung ${index + 1}`} value={item.label} maxLength={100} onChange={event => field(item.id, { label: event.currentTarget.value })} placeholder="z. B. Telefonnummer"/></NativeLabel>
          <NativeLabel><NativeSpan>Angabe</NativeSpan><NativeTextarea aria-label={`Angabe ${index + 1}`} value={item.value} maxLength={5000} rows={1} onChange={event => field(item.id, { value: event.currentTarget.value })} placeholder="Information eintragen"/></NativeLabel>
          <NativeButton type="button" className="nw-editor-remove" aria-label={`Angabe ${index + 1} entfernen`} onClick={() => content({ fields: draft.content.fields.filter(value => value.id !== item.id) })}>Entfernen</NativeButton>
        </NativeDiv>)}
        <NativeButton type="button" className="nw-editor-add" disabled={draft.content.fields.length >= 80} onClick={() => content({ fields: [...draft.content.fields, { id: newNoteId(), label: '', value: '' }] })}>+ Angabe hinzufügen</NativeButton>
        {draft.content.fields.length >= 80 && <NativeP className="nw-editor-hint">Die Grenze von 80 Angaben ist erreicht.</NativeP>}
      </Section>
      <Section title="Aufgaben & nächste Schritte" count={draft.content.tasks.length} initialOpen={draft.content.tasks.length > 0 || draft.category === 'tasks' || draft.category === 'next_steps'}>
        {draft.content.tasks.length > 0 && <NativeDiv className="nw-editor-task-progress"><NativeSpan>{completedTasks} von {draft.content.tasks.length} erledigt</NativeSpan><NativeProgress value={completedTasks} max={draft.content.tasks.length} aria-label="Erledigte Aufgaben"/></NativeDiv>}
        {draft.content.tasks.map((item, index) => <NativeDiv className="nw-editor-task" data-status={item.status} key={item.id}>
          <NativeDiv className="nw-editor-task-heading"><NativeLabel><NativeSpan>Aufgabe {index + 1}</NativeSpan><NativeTextarea aria-label={`Aufgabe ${index + 1}`} value={item.text} maxLength={2000} rows={2} onChange={event => task(item.id, { text: event.currentTarget.value })} placeholder="Welcher konkrete Schritt steht an?"/></NativeLabel><NativeButton type="button" className="nw-editor-remove" aria-label={`Aufgabe ${index + 1} entfernen`} onClick={() => content({ tasks: draft.content.tasks.filter(value => value.id !== item.id) })}>Entfernen</NativeButton></NativeDiv>
          <NativeDiv className="nw-editor-task-meta">
            <NativeLabel><NativeSpan>Status</NativeSpan><NativeSelect aria-label={`Status Aufgabe ${index + 1}`} value={item.status} onChange={event => task(item.id, { status: event.currentTarget.value as NoteTask['status'] })}>{NOTE_STATUSES.map(value => <NativeOption key={value.value} value={value.value}>{value.label}</NativeOption>)}</NativeSelect></NativeLabel>
            <NativeLabel><NativeSpan>Verantwortlich</NativeSpan><NativeInput aria-label={`Verantwortlich Aufgabe ${index + 1}`} value={item.assignee} maxLength={160} onChange={event => task(item.id, { assignee: event.currentTarget.value })} placeholder="Name"/></NativeLabel>
            <NativeLabel><NativeSpan>Frist</NativeSpan><NativeInput aria-label={`Frist Aufgabe ${index + 1}`} type="date" value={item.dueDate} onChange={event => task(item.id, { dueDate: event.currentTarget.value })}/></NativeLabel>
          </NativeDiv>
        </NativeDiv>)}
        <NativeButton type="button" className="nw-editor-add" disabled={draft.content.tasks.length >= 200} onClick={() => content({ tasks: [...draft.content.tasks, { id: newNoteId(), text: '', status: 'open', assignee: '', dueDate: '' }] })}>+ Aufgabe hinzufügen</NativeButton>
        {draft.content.tasks.length >= 200 && <NativeP className="nw-editor-hint">Die Grenze von 200 Aufgaben ist erreicht.</NativeP>}
      </Section>
      <Section title="Quellen & Links" count={draft.content.sources.length} initialOpen={draft.content.sources.length > 0 || draft.category === 'sources'}>
        {draft.content.sources.map((item, index) => {
            const href = safeNoteSourceUrl(item.url);
            const invalid = Boolean(item.url.trim() && !href);
            return <NativeDiv className="nw-editor-source" key={item.id}>
            <NativeDiv className="nw-editor-source-fields"><NativeLabel><NativeSpan>Quelle {index + 1}</NativeSpan><NativeInput aria-label={`Titel Quelle ${index + 1}`} value={item.title} maxLength={240} onChange={event => source(item.id, { title: event.currentTarget.value })} placeholder="Buch, Artikel, Webseite oder Dokument"/></NativeLabel>
              <NativeLabel><NativeSpan>Webadresse (optional)</NativeSpan><NativeInput aria-label={`Webadresse Quelle ${index + 1}`} type="url" value={item.url} maxLength={2048} onChange={event => source(item.id, { url: event.currentTarget.value })} placeholder="https://…" aria-invalid={invalid} aria-describedby={invalid ? `${id}-source-error-${item.id}` : undefined}/></NativeLabel></NativeDiv>
            {invalid && <NativeP className="nw-editor-error" id={`${id}-source-error-${item.id}`}>Bitte eine vollständige Adresse mit https:// oder http:// eingeben.</NativeP>}
            <NativeDiv className="nw-editor-source-actions">{href && <NativeA href={href} target="_blank" rel="noopener noreferrer" aria-label={`Quelle ${index + 1} öffnen`}>Quelle öffnen ↗</NativeA>}<NativeButton type="button" className="nw-editor-remove" aria-label={`Quelle ${index + 1} entfernen`} onClick={() => content({ sources: draft.content.sources.filter(value => value.id !== item.id) })}>Entfernen</NativeButton></NativeDiv>
          </NativeDiv>;
        })}
        <NativeButton type="button" className="nw-editor-add" disabled={draft.content.sources.length >= 100} onClick={() => content({ sources: [...draft.content.sources, { id: newNoteId(), title: '', url: '' }] })}>+ Quelle hinzufügen</NativeButton>
        {draft.content.sources.length >= 100 && <NativeP className="nw-editor-hint">Die Grenze von 100 Quellen ist erreicht.</NativeP>}
      </Section>
      <Section title="Schlagwörter & Ablage" count={draft.tags.length} initialOpen={draft.tags.length > 0}>
        {draft.tags.length > 0 && <NativeUl className="nw-editor-tags" aria-label="Schlagwörter">{draft.tags.map(tag => <NativeLi key={tag}><NativeSpan>{tag}</NativeSpan><NativeButton type="button" aria-label={`Schlagwort ${tag} entfernen`} onClick={() => update({ tags: draft.tags.filter(value => value !== tag) })}>×</NativeButton></NativeLi>)}</NativeUl>}
        <NativeDiv className="nw-editor-tag-input"><NativeLabel><NativeSpan>Neues Schlagwort</NativeSpan><NativeInput aria-label="Neues Schlagwort" value={tagText} maxLength={40} onChange={event => { setTagText(event.currentTarget.value); setTagMessage(''); }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
        event.preventDefault();
        addTag();
    } }} placeholder="z. B. Teamrunde"/></NativeLabel><NativeButton type="button" className="nw-editor-add" disabled={!tagText.trim() || draft.tags.length >= 30} onClick={addTag}>Hinzufügen</NativeButton></NativeDiv>
        {tagMessage && <NativeP className="nw-editor-hint" role="status">{tagMessage}</NativeP>}
        {draft.tags.length >= 30 && <NativeP className="nw-editor-hint">Die Grenze von 30 Schlagwörtern ist erreicht.</NativeP>}
        <NativeLabel className="nw-editor-pin"><NativeInput type="checkbox" checked={draft.pinned} onChange={event => update({ pinned: event.currentTarget.checked })}/><NativeSpan>Notiz oben anheften</NativeSpan></NativeLabel>
      </Section>
    </NativeDiv>
  </NativeFieldset>;
}
