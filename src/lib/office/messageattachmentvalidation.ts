/** Allowed MIME types — aligned with migration 0091 storage bucket policy. */
export const MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

export const MESSAGE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export type PendingMessageAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileData: Uint8Array;
};

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
  if (input.fileSizeBytes > MESSAGE_ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: 'Anhang darf maximal 10 MB groß sein.' };
  }
  const mime = input.mimeType.toLowerCase();
  const allowed = MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES.some(
    (type) => type === mime || (type.endsWith('/*') && mime.startsWith(type.replace('/*', ''))),
  );
  if (!allowed) {
    return {
      ok: false,
      error: 'Dateityp nicht erlaubt. Erlaubt: Bilder, PDF, Word, Text.',
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
