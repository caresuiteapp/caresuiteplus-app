import type { QmDocument, QmHandbookChapter } from './qm.types';

export const QM_DOCUMENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf', in_review: 'In Prüfung', approved: 'Freigegeben',
  published: 'Veröffentlicht', archived: 'Archiviert', superseded: 'Ersetzt',
};
export const QM_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  procedure: 'Verfahren', work_instruction: 'Arbeitsanweisung', checklist: 'Checkliste',
  protocol: 'Protokoll', policy: 'Richtlinie', form: 'Formular', handbook_chapter: 'Handbuch-Kapitel',
};

export function qmMatchesSearch(value: string, query: string): boolean {
  const text = value.toLocaleLowerCase('de-DE');
  return query.trim().toLocaleLowerCase('de-DE').split(/\s+/).filter(Boolean).every(word => text.includes(word));
}

export function filterQmDocuments(documents: readonly QmDocument[], query: string, status = '', type = ''): QmDocument[] {
  return documents.filter(document => (!status || document.status === status) && (!type || document.documentType === type)
    && qmMatchesSearch([document.title, document.documentNumber, document.ownerRole, ...document.tags,
      QM_DOCUMENT_TYPE_LABELS[document.documentType] ?? document.documentType].join(' '), query));
}

/** Preserve a useful parent path even when a search hides the parent itself; never recurse through malformed cycles. */
export function qmChapterParentPath(chapter: QmHandbookChapter, chapters: readonly QmHandbookChapter[]): string {
  const index = new Map(chapters.map(item => [item.id, item]));
  const seen = new Set([chapter.id]);
  const path: string[] = [];
  let parentId = chapter.parentId;
  while (parentId && !seen.has(parentId)) {
    const parent = index.get(parentId);
    if (!parent || parent.handbookId !== chapter.handbookId) break;
    seen.add(parentId); path.unshift(parent.title); parentId = parent.parentId;
  }
  return path.join(' / ');
}

export function qmDisplayDate(value: string | null | undefined): string {
  if (!value) return 'Nicht hinterlegt';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Datum ungeklärt' : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
