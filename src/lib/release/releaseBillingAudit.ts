import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP536 — Abrechnung & Audit (release) */
export function getReleaseBillingAudit() {
  return createBillingAuditTrail(536, 'release', [
    { id: 'ba-r1', label: 'Store-Gebühr iOS', amountCents: 9900, recordedAt: '2026-06-01T00:00:00.000Z' },
  ]);
}
