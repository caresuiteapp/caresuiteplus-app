import { DEMO_TENANT_ID } from '../tenant';

export type DomainDemoRecord = {
  id: string;
  tenantId: string;
  label: string;
  status: string;
};

export type DomainDemoSnapshot = {
  wpNumber: number;
  domain: string;
  records: DomainDemoRecord[];
  seededAt: string;
};

export function createDomainDemo(
  wpNumber: number,
  domain: string,
  records: Omit<DomainDemoRecord, 'tenantId'>[],
): DomainDemoSnapshot {
  return {
    wpNumber,
    domain,
    records: records.map((r) => ({ ...r, tenantId: DEMO_TENANT_ID })),
    seededAt: '2026-06-01T08:00:00.000Z',
  };
}
