import type { RoleKey, ServiceResult } from '@/types';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import { demoInvoices } from '@/data/demo/seedCatalog';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export type OfficeReportingKpi = {
  id: string;
  label: string;
  value: string;
  hint?: string;
};

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchOfficeReportingSummary(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OfficeReportingKpi[]>> {
  const denied = enforcePermission<OfficeReportingKpi[]>(actorRoleKey, 'office.access');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Live-Auswertungen: Repository erweitern.' };
  }
  await demoDelay();
  return {
    ok: true,
    data: [
      {
        id: 'clients',
        label: 'Aktive Klient:innen',
        value: String(demoClients.filter((c) => c.status === 'aktiv').length),
        hint: 'Office-Stammdaten',
      },
      {
        id: 'employees',
        label: 'Mitarbeitende',
        value: String(demoEmployees.filter((e) => e.status === 'aktiv').length),
        hint: 'Personalverwaltung',
      },
      {
        id: 'openInvoices',
        label: 'Offene Rechnungen',
        value: String(demoInvoices.filter((i) => i.status === 'aktiv' || i.status === 'in_bearbeitung').length),
        hint: 'Abrechnung',
      },
      {
        id: 'documents',
        label: 'Klient:innen gesamt',
        value: String(demoClients.length),
        hint: 'Stammdaten',
      },
    ],
  };
}
