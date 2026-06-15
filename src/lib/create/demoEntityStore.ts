import type { DomainDemoRecord } from '@/data/demo/domains/domainDemoFactory';

const stores = new Map<string, DomainDemoRecord[]>();

export function getDemoEntityStore(domain: string): DomainDemoRecord[] {
  if (!stores.has(domain)) stores.set(domain, []);
  return stores.get(domain)!;
}

export function appendDemoEntity(
  domain: string,
  record: Omit<DomainDemoRecord, 'tenantId'> & { tenantId: string },
): DomainDemoRecord {
  const list = getDemoEntityStore(domain);
  list.push(record);
  return record;
}
