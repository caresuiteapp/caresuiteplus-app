export type BillingAuditEntry = {
  id: string;
  label: string;
  amountCents: number | null;
  recordedAt: string;
};

export function createBillingAuditTrail(
  wpNumber: number,
  domain: string,
  entries: BillingAuditEntry[] = [],
): { wpNumber: number; domain: string; entries: BillingAuditEntry[] } {
  return { wpNumber, domain, entries };
}
