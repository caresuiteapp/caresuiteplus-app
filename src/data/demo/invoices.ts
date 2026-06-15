import type { Invoice } from '@/types/modules/office';
import { DEMO_TENANT_ID } from './tenant';

export const demoInvoices: Pick<
  Invoice,
  | 'id'
  | 'tenantId'
  | 'clientId'
  | 'invoiceNumber'
  | 'amountCents'
  | 'currency'
  | 'dueDate'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
>[] = [
  {
    id: 'inv-001',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-001',
    invoiceNumber: 'RE-2026-0341',
    amountCents: 124_500,
    currency: 'EUR',
    dueDate: '2026-06-15',
    status: 'aktiv',
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'inv-002',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-002',
    invoiceNumber: 'RE-2026-0342',
    amountCents: 89_000,
    currency: 'EUR',
    dueDate: '2026-06-20',
    status: 'in_bearbeitung',
    createdAt: '2026-05-05T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'inv-003',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-005',
    invoiceNumber: 'RE-2026-0310',
    amountCents: 210_000,
    currency: 'EUR',
    dueDate: '2026-05-01',
    status: 'fehlerhaft',
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'inv-004',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-006',
    invoiceNumber: 'RE-2026-0288',
    amountCents: 67_500,
    currency: 'EUR',
    dueDate: '2026-03-15',
    status: 'abgeschlossen',
    createdAt: '2026-02-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'inv-005',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-009',
    invoiceNumber: 'RE-2026-0350',
    amountCents: 45_000,
    currency: 'EUR',
    dueDate: '2026-07-01',
    status: 'entwurf',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'inv-006',
    tenantId: DEMO_TENANT_ID,
    clientId: 'client-007',
    invoiceNumber: 'RE-2025-1201',
    amountCents: 156_000,
    currency: 'EUR',
    dueDate: '2025-12-31',
    status: 'archiviert',
    createdAt: '2025-11-01T08:00:00.000Z',
    updatedAt: '2026-01-15T08:00:00.000Z',
  },
];
