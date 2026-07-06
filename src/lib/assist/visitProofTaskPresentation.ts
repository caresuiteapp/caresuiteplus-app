/**
 * Central Leistungsnachweis task + documentation presentation logic (layout v2).
 * Used by PDF export, preview, and service-record HTML.
 */
import { VISIT_TASK_STATUS_LABELS, type VisitTaskStatus } from '@/lib/assist/visitTypes';

export const VISIT_PROOF_LAYOUT_VERSION = 'v2';

export type VisitProofTaskInput = {
  id?: string;
  title: string;
  status?: string | null;
  statusLabel?: string | null;
  note?: string | null;
  reason?: string | null;
  completionNote?: string | null;
  notDoneReason?: string | null;
  isInternal?: boolean | null;
  isWorkflow?: boolean | null;
  category?: string | null;
  type?: string | null;
  moduleArea?: string | null;
};

export type VisitProofTaskDeviation = {
  title: string;
  statusLabel: string;
  reason: string;
};

export type VisitProofTasksPresentation = {
  allCompleted: boolean;
  hasDeviations: boolean;
  deviations: VisitProofTaskDeviation[];
  fachlicheTaskCount: number;
};

const COMPLETED_STATUS_TOKENS = new Set([
  'completed',
  'done',
  'erledigt',
  'abgeschlossen',
  'checked',
  'true',
  '1',
]);

const DEVIATION_STATUS_TOKENS = new Set([
  'not_completed',
  'skipped',
  'declined',
  'rejected',
  'not_requested',
  'partially_completed',
  'partial',
  'failed',
  'unable',
  'not_done',
  'not_possible',
  'nicht erledigt',
  'nicht gewünscht',
  'abgelehnt',
  'teilweise erledigt',
  'cancelled',
  'deferred',
  'open',
  'offen',
  'requires_follow_up',
  'verschoben',
  'abgebrochen',
]);

const TECHNICAL_DOCUMENTATION_VALUES = new Set([
  'submitted',
  'draft',
  'locked',
  'none',
  'open',
  'complete',
  'review',
  'pending',
  'approved',
  'exported',
  'finalized',
  'signed',
  'verified',
  'rejected',
  'true',
  'false',
]);

/** Workflow/system steps — never show as fachliche Leistungsaufgaben on proofs. */
const INTERNAL_WORKFLOW_TITLE_PATTERNS: RegExp[] = [
  /^einsatzbeginn dokumentieren$/i,
  /^einsatz dokumentieren$/i,
  /^einsatz antreten$/i,
  /^unterwegs markieren$/i,
  /^angekommen markieren$/i,
  /^einsatz starten$/i,
  /^leistungsnachweis erzeugen$/i,
  /^unterschrift einholen$/i,
  /^besonderheit dokumentieren$/i,
  /^klient:?in begrüßen$/i,
  /^klient begrüßen$/i,
  /^abschlusskontrolle$/i,
  /^einsatzprotokoll erstellen$/i,
  /^einsatz abschließen$/i,
  /^einsatz beenden$/i,
  /^nachweis erstellen$/i,
  /^dokumentation abschließen$/i,
];

const INTERNAL_CATEGORY_TOKENS = new Set([
  'workflow',
  'system',
  'internal',
  'dokumentation_leistungsnachweis',
  'einsatzvorbereitung',
  'dokumentation',
]);

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function normalizeVisitProofTaskStatus(status: string | null | undefined): string {
  return normalizeToken(status);
}

export function isVisitProofTaskCompleted(status: string | null | undefined): boolean {
  const token = normalizeVisitProofTaskStatus(status);
  if (!token) return false;
  return COMPLETED_STATUS_TOKENS.has(token);
}

export function isVisitProofTaskDeviation(status: string | null | undefined): boolean {
  const token = normalizeVisitProofTaskStatus(status);
  if (!token) return true;
  if (isVisitProofTaskCompleted(token)) return false;
  if (DEVIATION_STATUS_TOKENS.has(token)) return true;
  return true;
}

export function isInternalWorkflowProofTask(task: VisitProofTaskInput): boolean {
  if (task.isInternal === true || task.isWorkflow === true) return true;

  const category = normalizeToken(task.category ?? task.type ?? task.moduleArea);
  if (category && INTERNAL_CATEGORY_TOKENS.has(category)) return true;
  if (category.includes('workflow') || category.includes('leistungsnachweis')) return true;

  const title = String(task.title ?? '').trim();
  if (!title) return true;
  return INTERNAL_WORKFLOW_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

export function resolveVisitProofTaskStatusLabel(
  status: string | null | undefined,
  statusLabel?: string | null,
): string {
  const rawLabel = String(statusLabel ?? '').trim();
  const token = normalizeVisitProofTaskStatus(status);

  if (token in VISIT_TASK_STATUS_LABELS) {
    return VISIT_TASK_STATUS_LABELS[token as VisitTaskStatus];
  }

  const labelMap: Record<string, string> = {
    completed: 'Erledigt',
    done: 'Erledigt',
    erledigt: 'Erledigt',
    not_done: 'Nicht erledigt',
    not_completed: 'Nicht erledigt',
    skipped: 'Nicht durchgeführt',
    declined: 'Abgelehnt',
    rejected: 'Abgelehnt',
    not_requested: 'Nicht gewünscht',
    partial: 'Teilweise erledigt',
    partially_completed: 'Teilweise erledigt',
    failed: 'Nicht durchgeführt',
    unable: 'Nicht möglich',
    requires_follow_up: 'Nachverfolgung',
  };

  if (token && labelMap[token]) return labelMap[token];

  if (rawLabel && !TECHNICAL_DOCUMENTATION_VALUES.has(normalizeToken(rawLabel))) {
    return rawLabel;
  }

  if (!token) return 'Unklar dokumentiert';

  if (process.env.NODE_ENV !== 'production') {
    console.warn('[visitProofTaskPresentation] Unbekannter Aufgabenstatus:', status);
  }
  return 'Unklar dokumentiert';
}

function resolveTaskReason(task: VisitProofTaskInput): string {
  const candidates = [task.note, task.reason, task.completionNote, task.notDoneReason];
  for (const value of candidates) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return 'Keine Begründung dokumentiert.';
}

export function filterFachlicheProofTasks(tasks: VisitProofTaskInput[]): VisitProofTaskInput[] {
  return tasks.filter((task) => task.title?.trim() && !isInternalWorkflowProofTask(task));
}

export function buildVisitProofTasksPresentation(
  tasks: VisitProofTaskInput[],
): VisitProofTasksPresentation {
  const fachliche = filterFachlicheProofTasks(tasks);

  if (fachliche.length === 0) {
    return {
      allCompleted: true,
      hasDeviations: false,
      deviations: [],
      fachlicheTaskCount: 0,
    };
  }

  const deviations: VisitProofTaskDeviation[] = [];

  for (const task of fachliche) {
    if (!isVisitProofTaskDeviation(task.status)) continue;
    deviations.push({
      title: task.title.trim(),
      statusLabel: resolveVisitProofTaskStatusLabel(task.status, task.statusLabel),
      reason: resolveTaskReason(task),
    });
  }

  return {
    allCompleted: deviations.length === 0,
    hasDeviations: deviations.length > 0,
    deviations,
    fachlicheTaskCount: fachliche.length,
  };
}

export function resolveVisitProofDocumentationText(
  snapshot: Record<string, unknown>,
  enrichmentNote?: string | null,
): string {
  const candidates = [
    enrichmentNote,
    snapshot.documentation_text,
    snapshot.documentationText,
    snapshot.documentationNote,
    snapshot.notes,
    snapshot.visit_notes,
    snapshot.visitNotes,
    snapshot.employee_documentation,
    snapshot.employeeDocumentation,
    snapshot.care_documentation,
    snapshot.careDocumentation,
    snapshot.completion_notes,
    snapshot.completionNotes,
    snapshot.special_notes,
    snapshot.specialNotes,
    snapshot.deviations_notes,
    snapshot.deviationsNotes,
    snapshot.documentation,
  ];

  for (const value of candidates) {
    if (value == null) continue;
    const text = String(value).trim();
    if (!text) continue;
    if (TECHNICAL_DOCUMENTATION_VALUES.has(normalizeToken(text))) continue;
    if (/^[\[{]/.test(text)) continue;
    return text;
  }

  return 'Keine zusätzliche Dokumentation erfasst.';
}

export function parseVisitProofTasksFromSnapshot(
  snapshot: Record<string, unknown>,
): VisitProofTaskInput[] {
  const raw = snapshot.tasks ?? snapshot.taskList;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry): VisitProofTaskInput | null => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const title = String(row.title ?? row.taskTitle ?? row.label ?? '').trim();
      if (!title) return null;
      return {
        id: row.id != null ? String(row.id) : undefined,
        title,
        status: row.status != null ? String(row.status) : null,
        statusLabel: row.statusLabel != null ? String(row.statusLabel) : null,
        note: row.note != null ? String(row.note) : null,
        reason: row.reason != null ? String(row.reason) : null,
        completionNote: row.completionNote != null ? String(row.completionNote) : null,
        notDoneReason: row.notDoneReason != null ? String(row.notDoneReason) : null,
        isInternal: row.isInternal === true || row.is_internal === true,
        isWorkflow: row.isWorkflow === true || row.is_workflow === true,
        category:
          row.category != null
            ? String(row.category)
            : row.categoryKey != null
              ? String(row.categoryKey)
              : null,
        type: row.type != null ? String(row.type) : null,
        moduleArea: row.moduleArea != null ? String(row.moduleArea) : null,
      };
    })
    .filter((item): item is VisitProofTaskInput => item != null);
}
