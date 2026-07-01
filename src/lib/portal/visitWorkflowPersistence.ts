export type VisitWorkflowUiState = {
  step?: string | null;
  awaitingSignature?: boolean;
  signatureModalOpen?: boolean;
  showNoShowForm?: boolean;
  scrollY?: number;
  documentationSubmitted?: boolean;
  signatureCaptured?: boolean;
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

export function clearVisitWorkflowSnapshot(visitId: string): void {
  if (typeof globalThis.sessionStorage === 'undefined') return;
  try {
    globalThis.sessionStorage.removeItem(storageKey(visitId));
  } catch {
    /* ignore */
  }
}

export function mergeVisitWorkflowSnapshot(
  visitId: string,
  route: string,
  partial: VisitWorkflowUiState,
): VisitWorkflowSnapshot {
  const existing = readVisitWorkflowSnapshot(visitId);
  return {
    visitId,
    route,
    updatedAt: Date.now(),
    ...existing,
    ...partial,
  };
}
