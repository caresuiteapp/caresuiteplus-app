import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import type { VisitTimesSummary } from '@/features/assistWorkflow/calculateVisitTimes';
import type { VisitProofSnapshotEnrichment } from '@/lib/assist/visitProofSnapshotPreviewService';
import {
  formatSignatureMetadataLine,
  pickSignatureImageUrl,
} from '@/lib/assist/visitSignatureImageService';

export type AssistProofPdfPayload = {
  proofId: string;
  visitId: string;
  title: string;
  html: string;
  fileName: string;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  };
}

function parseSignatureFromSnapshot(snapshot: Record<string, unknown>): {
  signerName: string;
  signedAt: string;
} | null {
  const directName = readSnapshotString(snapshot, 'signerName');
  const directAt = readSnapshotString(snapshot, 'signedAt');
  if (directName && directAt) return { signerName: directName, signedAt: directAt };

  const nested = snapshot.signature;
  if (nested && typeof nested === 'object') {
    const row = nested as Record<string, unknown>;
    const signerName = readSnapshotString(row, 'signerName');
    const signedAt = readSnapshotString(row, 'signedAt');
    if (signerName && signedAt) return { signerName, signedAt };
  }

  return null;
}

function parseTasksFromSnapshot(snapshot: Record<string, unknown>): Array<{ title: string; statusLabel: string }> {
  const raw = snapshot.tasks;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const title = readSnapshotString(row, 'title');
      if (!title) return null;
      const status = readSnapshotString(row, 'status') ?? '—';
      return { title, statusLabel: status };
    })
    .filter((item): item is { title: string; statusLabel: string } => item != null);
}

function buildTasksHtml(
  tasks: Array<{ title: string; statusLabel: string }>,
  tasksSummary: string | null,
): string {
  if (tasks.length > 0) {
    const rows = tasks
      .map(
        (task) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(task.title)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(task.statusLabel)}</td></tr>`,
      )
      .join('');
    return `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
      <thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Aufgabe</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc;">Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  if (tasksSummary) {
    return `<p style="margin:8px 0 0;font-size:13px;">${escapeHtml(tasksSummary)}</p>`;
  }

  return '<p style="margin:8px 0 0;font-size:13px;color:#666;">Keine Aufgaben hinterlegt</p>';
}

/** Build HTML payload for PDF — strips GPS-related snapshot keys. */
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
  const documentation =
    enrichment.documentationNote ??
    readSnapshotString(snapshot, 'documentationNote') ??
    readSnapshotString(snapshot, 'documentation') ??
    '—';
  const tasksSummary = readSnapshotString(snapshot, 'tasksSummary');
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

  const tasks = enrichment.tasks?.length
    ? enrichment.tasks.map((task) => ({
        title: task.title,
        statusLabel: task.statusLabel ?? task.status ?? '—',
      }))
    : parseTasksFromSnapshot(snapshot);

  const proofNumber = proof.proofNumber?.trim() || proof.id.slice(0, 8).toUpperCase();
  const fileName = `Leistungsnachweis-${proofNumber}.pdf`;

  const signatureMetaLine = formatSignatureMetadataLine({
    signerName,
    signedAt,
    signatureType: readSnapshotString(snapshot, 'signerRole') ?? enrichment.signature?.signerRole ?? null,
  });

  const signatureMetaHtml = signatureMetaLine
    ? `<p style="margin:4px 0 0;font-size:13px;color:#555;">${escapeHtml(signatureMetaLine)}</p>`
    : '';

  const signatureBlock = signatureImageUrl
    ? `<img src="${escapeHtml(signatureImageUrl)}" alt="Unterschrift" style="max-width:280px;max-height:120px;margin-top:8px;object-fit:contain;" />${signatureMetaHtml}`
    : signerName || signedAt
      ? `<p style="margin:8px 0 0;color:#666;font-style:italic;">Keine gezeichnete Unterschrift gespeichert.</p>${signatureMetaHtml}`
      : '<p style="margin:8px 0 0;color:#666;">—</p>';

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <title>Leistungsnachweis — ${escapeHtml(serviceName)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #1a1a1a; margin: 0; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    h2 { font-size: 15px; margin: 20px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 160px 1fr; gap: 6px 12px; font-size: 14px; }
    .label { font-weight: 600; }
    .doc { white-space: pre-wrap; background: #f9f9f9; padding: 10px; border-radius: 4px; font-size: 13px; }
    .footer { margin-top: 24px; font-size: 11px; color: #777; }
  </style>
</head>
<body>
  <h1>Leistungsnachweis</h1>
  <p class="meta">Nachweis-Nr. ${escapeHtml(proofNumber)} · erstellt ${escapeHtml(formatDateTime(proof.generatedAt))}</p>

  <h2>Stammdaten</h2>
  <div class="grid">
    <span class="label">Klient:in</span><span>${escapeHtml(clientName)}</span>
    <span class="label">Mitarbeitende:r</span><span>${escapeHtml(employeeName)}</span>
    <span class="label">Leistung</span><span>${escapeHtml(serviceName)}</span>
    <span class="label">Termin</span><span>${escapeHtml(formatDateTime(scheduledStart))} – ${escapeHtml(formatDateTime(scheduledEnd))}</span>
    <span class="label">Ort</span><span>${escapeHtml(location)}</span>
  </div>

  <h2>Zeiten</h2>
  <div class="grid">
    <span class="label">Anfahrt</span><span>${escapeHtml(formatDuration(visitTimes?.driveSeconds))}</span>
    <span class="label">Einsatz</span><span>${escapeHtml(formatDuration(visitTimes?.serviceSeconds))}</span>
    <span class="label">Angekommen</span><span>${escapeHtml(formatDateTime(visitTimes?.arrivedAt))}</span>
    <span class="label">Einsatz gestartet</span><span>${escapeHtml(formatDateTime(visitTimes?.serviceStartedAt))}</span>
    <span class="label">Einsatz beendet</span><span>${escapeHtml(formatDateTime(visitTimes?.serviceEndedAt))}</span>
  </div>

  <h2>Aufgaben</h2>
  ${buildTasksHtml(tasks, tasksSummary)}

  <h2>Dokumentation</h2>
  <div class="doc">${escapeHtml(documentation)}</div>

  <h2>Unterschrift Klient:in</h2>
  ${signatureBlock}

  <p class="footer">CareSuite+ Assist · ohne GPS-Trackingdaten</p>
</body>
</html>`;

  return {
    proofId: proof.id,
    visitId: proof.visitId,
    title: serviceName,
    html,
    fileName,
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
