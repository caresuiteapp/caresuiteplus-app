export type EmployeePortalMediaKind = 'image' | 'video' | 'document';

export type EmployeePortalPickedMedia = {
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  kind: EmployeePortalMediaKind;
};

export type EmployeePortalMediaValidationMode = 'visit' | 'portal-upload' | 'message';

export const EMPLOYEE_PORTAL_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const EMPLOYEE_PORTAL_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const EMPLOYEE_PORTAL_DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  '3gp': 'video/3gpp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/mpeg': 'mpeg',
  'video/3gpp': '3gp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
};

export const EMPLOYEE_PORTAL_ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
]);

export const EMPLOYEE_PORTAL_ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/mpeg',
  'video/3gpp',
]);

export const EMPLOYEE_PORTAL_ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

function normalizedReportedMimeType(value: string | null | undefined): string {
  const normalized = value?.toLowerCase().split(';')[0]?.trim() ?? '';
  if (normalized === 'image/jpg') return 'image/jpeg';
  if (normalized === 'application/x-pdf') return 'application/pdf';
  return normalized;
}

function extensionFromFileName(fileName: string | null | undefined): string {
  const name = fileName?.trim() ?? '';
  if (!name.includes('.')) return '';
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function inferEmployeePortalMimeType(input: {
  fileName?: string | null;
  reportedMimeType?: string | null;
  reportedKind?: 'image' | 'video' | 'livePhoto' | 'pairedVideo' | null;
}): string {
  const reported = normalizedReportedMimeType(input.reportedMimeType);
  if (reported && reported !== 'application/octet-stream') return reported;

  const fromExtension = EXTENSION_MIME_TYPES[extensionFromFileName(input.fileName)];
  if (fromExtension) return fromExtension;

  if (input.reportedKind === 'video' || input.reportedKind === 'pairedVideo') return 'video/mp4';
  if (input.reportedKind === 'image' || input.reportedKind === 'livePhoto') return 'image/jpeg';
  return 'application/octet-stream';
}

export function resolveEmployeePortalMediaKind(mimeType: string): EmployeePortalMediaKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

export function ensureEmployeePortalMediaFileName(input: {
  fileName?: string | null;
  mimeType: string;
  prefix?: string;
}): string {
  const existing = input.fileName?.trim();
  if (existing) return existing;
  const extension = MIME_EXTENSIONS[input.mimeType] ?? 'bin';
  return `${input.prefix ?? 'medium'}-${Date.now()}.${extension}`;
}

export function normalizeEmployeePortalPickedMedia(input: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  reportedKind?: 'image' | 'video' | 'livePhoto' | 'pairedVideo' | null;
  prefix?: string;
}): EmployeePortalPickedMedia {
  const mimeType = inferEmployeePortalMimeType({
    fileName: input.fileName,
    reportedMimeType: input.mimeType,
    reportedKind: input.reportedKind,
  });
  return {
    uri: input.uri,
    fileName: ensureEmployeePortalMediaFileName({
      fileName: input.fileName,
      mimeType,
      prefix: input.prefix,
    }),
    mimeType,
    sizeBytes: input.sizeBytes && input.sizeBytes > 0 ? input.sizeBytes : null,
    kind: resolveEmployeePortalMediaKind(mimeType),
  };
}

function maxBytesForMedia(media: EmployeePortalPickedMedia, mode: EmployeePortalMediaValidationMode): number {
  if (media.kind === 'video') return EMPLOYEE_PORTAL_VIDEO_MAX_BYTES;
  if (media.kind === 'image') return EMPLOYEE_PORTAL_IMAGE_MAX_BYTES;
  return mode === 'visit' ? EMPLOYEE_PORTAL_IMAGE_MAX_BYTES : EMPLOYEE_PORTAL_DOCUMENT_MAX_BYTES;
}

function formatLimit(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export function validateEmployeePortalPickedMedia(
  media: EmployeePortalPickedMedia,
  mode: EmployeePortalMediaValidationMode,
): { ok: true } | { ok: false; error: string } {
  if (!media.uri.trim()) return { ok: false, error: 'Die ausgewählte Datei konnte nicht gelesen werden.' };

  const allowed =
    EMPLOYEE_PORTAL_ALLOWED_IMAGE_MIME_TYPES.has(media.mimeType) ||
    EMPLOYEE_PORTAL_ALLOWED_VIDEO_MIME_TYPES.has(media.mimeType) ||
    EMPLOYEE_PORTAL_ALLOWED_DOCUMENT_MIME_TYPES.has(media.mimeType);
  if (!allowed) {
    return {
      ok: false,
      error: 'Dateityp nicht unterstützt. Erlaubt sind Fotos, Videos, PDF, Word und Textdateien.',
    };
  }

  if (mode === 'visit' && media.kind === 'document' && media.mimeType !== 'application/pdf') {
    return { ok: false, error: 'Am Einsatz sind Fotos, Videos und PDF-Dokumente erlaubt.' };
  }

  const maxBytes = maxBytesForMedia(media, mode);
  if (media.sizeBytes && media.sizeBytes > maxBytes) {
    return {
      ok: false,
      error: `${media.kind === 'video' ? 'Das Video' : 'Die Datei'} ist größer als ${formatLimit(maxBytes)}. Bitte kürzen oder verkleinern.`,
    };
  }

  return { ok: true };
}

export function formatEmployeePortalMediaSize(sizeBytes: number | null): string {
  if (!sizeBytes) return 'Größe unbekannt';
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
