import { ASSIGNMENT_STATUS_LABELS, type AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { VisitProofStatus, VisitTaskItem, VisitTaskStatus } from './visitTypes';

export function visitWorkflowLabel(status: AssignmentStatus, proof?: VisitProofStatus): string {
  if (status === 'unterschrift_offen' && (proof === 'signed' || proof === 'verified')) {
    return 'Unterschrieben · Nachbearbeitung offen';
  }
  return ASSIGNMENT_STATUS_LABELS[status];
}

/** Refreshing one section must not discard another section's unsaved task choices. */
export function mergeAdministrativeTaskDrafts(previous: Record<string, VisitTaskStatus>, tasks: VisitTaskItem[], drafts: Record<string, VisitTaskStatus>) {
  return Object.fromEntries(tasks.map(task => [task.id,
    drafts[task.id] != null && drafts[task.id] !== previous[task.id] ? drafts[task.id] : task.status,
  ])) as Record<string, VisitTaskStatus>;
}

export function documentationBlockAlreadyStored(existing: string | null | undefined, addition: string): boolean {
  const normalized = (text: string) => text.trim().replace(/\s+/g, ' ');
  const content = normalized(addition);
  if (!content) return false;
  return normalized(existing ?? '') === content || (existing ?? '').split(/\n\s*\n/)
    .some(block => normalized(block.replace(/^\[Administrative Ergänzung [^\]]+\]\s*/, '')) === content);
}

/** Append-only notes are stored separately by the existing administrative RPC. */
export function buildAdministrativeDocumentationText(row: { short_description?: string | null; special_notes?: string | null }): string | null {
  const original = row.short_description?.trim() ?? '';
  const notes = row.special_notes?.trim() ?? '';
  const marker = notes.search(/\[Administrative Ergänzung \d{4}-\d{2}-\d{2} /);
  const additions = marker >= 0 ? notes.slice(marker) : '';
  if (!original) return notes || null;
  if (!additions || original.endsWith(additions)) return original;
  return `${original}\n\n${additions}`;
}
