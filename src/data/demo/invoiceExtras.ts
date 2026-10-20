import type { AuditEntry } from '@/types/detail';
import type { InvoiceLineItem } from '@/types/modules/billing';
import type { WorkflowStatus } from '@/types';
import { demoInvoices } from './invoices';

export const demoInvoiceLineItems: Record<string, InvoiceLineItem[]> = {
  'inv-001': [
    { id: 'line-001', description: 'Entlastungsleistung (Std.)', quantity: 12, unitPriceCents: 3_500, totalCents: 42_000 },
    { id: 'line-002', description: 'Haushaltsführung', quantity: 8, unitPriceCents: 3_200, totalCents: 25_600 },
    { id: 'line-003', description: 'Anfahrtspauschale', quantity: 4, unitPriceCents: 14_225, totalCents: 56_900 },
  ],
  'inv-002': [
    { id: 'line-004', description: 'Verhinderungspflege Tag', quantity: 5, unitPriceCents: 17_800, totalCents: 89_000 },
  ],
  'inv-003': [
    { id: 'line-005', description: 'Sachleistung Pflege', quantity: 20, unitPriceCents: 10_500, totalCents: 210_000 },
  ],
};

const BASE_AUDIT: AuditEntry[] = [
  {
    id: 'audit-inv-001',
    action: 'Rechnung erstellt',
    actorName: 'Büro Demo',
    timestamp: '2026-05-01T08:00:00.000Z',
    details: 'Automatisch aus Leistungsnachweisen generiert.',
  },
];

export const demoInvoiceAudit: Record<string, AuditEntry[]> = {
  'inv-001': [
    ...BASE_AUDIT,
    {
      id: 'audit-inv-001b',
      action: 'Versendet',
      actorName: 'Anna Krüger',
      timestamp: '2026-05-02T10:30:00.000Z',
    },
  ],
  'inv-002': [
    {
      id: 'audit-inv-002',
      action: 'In Bearbeitung',
      actorName: 'Büro Demo',
      timestamp: '2026-05-05T08:00:00.000Z',
      details: 'Kostenträger-Rückfrage offen.',
    },
  ],
  'inv-003': [
    {
      id: 'audit-inv-003',
      action: 'Fehler markiert',
      actorName: 'Geschäftsführung',
      timestamp: '2026-06-01T09:00:00.000Z',
      details: 'Falsche Leistungsart — Korrektur erforderlich.',
    },
  ],
};

type InvoiceMutable = (typeof demoInvoices)[number];

let invoiceStore: InvoiceMutable[] = demoInvoices.map((inv) => ({ ...inv }));
const auditStore: Record<string, AuditEntry[]> = { ...demoInvoiceAudit };
const notesStore: Record<string, string> = {
  'inv-002': 'Kostenträger-Rückfrage offen.',
  'inv-003': 'Falsche Leistungsart — Korrektur erforderlich.',
};

export function getDemoInvoiceNotes(invoiceId: string): string | null {
  return notesStore[invoiceId] ?? null;
}

export function getDemoInvoiceById(id: string): InvoiceMutable | null {
  const inv = invoiceStore.find((i) => i.id === id);
  return inv ? { ...inv } : null;
}

export function getDemoInvoiceLineItems(invoiceId: string): InvoiceLineItem[] {
  return demoInvoiceLineItems[invoiceId] ?? [];
}

export function getDemoInvoiceAudit(invoiceId: string): AuditEntry[] {
  return [...(auditStore[invoiceId] ?? [])];
}

export function updateDemoInvoiceStatus(
  id: string,
  newStatus: WorkflowStatus,
  actorName: string,
): InvoiceMutable | null {
  const index = invoiceStore.findIndex((i) => i.id === id);
  if (index < 0) return null;

  invoiceStore[index] = {
    ...invoiceStore[index],
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  const entry: AuditEntry = {
    id: `audit-${id}-${Date.now()}`,
    action: `Status → ${newStatus}`,
    actorName,
    timestamp: new Date().toISOString(),
  };
  auditStore[id] = [...(auditStore[id] ?? []), entry];

  return { ...invoiceStore[index] };
}

export function updateDemoInvoiceFields(
  id: string,
  patch: { notes?: string | null; dueDate?: string },
  actorName: string,
): InvoiceMutable | null {
  const index = invoiceStore.findIndex((i) => i.id === id);
  if (index < 0) return null;

  invoiceStore[index] = {
    ...invoiceStore[index],
    dueDate: patch.dueDate ?? invoiceStore[index].dueDate,
    updatedAt: new Date().toISOString(),
  };

  if (patch.notes !== undefined) {
    notesStore[id] = patch.notes ?? '';
  }

  const entry: AuditEntry = {
    id: `audit-${id}-${Date.now()}`,
    action: 'Stammdaten bearbeitet',
    actorName,
    timestamp: new Date().toISOString(),
    details: patch.notes?.trim() ? patch.notes.trim() : 'Fälligkeit oder Hinweise aktualisiert.',
  };
  auditStore[id] = [...(auditStore[id] ?? []), entry];

  return { ...invoiceStore[index] };
}
