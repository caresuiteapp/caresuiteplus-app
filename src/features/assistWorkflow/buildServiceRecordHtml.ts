/**
 * ASSIST.WORKFLOW.1 — HTML/print view for Leistungsnachweis.
 */
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';
import type { VisitTimesSummary } from './calculateVisitTimes';
import { formatSignatureMetadataLine } from '@/lib/assist/visitSignatureImageService';
import {
  buildSignatureProofImageStyle,
  resolveSignatureImageDimensions,
  signatureProofImageStyleToCss,
} from '@/lib/signatures/signatureOrientation';

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

export function buildServiceRecordHtml(input: ServiceRecordContentInput): string {
  const {
    detail,
    visitTimes,
    documentationText,
    signatureSummary,
    signatureImageUrl,
    signatureImageWidth,
    signatureImageHeight,
  } = input;
  const tasksHtml = detail.tasks
    .map(
      (t) =>
        `<tr><td>${escapeHtml(t.title)}</td><td>${escapeHtml(t.status)}</td><td>${escapeHtml(t.completionNote ?? '')}</td></tr>`,
    )
    .join('');

  const signatureSection = signatureSummary
    ? (() => {
        const metaLine = formatSignatureMetadataLine({
          signerName: signatureSummary.signerName,
          signedAt: signatureSummary.signedAt,
          signatureType: signatureSummary.signerRole ?? null,
        });
        const metaHtml = metaLine
          ? `<p style="margin:4px 0 0;font-size:0.875rem;color:#555;">${escapeHtml(metaLine)}</p>`
          : '';
        const signatureDimensions = resolveSignatureImageDimensions(
          signatureImageUrl,
          signatureImageWidth,
          signatureImageHeight,
        );
        const signatureImageStyle = signatureProofImageStyleToCss(
          buildSignatureProofImageStyle(
            signatureDimensions?.width,
            signatureDimensions?.height,
          ),
        );
        const imageHtml = signatureImageUrl?.trim()
          ? `<img src="${escapeHtml(signatureImageUrl)}" alt="Unterschrift" style="${signatureImageStyle}" />`
          : `<p style="margin:8px 0 0;color:#666;font-style:italic;">Keine gezeichnete Unterschrift gespeichert.</p>`;
        return `<section><h2>Unterschrift Klient:in</h2>${imageHtml}${metaHtml}</section>`;
      })()
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <title>Leistungsnachweis — ${escapeHtml(detail.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; color: #1a1a1a; }
    h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    .meta { color: #666; font-size: 0.875rem; margin-bottom: 1.5rem; }
    section { margin-bottom: 1.25rem; }
    h2 { font-size: 1rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid #eee; }
    .times { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    .times dt { font-weight: 600; }
    .doc { white-space: pre-wrap; background: #f9f9f9; padding: 0.75rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Leistungsnachweis</h1>
  <p class="meta">${escapeHtml(detail.clientName)} · ${formatDateTime(detail.plannedStartAt)}</p>

  <section>
    <h2>Einsatz</h2>
    <p><strong>${escapeHtml(detail.title)}</strong></p>
    <p>${escapeHtml(detail.locationAddress)}</p>
  </section>

  <section>
    <h2>Zeiten</h2>
    <dl class="times">
      <dt>Anfahrt</dt><dd>${formatDuration(visitTimes?.driveSeconds ?? null)}</dd>
      <dt>Einsatz</dt><dd>${formatDuration(visitTimes?.serviceSeconds ?? null)}</dd>
      <dt>Pause</dt><dd>${formatDuration(visitTimes?.pauseSeconds ?? null)}</dd>
      <dt>Angekommen</dt><dd>${formatDateTime(visitTimes?.arrivedAt)}</dd>
      <dt>Einsatz gestartet</dt><dd>${formatDateTime(visitTimes?.serviceStartedAt)}</dd>
      <dt>Einsatz beendet</dt><dd>${formatDateTime(visitTimes?.serviceEndedAt)}</dd>
    </dl>
  </section>

  <section>
    <h2>Aufgaben</h2>
    <table>
      <thead><tr><th>Aufgabe</th><th>Status</th><th>Hinweis</th></tr></thead>
      <tbody>${tasksHtml || '<tr><td colspan="3">Keine Aufgaben</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>Dokumentation</h2>
    <div class="doc">${escapeHtml(documentationText?.trim() || '—')}</div>
  </section>

  ${signatureSection}

  <p class="meta">Erstellt ${formatDateTime(new Date().toISOString())} · CareSuite+ Assist</p>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildServiceRecordSnapshot(input: ServiceRecordContentInput): Record<string, unknown> {
  const tasks = input.detail.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    note: t.completionNote,
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
    generatedAt: new Date().toISOString(),
  };
}
