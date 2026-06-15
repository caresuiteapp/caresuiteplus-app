import type { OutboxEntryListItem } from '@/types/modules/integrations';
import { DEMO_TENANT_ID } from './tenant';

const BASE = '2026-06-11T10:00:00.000Z';

export const demoOutboxEntries: OutboxEntryListItem[] = [
  {
    id: 'outbox-001', tenantId: DEMO_TENANT_ID, type: 'email',
    recipient: 'helga.schneider@demo.app', subject: 'Terminbestätigung',
    body: 'Ihr Termin am Dienstag ist bestätigt.', status: 'sent',
    attempts: 1, lastAttemptAt: BASE, workflowStatus: 'abgeschlossen',
    createdAt: '2026-06-10T08:00:00.000Z', updatedAt: BASE,
  },
  {
    id: 'outbox-002', tenantId: DEMO_TENANT_ID, type: 'webhook',
    recipient: 'vault:integration-datev', subject: 'Rechnung RE-2026-0341',
    body: 'DATEV-Export Rechnung inv-001', status: 'pending',
    attempts: 0, lastAttemptAt: null, workflowStatus: 'entwurf',
    createdAt: BASE, updatedAt: BASE,
  },
  {
    id: 'outbox-003', tenantId: DEMO_TENANT_ID, type: 'sms',
    recipient: '+49 170 3456789', subject: null,
    body: 'Einsatzplanung: Verspätung bitte melden.', status: 'failed',
    attempts: 3, lastAttemptAt: '2026-06-11T09:30:00.000Z', workflowStatus: 'fehlerhaft',
    createdAt: '2026-06-11T07:00:00.000Z', updatedAt: '2026-06-11T09:30:00.000Z',
  },
  {
    id: 'outbox-004', tenantId: DEMO_TENANT_ID, type: 'email',
    recipient: 'petra.lehmann@demo.app', subject: 'OCR abgeschlossen',
    body: 'Dokument Pflegeplan Juni wurde verarbeitet.', status: 'sent',
    attempts: 1, lastAttemptAt: '2026-06-10T14:35:00.000Z', workflowStatus: 'abgeschlossen',
    createdAt: '2026-06-10T14:30:00.000Z', updatedAt: '2026-06-10T14:35:00.000Z',
  },
];

let outboxStore = demoOutboxEntries.map((e) => ({ ...e }));

export function getDemoOutboxEntries(): OutboxEntryListItem[] {
  return outboxStore.map((e) => ({ ...e }));
}

export function createDemoOutboxEntry(
  type: OutboxEntryListItem['type'],
  recipient: string,
  subject: string | null,
  body: string,
): OutboxEntryListItem {
  const now = new Date().toISOString();
  const entry: OutboxEntryListItem = {
    id: `outbox-${Date.now()}`,
    tenantId: DEMO_TENANT_ID,
    type,
    recipient,
    subject,
    body,
    status: 'pending',
    attempts: 0,
    lastAttemptAt: null,
    workflowStatus: 'entwurf',
    createdAt: now,
    updatedAt: now,
  };
  outboxStore = [entry, ...outboxStore];
  return entry;
}

export function retryDemoOutboxEntry(id: string): OutboxEntryListItem | null {
  const index = outboxStore.findIndex((e) => e.id === id);
  if (index < 0) return null;
  outboxStore[index] = {
    ...outboxStore[index],
    status: 'pending',
    attempts: outboxStore[index].attempts + 1,
    lastAttemptAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...outboxStore[index] };
}
