/** Mandanten-isolierter Storage-Pfad-Präfix — muss mit Supabase storage.objects Policies übereinstimmen. */
export const TENANT_STORAGE_PREFIX = 'tenant';

/** Baut einen tenant-isolierten Objektpfad: `tenant/{tenantId}/seg1/seg2/…` */
export function buildTenantStoragePath(tenantId: string, ...segments: string[]): string {
  return [TENANT_STORAGE_PREFIX, tenantId, ...segments.filter(Boolean)].join('/');
}

/** ASCII file extension from original name (Supabase-safe segment). */
export function extractStorageFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) return 'bin';
  const ext = trimmed.slice(dot + 1).toLowerCase();
  if (/^[a-z0-9]{1,10}$/.test(ext)) return ext;
  return 'bin';
}

/**
 * Supabase-safe object file name: `{documentId}.{ext}`.
 * Original display name stays in DB `file_name` / `title` only.
 */
export function buildStorageObjectFileName(documentId: string, originalFileName: string): string {
  return `${documentId}.${extractStorageFileExtension(originalFileName)}`;
}

export function toStorageUploadError(raw: string | undefined): string {
  const msg = raw?.trim() ?? '';
  if (/invalid key/i.test(msg)) {
    return 'Die Datei konnte nicht gespeichert werden (ungültiger Dateiname). Bitte erneut versuchen.';
  }
  return msg || 'Datei-Upload fehlgeschlagen. Bitte erneut versuchen.';
}
