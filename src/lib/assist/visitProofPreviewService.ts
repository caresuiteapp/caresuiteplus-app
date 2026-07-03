import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { getVisitSignature, type VisitSignatureCapture } from '@/lib/assist/visitSignatureSessionStore';
import {
  pickSignatureImageUrl,
  resolveSignatureFieldStatus,
} from '@/lib/assist/visitSignatureImageService';
import { VISIT_TASK_STATUS_LABELS, type VisitTaskStatus } from '@/lib/assist/visitTypes';

export type VisitProofPreviewField = {
  label: string;
  value: string;
  required: boolean;
  missing: boolean;
};

export type VisitProofPreviewTaskItem = {
  id: string;
  title: string;
  status: VisitTaskStatus;
  statusLabel: string;
};

export type VisitProofPreview = {
  visitId: string;
  title: string;
  clientName: string;
  employeeName: string;
  serviceName: string;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number | null;
  location: string;
  documentationNote: string | null;
  tasks: VisitProofPreviewTaskItem[];
  signature: VisitSignatureCapture | null;
  signatureImageUrl?: string | null;
  fields: VisitProofPreviewField[];
  readyForExport: boolean;
  incompleteHint: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Build Leistungsnachweis preview from visit detail + persisted/session signature. */
export function buildVisitProofPreview(
  visit: VisitDispositionDetail,
  documentationNote?: string | null,
): VisitProofPreview {
  const signature = visit.persistedSignature ?? getVisitSignature(visit.id);
  const signatureImageUrl = pickSignatureImageUrl(null, signature?.dataUrl);
  const docText = documentationNote?.trim() || visit.employeeNotes?.trim() || visit.notes?.trim() || null;

  const tasks: VisitProofPreviewTaskItem[] = visit.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    statusLabel: VISIT_TASK_STATUS_LABELS[task.status],
  }));

  const fields: VisitProofPreviewField[] = [
    {
      label: 'Klient:in',
      value: visit.clientName,
      required: true,
      missing: !visit.clientName.trim(),
    },
    {
      label: 'Mitarbeitende:r',
      value: visit.employeeName,
      required: true,
      missing: !visit.employeeName.trim(),
    },
    {
      label: 'Leistung',
      value: visit.serviceName ?? visit.title,
      required: true,
      missing: !(visit.serviceName ?? visit.title)?.trim(),
    },
    {
      label: 'Termin',
      value: `${formatDateTime(visit.scheduledStart)} – ${formatDateTime(visit.scheduledEnd)}`,
      required: true,
      missing: !visit.scheduledStart,
    },
    {
      label: 'Ort',
      value: visit.location,
      required: true,
      missing: !visit.location.trim() || visit.location === '—',
    },
    {
      label: 'Dokumentation',
      value: docText ?? '—',
      required: true,
      missing: !docText,
    },
    {
      label: 'Unterschrift',
      value: resolveSignatureFieldStatus({
        hasSignatureRecord: Boolean(signature),
        hasDrawnImage: Boolean(signatureImageUrl),
      }),
      required: true,
      missing: !signature,
    },
  ];

  const readyForExport = fields.filter((f) => f.required).every((f) => !f.missing);

  return {
    visitId: visit.id,
    title: visit.title,
    clientName: visit.clientName,
    employeeName: visit.employeeName,
    serviceName: visit.serviceName ?? visit.title,
    scheduledStart: visit.scheduledStart,
    scheduledEnd: visit.scheduledEnd,
    durationMinutes: visit.durationMinutes,
    location: visit.location,
    documentationNote: docText,
    tasks,
    signature,
    signatureImageUrl,
    fields,
    readyForExport,
    incompleteHint:
      'Der Leistungsnachweis wird nach Einsatzabschluss erstellt. Prüfung und Freigabe finden Sie unter Assist → Nachweise → Prüfung.',
  };
}
