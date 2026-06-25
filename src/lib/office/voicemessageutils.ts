/** Shared voice-message helpers — MIME selection, timeouts, user-facing errors. */

export const VOICE_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
] as const;

export const VOICE_RECORDING_MIN_BYTES = 1;
/** User-facing send must fail fast — not 60s spinner. */
export const VOICE_SEND_TIMEOUT_MS = 15_000;
export const VOICE_URL_RESOLVE_TIMEOUT_MS = 8_000;
export const VOICE_PLAYER_METADATA_TIMEOUT_MS = 6_000;
export const VOICE_SIGNED_URL_TIMEOUT_MS = 4_000;
export const VOICE_STORAGE_UPLOAD_TIMEOUT_MS = 10_000;
export const VOICE_STORAGE_DOWNLOAD_TIMEOUT_MS = 8_000;
export const VOICE_ATTACHMENT_INSERT_TIMEOUT_MS = 8_000;
export const VOICE_ATTACHMENT_LIST_TIMEOUT_MS = 8_000;

export function pickVoiceMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  for (const type of VOICE_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
}

export function extensionForVoiceMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('mp4') || lower.includes('m4a')) return 'm4a';
  if (lower.includes('mpeg') || lower.includes('mp3')) return 'mp3';
  if (lower.includes('wav')) return 'wav';
  return 'webm';
}

export function buildVoiceFileName(mimeType: string): string {
  return `sprachnachricht-${Date.now()}.${extensionForVoiceMime(mimeType)}`;
}

export function isBlobPlaybackUrl(url: string): boolean {
  return url.startsWith('blob:');
}

export function revokeBlobPlaybackUrl(url: string | null | undefined): void {
  if (!url || !isBlobPlaybackUrl(url)) return;
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

export async function withMessagingTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const TECHNICAL_PATTERNS =
  /supabase|jwt|rls|postgres|storage\.objects|signed-url|zeitüberschreitung|timeout|network|fetch failed|403|401|500|bucket|mime/i;

export function toUserFacingAttachmentError(_raw?: string | null): string {
  return 'Sprachnachricht konnte nicht geladen werden.';
}

export function toUserFacingSendError(_raw?: string | null): string {
  return 'Senden fehlgeschlagen. Bitte erneut versuchen.';
}

export function isTechnicalErrorText(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return TECHNICAL_PATTERNS.test(text);
}

export function createVoicePreviewUrl(fileData: Uint8Array, mimeType: string): string | null {
  if (typeof Blob === 'undefined' || typeof URL === 'undefined') return null;
  const blob = new Blob([fileData], { type: mimeType });
  return URL.createObjectURL(blob);
}
