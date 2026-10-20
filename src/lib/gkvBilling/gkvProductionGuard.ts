import { buildWorkspaceAccessContext } from '@/lib/permissions/workspaceAccess';

export type GkvProductionGuardDecision = { allowed: true } | { allowed: false; reason: string };

export function assertGkvProductionNoDemoFallback(usesDemoFallback: boolean): GkvProductionGuardDecision {
  const ctx = buildWorkspaceAccessContext({ usesDemoFallback, environment: 'production' });
  if (ctx.environment === 'production' && usesDemoFallback) {
    return { allowed: false, reason: 'Demo-Fallback im Production Mode blockiert.' };
  }
  return { allowed: true };
}

/** IK-Formatprüfung (9 Ziffern) — keine echte Kostenträger-Verifikation ohne Provider. */
export function isValidIkFormat(ikNumber: string | null | undefined): boolean {
  if (!ikNumber?.trim()) return false;
  return /^\d{9}$/.test(ikNumber.trim());
}

export function assertDtaNotProductionBillable(dtaValidated: boolean): GkvProductionGuardDecision {
  if (!dtaValidated) {
    return {
      allowed: false,
      reason: 'DTA-Datei ist nicht validiert — kein produktiver Versand.',
    };
  }
  return { allowed: true };
}

export function assertSubmissionNotEnabled(): GkvProductionGuardDecision {
  return {
    allowed: false,
    reason: 'Produktive Einreichung ist derzeit nicht freigeschaltet.',
  };
}
