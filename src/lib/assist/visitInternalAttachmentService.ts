import { ASSIST_EXECUTION_STORAGE_BUCKET } from '@/lib/assist/assistStoragePaths';
import {
  isImageMimeType,
  isPdfMimeType,
} from '@/lib/office/messageattachmentvalidation';
import { getSupabaseClient } from '@/lib/supabase/client';

const SIGNED_URL_TTL_SECONDS = 3600;

export type VisitInternalAttachment = {
  storagePath: string;
  fileName: string;
  mimeType: string;
};

export function inferMimeTypeFromFileName(fileName: string): string {
  const ext = fileName.includes('.') ? (fileName.split('.').pop()?.toLowerCase() ?? '') : '';
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt':
      return 'text/plain';
    case 'webm':
      return 'audio/webm';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
}

export function fileNameFromStoragePath(storagePath: string): string {
  const trimmed = storagePath.trim();
  if (!trimmed) return 'Anhang';
  return trimmed.split('/').pop() ?? 'Anhang';
}

export function parseVisitInternalAttachments(storagePaths: string[] | null | undefined): VisitInternalAttachment[] {
  if (!storagePaths?.length) return [];

  return storagePaths
    .map((storagePath) => storagePath.trim())
    .filter((storagePath) => storagePath.length > 0)
    .map((storagePath) => {
      const fileName = fileNameFromStoragePath(storagePath);
      return {
        storagePath,
        fileName,
        mimeType: inferMimeTypeFromFileName(fileName),
      };
    });
}

export function normalizePhotoReferenceList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Create a short-lived signed URL for an internal visit attachment in Storage. */
export async function resolveVisitInternalAttachmentUrl(
  storagePath: string | null | undefined,
): Promise<string | null> {
  const path = storagePath?.trim();
  if (!path) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(ASSIST_EXECUTION_STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function visitInternalAttachmentIcon(mimeType: string): string {
  if (isImageMimeType(mimeType)) return '🖼️';
  if (isPdfMimeType(mimeType)) return '📄';
  return '📎';
}

export function visitInternalAttachmentPreviewMode(
  mimeType: string,
): 'image' | 'pdf' | 'download' {
  if (isImageMimeType(mimeType)) return 'image';
  if (isPdfMimeType(mimeType)) return 'pdf';
  return 'download';
}
