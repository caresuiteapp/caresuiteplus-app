/** Allowed MIME types — aligned with migration 0091 storage bucket policy. */
export const MESSAGE_ATTACHMENT_AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
] as const;

export const MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/mpeg',
  'video/3gpp',
  ...MESSAGE_ATTACHMENT_AUDIO_MIME_TYPES,
] as const;

export const MESSAGE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const MESSAGE_VIDEO_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

export type PendingMessageAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileData: Uint8Array;
};

export function normalizeAttachmentMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(';')[0]?.trim() ?? '';
}

export function validateMessageAttachment(input: {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}): { ok: true } | { ok: false; error: string } {
  if (!input.fileName.trim()) {
    return { ok: false, error: 'Dateiname fehlt.' };
  }
  if (input.fileSizeBytes <= 0) {
    return { ok: false, error: 'Datei ist leer.' };
  }
  const mime = normalizeAttachmentMimeType(input.mimeType);
  const maxBytes = mime.startsWith('video/')
    ? MESSAGE_VIDEO_ATTACHMENT_MAX_BYTES
    : MESSAGE_ATTACHMENT_MAX_BYTES;
  if (input.fileSizeBytes > maxBytes) {
    return {
      ok: false,
      error: `Anhang darf maximal ${Math.round(maxBytes / 1024 / 1024)} MB groß sein.`,
    };
  }
  const allowed = MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES.some(
    (type) => mime === type || (type.endsWith('/*') && mime.startsWith(type.replace('/*', ''))),
  );
  if (!allowed) {
    return {
      ok: false,
      error: 'Dateityp nicht erlaubt. Erlaubt: Bilder, Videos, PDF, Word, Text und Sprachnachrichten.',
    };
  }
  return { ok: true };
}

export function isImageMimeType(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType?.toLowerCase().startsWith('image/'));
}

export function isPdfMimeType(mimeType: string | null | undefined): boolean {
  return mimeType?.toLowerCase() === 'application/pdf';
}

export function isAudioMimeType(mimeType: string | null | undefined): boolean {
  const mime = normalizeAttachmentMimeType(mimeType ?? '');
  return MESSAGE_ATTACHMENT_AUDIO_MIME_TYPES.some((type) => mime === type);
}

export function isVideoMimeType(mimeType: string | null | undefined): boolean {
  return normalizeAttachmentMimeType(mimeType ?? '').startsWith('video/');
}
