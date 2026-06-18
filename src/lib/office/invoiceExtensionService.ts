import type { RoleKey, ServiceResult } from '@/types';
import { demoClients } from '@/data/demo/clients';
import { demoInvoices } from '@/data/demo/invoices';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { formatCurrency } from '@/lib/office/invoiceListService';

export type InvoiceRunItem = {
  id: string;
  tenantId: string;
  label: string;
  runAt: string;
  invoiceCount: number;
  totalCents: number;
  status: string;
};

export type InvoicePaymentItem = {
  id: string;
  tenantId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  paidAt: string;
  amountCents: number;
  method: string;
  status: string;
};

export type InvoiceDunningItem = {
  id: string;
  tenantId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  dunningLevel: number;
  dueDate: string;
  openCents: number;
  status: string;
};

function clientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

async function demoDelay(ms = 220): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchInvoiceRuns(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoiceRunItem[]>> {
  const denied = enforcePermission<InvoiceRunItem[]>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Live-Abrechnungsläufe: Repository erweitern.' };
  await demoDelay();
  const now = Date.now();
  return {
    ok: true,
    data: [
      {
        id: 'run-001',
        tenantId,
        label: 'Monatslauf März 2026',
        runAt: new Date(now - 86400000 * 2).toISOString(),
        invoiceCount: demoInvoices.length,
        totalCents: demoInvoices.reduce((sum, inv) => sum + inv.amountCents, 0),
        status: 'abgeschlossen',
      },
      {
        id: 'run-002',
        tenantId,
        label: 'Sammellauf Leistungsnachweise',
        runAt: new Date(now - 86400000 * 9).toISOString(),
        invoiceCount: Math.max(3, Math.floor(demoInvoices.length / 2)),
        totalCents: demoInvoices.slice(0, 3).reduce((sum, inv) => sum + inv.amountCents, 0),
        status: 'aktiv',
      },
    ],
  };
}

export async function fetchInvoicePayments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoicePaymentItem[]>> {
  const denied = enforcePermission<InvoicePaymentItem[]>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Live-Zahlungen: Repository erweitern.' };
  await demoDelay();
  return {
    ok: true,
    data: demoInvoices
      .filter((inv) => inv.status === 'abgeschlossen' || inv.status === 'aktiv')
      .slice(0, 12)
      .map((inv, index) => ({
        id: `pay-${inv.id}`,
        tenantId,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: clientName(inv.clientId),
        paidAt: new Date(Date.now() - index * 43200000).toISOString(),
        amountCents: inv.amountCents,
        method: index % 2 === 0 ? 'Überweisung' : 'Lastschrift',
        status: inv.status === 'abgeschlossen' ? 'abgeschlossen' : 'in_bearbeitung',
      })),
  };
}

export async function fetchInvoiceDunningCases(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoiceDunningItem[]>> {
  const denied = enforcePermission<InvoiceDunningItem[]>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Live-Mahnlauf: Repository erweitern.' };
  await demoDelay();
  return {
    ok: true,
    data: demoInvoices
      .filter((inv) => inv.status === 'in_bearbeitung' || inv.status === 'fehlerhaft')
      .map((inv, index) => ({
        id: `dun-${inv.id}`,
        tenantId,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: clientName(inv.clientId),
        dunningLevel: 1 + (index % 3),
        dueDate: inv.dueDate,
        openCents: inv.amountCents,
        status: index % 2 === 0 ? 'aktiv' : 'in_bearbeitung',
      })),
  };
}

export { formatCurrency };
