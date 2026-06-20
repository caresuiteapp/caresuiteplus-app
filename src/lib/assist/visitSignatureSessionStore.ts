/**
 * Session-only visit signature capture — Migration 0156 prepared, not yet applied.
 * Persist via assistVisitSignaturePersistenceService after remote apply + Storage upload.
 * Data is lost on reload until 0156 is live; UI shows setup hint for prod persistence.
 */

export type VisitSignatureCapture = {
  visitId: string;
  dataUrl: string;
  signerName: string;
  signerRole: string;
  signedAt: string;
};

const sessionStore = new Map<string, VisitSignatureCapture>();

const STORAGE_KEY = 'assist_visit_signatures_session';

function readWebStorage(): Record<string, VisitSignatureCapture> {
  if (typeof globalThis.sessionStorage === 'undefined') return {};
  try {
    const raw = globalThis.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, VisitSignatureCapture>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeWebStorage(entries: Record<string, VisitSignatureCapture>): void {
  if (typeof globalThis.sessionStorage === 'undefined') return;
  try {
    globalThis.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode — in-memory only */
  }
}

function hydrateFromWeb(): void {
  const entries = readWebStorage();
  for (const [visitId, capture] of Object.entries(entries)) {
    sessionStore.set(visitId, capture);
  }
}

hydrateFromWeb();

export function getVisitSignature(visitId: string): VisitSignatureCapture | null {
  return sessionStore.get(visitId) ?? null;
}

export function saveVisitSignature(capture: VisitSignatureCapture): void {
  sessionStore.set(capture.visitId, capture);
  const entries = Object.fromEntries(sessionStore.entries());
  writeWebStorage(entries);
}

export function clearVisitSignature(visitId: string): void {
  sessionStore.delete(visitId);
  const entries = Object.fromEntries(sessionStore.entries());
  writeWebStorage(entries);
}

export function hasVisitSignature(visitId: string): boolean {
  return sessionStore.has(visitId);
}
