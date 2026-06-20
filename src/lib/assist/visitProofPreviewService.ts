import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { getVisitSignature, type VisitSignatureCapture } from '@/lib/assist/visitSignatureSessionStore';
import { VISIT_TASK_STATUS_LABELS } from '@/lib/assist/visitTypes';

export type VisitProofPreviewField = {
  label: string;
  value: string;
  required: boolean;
  missing: boolean;
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
  tasksSummary: string;
  signature: VisitSignatureCapture | null;
  fields: VisitProofPreviewField[];
  readyForExport: boolean;
  storageGapMessage: string;
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

/** Build Leistungsnachweis preview from visit detail + session signature (no PDF persist). */
export function buildVisitProofPreview(
  visit: VisitDispositionDetail,
  documentationNote?: string | null,
): VisitProofPreview {
  const signature = getVisitSignature(visit.id);
  const docText = documentationNote?.trim() || visit.employeeNotes?.trim() || visit.notes?.trim() || null;

  const tasksSummary =
    visit.tasks.length === 0
      ? 'Keine Aufgaben hinterlegt'
      : visit.tasks
          .map((t) => `${t.title}: ${VISIT_TASK_STATUS_LABELS[t.status]}`)
          .join(' · ');

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
      missing: !visit.location.trim(),
    },
    {
      label: 'Dokumentation',
      value: docText ?? '—',
      required: true,
      missing: !docText,
    },
    {
      label: 'Aufgaben',
      value: tasksSummary,
      required: false,
      missing: false,
    },
    {
      label: 'Unterschrift',
      value: signature
        ? `${signature.signerName} (${signature.signerRole}) · ${formatDateTime(signature.signedAt)}`
        : '—',
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
    tasksSummary,
    signature,
    fields,
    readyForExport,
    storageGapMessage:
      'Persistente Speicherung in assist_visit_proofs fehlt (P0) — Vorschau nur, kein auditierbares PDF-Archiv.',
  };
}
