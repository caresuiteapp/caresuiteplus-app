import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  listActivityTypes,
  listCostCenters,
  listOrganizations,
  listProjects,
  nextTimeTrackingId,
  saveActivityType,
  saveCostCenter,
  saveOrganization,
  saveProject,
} from './timeTrackingStore';

const DEMO_SEEDED = new Set<string>();

/** Neutral demo catalog — only for demo tenant, not global defaults. */
export function seedDemoTimeTrackingCatalog(tenantId: string): void {
  if (tenantId !== DEMO_TENANT_ID) return;
  if (DEMO_SEEDED.has(tenantId)) return;
  if (listActivityTypes(tenantId).length > 0) {
    DEMO_SEEDED.add(tenantId);
    return;
  }

  const orgId = nextTimeTrackingId('org');
  saveOrganization({
    id: orgId,
    tenantId,
    code: 'ZENTRALE',
    name: 'Zentrale Verwaltung',
    isActive: true,
    sortOrder: 0,
  });

  saveOrganization({
    id: nextTimeTrackingId('org'),
    tenantId,
    code: 'PFLEGE',
    name: 'Pflegedienst',
    isActive: true,
    sortOrder: 1,
  });

  const ccId = nextTimeTrackingId('cc');
  saveCostCenter({
    id: ccId,
    tenantId,
    organizationId: orgId,
    code: 'ADM-100',
    name: 'Administration',
    isActive: true,
    sortOrder: 0,
  });

  saveCostCenter({
    id: nextTimeTrackingId('cc'),
    tenantId,
    organizationId: orgId,
    code: 'PLAN-200',
    name: 'Einsatzplanung',
    isActive: true,
    sortOrder: 1,
  });

  saveProject({
    id: nextTimeTrackingId('prj'),
    tenantId,
    costCenterId: ccId,
    code: 'HO-2026',
    name: 'Homeoffice-Koordination',
    isActive: true,
    sortOrder: 0,
  });

  const activities: Array<{ code: string; name: string; category: 'office' | 'care_planning' | 'administration' | 'training' | 'other' }> = [
    { code: 'TELE', name: 'Telefonate & Abstimmung', category: 'office' },
    { code: 'PLAN', name: 'Einsatzplanung', category: 'care_planning' },
    { code: 'DOCS', name: 'Dokumentation', category: 'administration' },
    { code: 'TRAIN', name: 'Fortbildung', category: 'training' },
    { code: 'IT', name: 'IT & Systeme', category: 'other' },
  ];

  activities.forEach((a, index) => {
    saveActivityType({
      id: nextTimeTrackingId('at'),
      tenantId,
      code: a.code,
      name: a.name,
      category: a.category,
      isActive: true,
      sortOrder: index,
    });
  });

  DEMO_SEEDED.add(tenantId);
}

export function resetDemoTimeTrackingSeedFlag(): void {
  DEMO_SEEDED.clear();
}
