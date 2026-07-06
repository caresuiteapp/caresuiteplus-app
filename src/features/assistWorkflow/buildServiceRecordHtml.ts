/**
 * ASSIST.WORKFLOW.1 — HTML/print view for Leistungsnachweis (layout v2).
 */
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';
import type { VisitTimesSummary } from './calculateVisitTimes';
import { formatSignatureMetadataLine } from '@/lib/assist/visitSignatureImageService';
import {
  buildSignatureProofImageStyle,
  resolveSignatureImageDimensions,
  signatureProofImageStyleToCss,
} from '@/lib/signatures/signatureOrientation';
import { resolveVisitProofBranding, type VisitProofBrandingInput } from '@/lib/assist/visitProofBranding';
import { buildVisitProofLayoutHtml } from '@/lib/assist/visitProofPdfLayout';
import {
  buildVisitProofTasksPresentation,
  resolveVisitProofDocumentationText,
  type VisitProofTaskInput,
} from '@/lib/assist/visitProofTaskPresentation';

export type ServiceRecordContentInput = {
  detail: EmployeePortalAssignmentDetail;
  visitTimes: VisitTimesSummary | null;
  documentationText?: string | null;
  signatureSummary?: { signerName: string; signedAt: string; signerRole?: string | null } | null;
  signatureImageUrl?: string | null;
  signatureImageWidth?: number | null;
  signatureImageHeight?: number | null;
  visitId?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  serviceName?: string | null;
  proofNumber?: string | null;
  generatedAt?: string | null;
  branding?: VisitProofBrandingInput;
};

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapPortalTasks(detail: EmployeePortalAssignmentDetail): VisitProofTaskInput[] {
  return detail.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    completionNote: task.completionNote,
    notDoneReason: task.completionNote,
    category: task.categoryKey ?? null,
  }));
}

export function buildServiceRecordHtml(input: ServiceRecordContentInput): string {
  const {
    detail,
    visitTimes,
    documentationText,
    signatureSummary,
    signatureImageUrl,
    signatureImageWidth,
    signatureImageHeight,
    employeeName,
    serviceName,
    proofNumber,
    generatedAt,
    branding: brandingInput,
  } = input;

  const snapshot: Record<string, unknown> = {
    documentation: documentationText,
    documentationNote: documentationText,
  };

  const branding = resolveVisitProofBranding(snapshot, {
    ...brandingInput,
    tenantName: brandingInput?.tenantName ?? detail.tenantId,
  });

  const tasksPresentation = buildVisitProofTasksPresentation(mapPortalTasks(detail));
  const documentation = resolveVisitProofDocumentationText(snapshot, documentationText);

  const signatureMetaLine = signatureSummary
    ? formatSignatureMetadataLine({
        signerName: signatureSummary.signerName,
        signedAt: signatureSummary.signedAt,
        signatureType: signatureSummary.signerRole ?? null,
      })
    : '';

  const signatureMetaHtml = signatureMetaLine
    ? `<p class="proof-signature-meta">${signatureMetaLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
    : '';

  const signatureDimensions = resolveSignatureImageDimensions(
    signatureImageUrl,
    signatureImageWidth,
    signatureImageHeight,
  );
  const signatureImageStyle = signatureProofImageStyleToCss(
    buildSignatureProofImageStyle(signatureDimensions?.width, signatureDimensions?.height),
  );

  const signatureImageHtml = signatureImageUrl?.trim()
    ? `<img src="${signatureImageUrl.replace(/"/g, '&quot;')}" alt="Unterschrift" style="${signatureImageStyle}" />`
    : signatureSummary
      ? `<p style="margin:0;color:#6b7280;font-style:italic;font-size:12px;">Keine gezeichnete Unterschrift gespeichert.</p>`
      : '';

  const plannedRange = `${formatDateTime(detail.plannedStartAt)} – ${formatDateTime(detail.plannedEndAt)}`;

  return buildVisitProofLayoutHtml({
    title: `Leistungsnachweis — ${serviceName ?? detail.title}`,
    branding,
    meta: {
      proofNumber: proofNumber ?? detail.assignmentId.slice(0, 8).toUpperCase(),
      generatedAt: formatDateTime(generatedAt ?? new Date().toISOString()),
      serviceDate: formatDateTime(detail.plannedStartAt),
      providerName: branding.legalName ?? branding.tenantName,
    },
    stammdaten: {
      clientName: detail.clientName,
      employeeName: employeeName ?? '—',
      serviceName: serviceName ?? detail.title,
      location: detail.locationAddress,
    },
    times: {
      plannedRange,
      actualStart: formatDateTime(visitTimes?.serviceStartedAt ?? visitTimes?.arrivedAt),
      actualEnd: formatDateTime(visitTimes?.serviceEndedAt),
      serviceDuration: formatDuration(visitTimes?.serviceSeconds ?? null),
      driveDuration: formatDuration(visitTimes?.driveSeconds ?? null),
    },
    tasksPresentation,
    documentation,
    signature: {
      imageHtml: signatureImageHtml,
      metaHtml: signatureMetaHtml,
      emptyMessage: !signatureSummary ? 'Keine Signatur hinterlegt' : null,
    },
  });
}

export function buildServiceRecordSnapshot(input: ServiceRecordContentInput): Record<string, unknown> {
  const tasks = input.detail.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    note: t.completionNote,
    completionNote: t.completionNote,
    category: t.categoryKey ?? null,
  }));
  const tasksSummary = tasks.map((t) => `${t.title} (${t.status})`).join('; ') || null;

  return {
    assignmentId: input.detail.assignmentId,
    clientId: input.detail.clientId,
    visitId: input.visitId ?? null,
    employeeId: input.employeeId ?? null,
    title: input.detail.title,
    clientName: input.detail.clientName,
    employeeName: input.employeeName ?? '—',
    serviceName: input.serviceName ?? input.detail.title,
    location: input.detail.locationAddress,
    locationAddress: input.detail.locationAddress,
    plannedStartAt: input.detail.plannedStartAt,
    plannedEndAt: input.detail.plannedEndAt,
    scheduledStart: input.detail.plannedStartAt,
    scheduledEnd: input.detail.plannedEndAt,
    visitTimes: input.visitTimes,
    tasks,
    tasksSummary,
    documentation: input.documentationText ?? null,
    documentationNote: input.documentationText ?? null,
    signature: input.signatureSummary ?? null,
    signerName: input.signatureSummary?.signerName ?? null,
    signedAt: input.signatureSummary?.signedAt ?? null,
    layoutVersion: 'v2',
    generatedAt: new Date().toISOString(),
  };
}
