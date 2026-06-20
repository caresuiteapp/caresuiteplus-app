import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';

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

function readSnapshotString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

/** Build HTML payload for PDF — strips GPS-related snapshot keys. */
export function buildAssistProofPdfPayload(proof: AssistVisitProofRow): AssistProofPdfPayload {
  const snapshot = { ...proof.payloadSnapshot };
  for (const key of Object.keys(snapshot)) {
    if (GPS_SNAPSHOT_KEYS.has(key)) delete snapshot[key];
  }

  const clientName = readSnapshotString(snapshot, 'clientName') ?? '—';
  const employeeName = readSnapshotString(snapshot, 'employeeName') ?? '—';
  const serviceName =
    readSnapshotString(snapshot, 'serviceName') ??
    readSnapshotString(snapshot, 'title') ??
    'Leistungsnachweis';
  const location = readSnapshotString(snapshot, 'location') ?? '—';
  const documentation =
    readSnapshotString(snapshot, 'documentationNote') ??
    readSnapshotString(snapshot, 'documentation') ??
    '—';
  const tasksSummary = readSnapshotString(snapshot, 'tasksSummary') ?? '—';
  const signerName = readSnapshotString(snapshot, 'signerName');
  const signedAt = readSnapshotString(snapshot, 'signedAt');
  const scheduledStart = readSnapshotString(snapshot, 'scheduledStart');
  const scheduledEnd = readSnapshotString(snapshot, 'scheduledEnd');

  const proofNumber = proof.proofNumber?.trim() || proof.id.slice(0, 8).toUpperCase();
  const fileName = `Leistungsnachweis-${proofNumber}.pdf`;

  const html = `
    <article>
      <h1 style="font-size:22px;margin:0 0 8px;">Leistungsnachweis</h1>
      <p style="color:#555;margin:0 0 16px;">Nachweis-Nr. ${escapeHtml(proofNumber)} · erstellt ${escapeHtml(formatDateTime(proof.generatedAt))}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;font-weight:600;width:180px;">Klient:in</td><td>${escapeHtml(clientName)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600;">Mitarbeitende:r</td><td>${escapeHtml(employeeName)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600;">Leistung</td><td>${escapeHtml(serviceName)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600;">Termin</td><td>${escapeHtml(formatDateTime(scheduledStart))} – ${escapeHtml(formatDateTime(scheduledEnd))}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600;">Ort</td><td>${escapeHtml(location)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600;">Dokumentation</td><td>${escapeHtml(documentation)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600;">Aufgaben</td><td>${escapeHtml(tasksSummary)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:600;">Unterschrift</td><td>${escapeHtml(signerName ? `${signerName} · ${formatDateTime(signedAt)}` : '—')}</td></tr>
      </table>
      <p style="margin-top:24px;font-size:11px;color:#777;">CareSuite+ Assist · ohne GPS-Trackingdaten</p>
    </article>
  `;

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
