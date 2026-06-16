import { getServiceMode } from '@/lib/services/mode';
import { isBillingCycleLiveReady } from './billingCycleStore';

export type BillingCycleGuardDecision = { allowed: true } | { allowed: false; reason: string };

export function assertBillingCycleProductionReady(): BillingCycleGuardDecision {
  if (getServiceMode() === 'supabase' && !isBillingCycleLiveReady()) {
    return {
      allowed: false,
      reason: 'Monatsabschluss im Live-Modus noch nicht angebunden — Migration 0054 erforderlich.',
    };
  }
  return { allowed: true };
}

export function assertNoDemoFallbackInProduction(usesDemoFallback: boolean): BillingCycleGuardDecision {
  if (getServiceMode() === 'supabase' && usesDemoFallback) {
    return { allowed: false, reason: 'Demo-Fallback im Production Mode blockiert.' };
  }
  return { allowed: true };
}

export function assertSameTenant(
  tenantId: string,
  entityTenantId: string,
  context: string,
): BillingCycleGuardDecision {
  if (tenantId !== entityTenantId) {
    return { allowed: false, reason: `${context} — mandantenübergreifender Zugriff blockiert.` };
  }
  return { allowed: true };
}
