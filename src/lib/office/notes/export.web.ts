import type { NoteDraft } from './types.web';
import { NOTE_CATEGORIES, NOTE_FORMATS, NOTE_STATUSES } from './model.web';

export type NoteExportFormat = 'markdown' | 'json';

/** Only explicit web links may become clickable, in either the editor or export. */
export function safeNoteSourceUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}

const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}\[\]#|]/g, '\\$&');
const statusLabel = (value: NoteDraft['status']) => NOTE_STATUSES.find(item => item.value === value)?.label ?? value;

export function buildNoteExport(draft: NoteDraft, format: NoteExportFormat): { filename: string; mimeType: string; content: string } {
  const name = draft.title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+|\.+$/g, '').slice(0, 100).trim() || 'Notiz';
  if (format === 'json') return {
    filename: `${name}.json`, mimeType: 'application/json;charset=utf-8',
    content: JSON.stringify({ schema: 'caresuite-office-note', version: 1, note: draft }, null, 2),
  };
  const lines = [
    `# ${escapeText(draft.title.trim() || 'Notiz')}`, '',
    `Kategorie: ${NOTE_CATEGORIES.find(item => item.value === draft.category)?.label ?? draft.category}`,
    `Format: ${NOTE_FORMATS.find(item => item.value === draft.format)?.label ?? draft.format}`,
    `Status: ${statusLabel(draft.status)}`,
  ];
  if (draft.dueDate) lines.push(`Datum / Frist: ${draft.dueDate}`);
  if (draft.pinned) lines.push('Angeheftet: Ja');
  if (draft.tags.length) lines.push(`Schlagwörter: ${draft.tags.map(escapeText).join(', ')}`);
  const section = (title: string, text: string) => { if (text.trim()) lines.push('', `## ${title}`, '', escapeText(text)); };
  // Include every format's stored content even when another format is selected.
  section('Notizen', draft.content.text);
  section('Schlüsselwörter & Fragen', draft.content.cues);
  section('Zusammenfassung', draft.content.summary);
  if (draft.content.fields.length) {
    lines.push('', '## Fakten & Angaben', '');
    draft.content.fields.forEach(field => lines.push(`- **${escapeText(field.label || 'Angabe')}:** ${escapeText(field.value)}`));
  }
  if (draft.content.tasks.length) {
    lines.push('', '## Aufgaben & nächste Schritte', '');
    draft.content.tasks.forEach(task => {
      const details = [statusLabel(task.status), task.assignee && `Verantwortlich: ${escapeText(task.assignee)}`, task.dueDate && `Frist: ${task.dueDate}`].filter(Boolean).join(' · ');
      lines.push(`- [${task.status === 'done' ? 'x' : ' '}] ${escapeText(task.text || 'Aufgabe')} (${details})`);
    });
  }
  if (draft.content.sources.length) {
    lines.push('', '## Quellen & Links', '');
    draft.content.sources.forEach(source => {
      const url = safeNoteSourceUrl(source.url);
      const title = escapeText(source.title || source.url || 'Quelle');
      if (url) lines.push(`- [${title}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29')})`);
      else lines.push(`- ${title}${source.url && source.title ? ` — ${escapeText(source.url)}` : ''}`);
    });
  }
  if (draft.content.nodes.length) {
    lines.push('', '## Mindmap', '');
    const byId = new Map(draft.content.nodes.map(node => [node.id, node]));
    draft.content.nodes.forEach(node => {
      const parent = node.parentId ? byId.get(node.parentId) : null;
      lines.push(`- ${escapeText(node.text || 'Thema')}${parent ? ` — gehört zu: ${escapeText(parent.text || 'Thema')}` : ' (Hauptthema)'}`);
    });
  }
  if (draft.content.strokes.length) lines.push('', '## Handschrift', '', `${draft.content.strokes.length} gespeicherte Striche. Die Zeichnung mit allen Punkten ist im JSON-Export enthalten.`);
  return { filename: `${name}.md`, mimeType: 'text/markdown;charset=utf-8', content: `${lines.join('\n')}\n` };
}

export function downloadNote(draft: NoteDraft, format: NoteExportFormat): void {
  const exported = buildNoteExport(draft, format);
  const url = URL.createObjectURL(new Blob([exported.content], { type: exported.mimeType }));
  const link = document.createElement('a');
  try {
    link.href = url; link.download = exported.filename; link.style.display = 'none';
    document.body.appendChild(link); link.click();
  } finally {
    link.remove();
    // Allow the browser's download navigation to consume the object URL first.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
