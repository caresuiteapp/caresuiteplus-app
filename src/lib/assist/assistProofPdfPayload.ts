import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import type { VisitTimesSummary } from '@/features/assistWorkflow/calculateVisitTimes';
import type { VisitProofSnapshotEnrichment } from '@/lib/assist/visitProofSnapshotPreviewService';
import {
  formatSignatureMetadataLine,
  pickSignatureImageUrl,
} from '@/lib/assist/visitSignatureImageService';
import {
  buildSignatureProofImageStyle,
  resolveSignatureImageDimensions,
  signatureProofImageStyleToCss,
} from '@/lib/signatures/signatureOrientation';
import { resolveVisitProofBranding } from '@/lib/assist/visitProofBranding';
import { buildVisitProofLayoutHtml } from '@/lib/assist/visitProofPdfLayout';
import {
  buildVisitProofTasksPresentation,
  parseVisitProofTasksFromSnapshot,
  resolveVisitProofDocumentationText,
  type VisitProofTaskInput,
} from '@/lib/assist/visitProofTaskPresentation';

export type AssistProofPdfPayload = {
  proofId: string;
  visitId: string;
  title: string;
  html: string;
  fileName: string;
  layoutVersion: string;
};

const GPS_SNAPSHOT_KEYS = new Set([
  'latitude',
  'longitude',
  'accuracyMeters',
  'locationPoints',
  'trackingSession',
  'gps',
  'geofence',
]);

/** Keys that must never appear in client portal or PDF exports. */
export const PORTAL_BLOCKED_SNAPSHOT_KEYS = new Set([
  ...GPS_SNAPSHOT_KEYS,
  'internalNotes',
  'internalNote',
  'internal_notes',
  'drivingLog',
  'driving_log',
  'fahrtenbuch',
  'tripLog',
  'notesForEmployee',
]);

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

function readSnapshotString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function parseVisitTimes(value: unknown): VisitTimesSummary | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  return {
    driveSeconds: typeof row.driveSeconds === 'number' ? row.driveSeconds : null,
    serviceSeconds: typeof row.serviceSeconds === 'number' ? row.serviceSeconds : null,
    pauseSeconds: typeof row.pauseSeconds === 'number' ? row.pauseSeconds : null,
    totalSeconds: typeof row.totalSeconds === 'number' ? row.totalSeconds : null,
    driveStartedAt: readSnapshotString(row, 'driveStartedAt'),
    arrivedAt: readSnapshotString(row, 'arrivedAt'),
    serviceStartedAt: readSnapshotString(row, 'serviceStartedAt'),
    serviceEndedAt: readSnapshotString(row, 'serviceEndedAt'),
    pauseStartedAt: readSnapshotString(row, 'pauseStartedAt'),
    activeTimer:
      row.activeTimer === 'drive' ||
      row.activeTimer === 'service' ||
      row.activeTimer === 'pause'
        ? row.activeTimer
        : null,
  };
}

function parseSignatureFromSnapshot(snapshot: Record<string, unknown>): {
  signerName: string;
  signedAt: string;
  signerRole: string | null;
} | null {
  const directName = readSnapshotString(snapshot, 'signerName');
  const directAt = readSnapshotString(snapshot, 'signedAt');
  if (directName && directAt) {
    return {
      signerName: directName,
      signedAt: directAt,
      signerRole: readSnapshotString(snapshot, 'signerRole'),
    };
  }

  const nested = snapshot.signature;
  if (nested && typeof nested === 'object') {
    const row = nested as Record<string, unknown>;
    const signerName = readSnapshotString(row, 'signerName');
    const signedAt = readSnapshotString(row, 'signedAt');
    if (signerName && signedAt) {
      return {
        signerName,
        signedAt,
        signerRole: readSnapshotString(row, 'signerRole'),
      };
    }
  }

  return null;
}

function mapEnrichmentTasks(
  tasks: VisitProofSnapshotEnrichment['tasks'],
): VisitProofTaskInput[] {
  if (!tasks?.length) return [];
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    statusLabel: task.statusLabel,
    note: task.note ?? null,
    reason: task.reason ?? null,
    completionNote: task.completionNote ?? null,
    notDoneReason: task.notDoneReason ?? null,
    isInternal: task.isInternal ?? null,
    isWorkflow: task.isWorkflow ?? null,
    category: task.category ?? null,
    type: task.type ?? null,
    moduleArea: task.moduleArea ?? null,
  }));
}

function resolveProofTasks(
  snapshot: Record<string, unknown>,
  enrichment: VisitProofSnapshotEnrichment,
): VisitProofTaskInput[] {
  if (enrichment.tasks?.length) {
    return mapEnrichmentTasks(enrichment.tasks);
  }
  return parseVisitProofTasksFromSnapshot(snapshot);
}

/** Build HTML payload for PDF — strips GPS-related snapshot keys. Layout v2. */
export function buildAssistProofPdfPayload(
  proof: AssistVisitProofRow,
  enrichment: VisitProofSnapshotEnrichment = {},
): AssistProofPdfPayload {
  const snapshot = { ...proof.payloadSnapshot };
  for (const key of Object.keys(snapshot)) {
    if (GPS_SNAPSHOT_KEYS.has(key)) delete snapshot[key];
  }

  const visitTimes = enrichment.visitTimes ?? parseVisitTimes(snapshot.visitTimes);
  const clientName = readSnapshotString(snapshot, 'clientName') ?? '—';
  const employeeName = enrichment.employeeName ?? readSnapshotString(snapshot, 'employeeName') ?? '—';
  const serviceName =
    enrichment.serviceName ??
    readSnapshotString(snapshot, 'serviceName') ??
    readSnapshotString(snapshot, 'title') ??
    'Leistungsnachweis';
  const location =
    enrichment.location ??
    readSnapshotString(snapshot, 'location') ??
    readSnapshotString(snapshot, 'locationAddress') ??
    '—';
  const documentation = resolveVisitProofDocumentationText(snapshot, enrichment.documentationNote);
  const signature = parseSignatureFromSnapshot(snapshot);
  const signerName = signature?.signerName ?? null;
  const signedAt = signature?.signedAt ?? null;
  const scheduledStart =
    enrichment.scheduledStart ??
    readSnapshotString(snapshot, 'scheduledStart') ??
    readSnapshotString(snapshot, 'plannedStartAt');
  const scheduledEnd =
    enrichment.scheduledEnd ??
    readSnapshotString(snapshot, 'scheduledEnd') ??
    readSnapshotString(snapshot, 'plannedEndAt');
  const signatureImageUrl = pickSignatureImageUrl(
    enrichment.signatureImageUrl,
    enrichment.signature?.dataUrl,
  );

  const tasks = resolveProofTasks(snapshot, enrichment);
  const tasksPresentation = buildVisitProofTasksPresentation(tasks);

  const proofNumber = proof.proofNumber?.trim() || proof.id.slice(0, 8).toUpperCase();
  const fileName = `Leistungsnachweis-${proofNumber}.pdf`;

  const branding = resolveVisitProofBranding(snapshot, {
    logoUrl: enrichment.tenantLogoUrl,
    tenantName: enrichment.tenantName,
    legalName: enrichment.tenantLegalName,
    addressLine: enrichment.tenantAddressLine,
    ikNumber: enrichment.tenantIkNumber,
    taxId: enrichment.tenantTaxId,
  });

  const signatureMetaLine = formatSignatureMetadataLine({
    signerName,
    signedAt,
    signatureType:
      signature?.signerRole ?? enrichment.signature?.signerRole ?? readSnapshotString(snapshot, 'signerRole'),
  });

  const signatureMetaHtml = signatureMetaLine
    ? `<p class="proof-signature-meta">${signatureMetaLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
    : '';

  const signatureDimensions = resolveSignatureImageDimensions(
    signatureImageUrl,
    enrichment.signatureImageWidth,
    enrichment.signatureImageHeight,
  );
  const signatureImageStyle = signatureProofImageStyleToCss(
    buildSignatureProofImageStyle(
      signatureDimensions?.width,
      signatureDimensions?.height,
    ),
  );

  const signatureImageHtml = signatureImageUrl
    ? `<img src="${signatureImageUrl.replace(/"/g, '&quot;')}" alt="Unterschrift" style="${signatureImageStyle}" />`
    : signerName || signedAt
      ? `<p style="margin:0;color:#6b7280;font-style:italic;font-size:12px;">Keine gezeichnete Unterschrift gespeichert.</p>`
      : '';

  const signatureEmptyMessage =
    !signatureImageUrl && !signerName && !signedAt ? 'Keine Signatur hinterlegt' : null;

  const plannedRange =
    scheduledStart && scheduledEnd
      ? `${formatDateTime(scheduledStart)} – ${formatDateTime(scheduledEnd)}`
      : scheduledStart
        ? formatDateTime(scheduledStart)
        : '—';

  const html = buildVisitProofLayoutHtml({
    title: `Leistungsnachweis — ${serviceName}`,
    branding,
    meta: {
      proofNumber,
      generatedAt: formatDateTime(proof.generatedAt),
      serviceDate: formatDateTime(scheduledStart),
      providerName: branding.legalName ?? branding.tenantName,
    },
    stammdaten: {
      clientName,
      employeeName,
      serviceName,
      location,
      costCarrier:
        enrichment.costCarrier ??
        readSnapshotString(snapshot, 'costCarrier') ??
        readSnapshotString(snapshot, 'payerName'),
    },
    times: {
      plannedRange,
      actualStart: formatDateTime(visitTimes?.serviceStartedAt ?? visitTimes?.arrivedAt),
      actualEnd: formatDateTime(visitTimes?.serviceEndedAt),
      serviceDuration: formatDuration(visitTimes?.serviceSeconds),
      driveDuration: formatDuration(visitTimes?.driveSeconds),
    },
    tasksPresentation,
    documentation,
    signature: {
      imageHtml: signatureImageHtml,
      metaHtml: signatureMetaHtml,
      emptyMessage: signatureEmptyMessage,
    },
  });

  return {
    proofId: proof.id,
    visitId: proof.visitId,
    title: serviceName,
    html,
    fileName,
    layoutVersion: 'v2',
  };
}

export function stripGpsKeysFromSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (!GPS_SNAPSHOT_KEYS.has(key)) clean[key] = value;
  }
  return clean;
}

export function stripPortalBlockedKeysFromSnapshot(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (!PORTAL_BLOCKED_SNAPSHOT_KEYS.has(key)) clean[key] = value;
  }
  return clean;
}
