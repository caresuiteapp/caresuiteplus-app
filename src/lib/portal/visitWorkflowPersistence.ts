import AsyncStorage from '@react-native-async-storage/async-storage';

export type VisitWorkflowUiState = {
  step?: string | null;
  awaitingSignature?: boolean;
  /** Signature was submitted and is awaiting authoritative server readback. */
  signatureConfirmationPending?: boolean;
  signatureModalOpen?: boolean;
  showNoShowForm?: boolean;
  scrollY?: number;
  documentationSubmitted?: boolean;
  signatureCaptured?: boolean;
  /** Uploaded internal media waiting to be attached to the documentation row. */
  attachmentReferences?: string[];
};

export type VisitWorkflowSnapshot = VisitWorkflowUiState & {
  visitId: string;
  route: string;
  updatedAt: number;
};

const STORAGE_PREFIX = 'portal-visit-workflow-';

function storageKey(visitId: string): string {
  return `${STORAGE_PREFIX}${visitId}`;
}

export function readVisitWorkflowSnapshot(visitId: string): VisitWorkflowSnapshot | null {
  if (typeof globalThis.sessionStorage === 'undefined') return null;
  try {
    const raw = globalThis.sessionStorage.getItem(storageKey(visitId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisitWorkflowSnapshot;
    if (!parsed || parsed.visitId !== visitId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeVisitWorkflowSnapshot(snapshot: VisitWorkflowSnapshot): void {
  if (typeof globalThis.sessionStorage === 'undefined') return;
  try {
    globalThis.sessionStorage.setItem(storageKey(snapshot.visitId), JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}

export async function readVisitWorkflowSnapshotAsync(
  visitId: string,
): Promise<VisitWorkflowSnapshot | null> {
  const webSnapshot = readVisitWorkflowSnapshot(visitId);
  if (webSnapshot) return webSnapshot;
  try {
    const raw = await AsyncStorage.getItem(storageKey(visitId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisitWorkflowSnapshot;
    if (!parsed || parsed.visitId !== visitId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeVisitWorkflowSnapshotAsync(
  snapshot: VisitWorkflowSnapshot,
): Promise<void> {
  writeVisitWorkflowSnapshot(snapshot);
  try {
    await AsyncStorage.setItem(storageKey(snapshot.visitId), JSON.stringify(snapshot));
  } catch {
    /* device storage unavailable; authoritative workflow data remains server-backed */
  }
}

export function clearVisitWorkflowSnapshot(visitId: string): void {
  if (typeof globalThis.sessionStorage === 'undefined') return;
  try {
    globalThis.sessionStorage.removeItem(storageKey(visitId));
  } catch {
    /* ignore */
  }
}

export async function clearVisitWorkflowSnapshotAsync(visitId: string): Promise<void> {
  clearVisitWorkflowSnapshot(visitId);
  try {
    await AsyncStorage.removeItem(storageKey(visitId));
  } catch {
    /* ignore unavailable device storage */
  }
}

export function mergeVisitWorkflowSnapshot(
  visitId: string,
  route: string,
  partial: VisitWorkflowUiState,
): VisitWorkflowSnapshot {
  const existing = readVisitWorkflowSnapshot(visitId);
  const merged: VisitWorkflowSnapshot = {
    visitId,
    route,
    updatedAt: Date.now(),
    ...existing,
    ...partial,
  };
  if ('signatureModalOpen' in partial) {
    merged.signatureModalOpen = partial.signatureModalOpen ?? false;
  } else {
    merged.signatureModalOpen = false;
  }
  return merged;
}

export function mergeVisitWorkflowSnapshotWithExisting(
  existing: VisitWorkflowSnapshot | null,
  visitId: string,
  route: string,
  partial: VisitWorkflowUiState,
): VisitWorkflowSnapshot {
  const merged: VisitWorkflowSnapshot = {
    visitId,
    route,
    updatedAt: Date.now(),
    ...(existing?.visitId === visitId ? existing : null),
    ...partial,
  };
  if ('signatureModalOpen' in partial) {
    merged.signatureModalOpen = partial.signatureModalOpen ?? false;
  } else {
    merged.signatureModalOpen = false;
  }
  return merged;
}
