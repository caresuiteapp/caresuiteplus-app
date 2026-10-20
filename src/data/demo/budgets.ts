import type { ClientBudget } from '@/types/modules/billing';
import { DEMO_TENANT_ID } from './tenant';

const BASE = '2026-06-01T08:00:00.000Z';

export const demoBudgets: Pick<
  ClientBudget,
  | 'id'
  | 'tenantId'
  | 'clientId'
  | 'label'
  | 'period'
  | 'allocatedCents'
  | 'usedCents'
  | 'currency'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
>[] = [
  {
    id: 'budget-001',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-001',
    label: 'Entlastungsleistung Juni',
    period: 'monthly',
    allocatedCents: 125_000,
    usedCents: 78_500,
    currency: 'EUR',
    status: 'aktiv',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: BASE,
  },
  {
    id: 'budget-002',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-002',
    label: 'Verhinderungspflege Q2',
    period: 'quarterly',
    allocatedCents: 450_000,
    usedCents: 210_000,
    currency: 'EUR',
    status: 'in_bearbeitung',
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: BASE,
  },
  {
    id: 'budget-003',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-005',
    label: 'Sachleistung Pflege',
    period: 'monthly',
    allocatedCents: 890_000,
    usedCents: 890_000,
    currency: 'EUR',
    status: 'abgeschlossen',
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: BASE,
  },
  {
    id: 'budget-004',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-009',
    label: 'Jahresbudget Betreuung',
    period: 'yearly',
    allocatedCents: 1_200_000,
    usedCents: 450_000,
    currency: 'EUR',
    status: 'entwurf',
    createdAt: BASE,
    updatedAt: BASE,
  },
];
