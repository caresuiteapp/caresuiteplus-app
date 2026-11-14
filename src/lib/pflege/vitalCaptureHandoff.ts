type CaptureScope = Readonly<{ tenantId: string; profileId: string; roleKey: string }>;
type CaptureHint = CaptureScope & Readonly<{ clientId: string; createdAt: number }>;

const maximumAgeMs = 60_000;
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
let pending: CaptureHint | null = null;

/**
 * A short-lived presentation hint, scoped to the account in this app instance.
 * It never enters the URL, device storage, a network request or an access proof.
 * The create screen must find the person again in its own verified selection
 * and wait for a separate explicit choice before changing the draft.
 */
export function stageVitalCaptureClient(scope: CaptureScope, clientId: string): void {
  pending = uuid.test(scope.tenantId) && uuid.test(scope.profileId) && scope.roleKey && uuid.test(clientId)
    ? { ...scope, clientId, createdAt: Date.now() }
    : null;
}

export function takeVitalCaptureClient(scope: CaptureScope): string | null {
  const hint = pending;
  pending = null;
  if (!hint || hint.tenantId !== scope.tenantId || hint.profileId !== scope.profileId ||
    hint.roleKey !== scope.roleKey) return null;
  const age = Date.now() - hint.createdAt;
  return age >= 0 && age < maximumAgeMs ? hint.clientId : null;
}
