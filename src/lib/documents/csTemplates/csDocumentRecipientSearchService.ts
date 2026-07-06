import type { RoleKey, ServiceResult } from '@/types';
import type {
  CsDocumentClientRecipient,
  CsDocumentEmployeeRecipient,
} from '@/types/documents/csDocumentRecipients';
import { listClientPortalCodes, listEmployeePortalAccounts } from '@/lib/auth/accessManagementService';
import { fetchClientList, fetchEmployeeList } from '@/lib/office';
import { resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';

function matchesSearch(terms: string[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return terms.some((t) => t.toLowerCase().includes(q));
}

function portalLabel(active: boolean): string {
  return active ? 'Portal aktiv' : 'Kein Portalzugang';
}

export async function searchCsDocumentEmployeeRecipients(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  searchQuery = '',
): Promise<ServiceResult<CsDocumentEmployeeRecipient[]>> {
  const denied = enforcePermission<CsDocumentEmployeeRecipient[]>(actorRoleKey, 'office.employees.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const listResult = await fetchEmployeeList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  const portalByEmployee = new Map<string, { active: boolean; lastLoginAt: string | null }>();

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await fromUnknownTable(supabase, 'employee_portal_accounts')
        .select('employee_id, status, last_login_at')
        .eq('tenant_id', tenantId);
      for (const row of data ?? []) {
        const r = row as { employee_id: string; status?: string; last_login_at?: string | null };
        portalByEmployee.set(String(r.employee_id), {
          active: r.status === 'active',
          lastLoginAt: r.last_login_at ? String(r.last_login_at) : null,
        });
      }
    }
  } else {
    for (const account of listEmployeePortalAccounts(tenantId)) {
      portalByEmployee.set(account.employeeId, {
        active: account.status === 'active',
        lastLoginAt: account.lastLoginAt ?? null,
      });
    }
  }

  const rows: CsDocumentEmployeeRecipient[] = listResult.data
    .map((employee) => {
      const fullName = `${employee.firstName} ${employee.lastName}`.trim();
      const portal = portalByEmployee.get(employee.id);
      const portalActive = portal?.active ?? false;
      return {
        id: employee.id,
        fullName,
        email: employee.email,
        jobTitle: employee.jobTitle ? resolveEmployeeRoleLabel(employee.jobTitle) : null,
        status: employee.status,
        statusLabel: WORKFLOW_STATUS_LABELS[employee.status] ?? employee.status,
        portalActive,
        portalLabel: portalLabel(portalActive),
        lastLoginAt: portal?.lastLoginAt ?? null,
      };
    })
    .filter((row) =>
      matchesSearch(
        [row.fullName, row.email ?? '', row.jobTitle ?? '', row.statusLabel],
        searchQuery,
      ),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'de'));

  return { ok: true, data: rows };
}

export async function searchCsDocumentClientRecipients(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  searchQuery = '',
): Promise<ServiceResult<CsDocumentClientRecipient[]>> {
  const denied = enforcePermission<CsDocumentClientRecipient[]>(actorRoleKey, 'office.clients.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const listResult = await fetchClientList(tenantId, actorRoleKey, { lifecycleFilter: 'active' });
  if (!listResult.ok) return listResult;

  const portalByClient = new Map<string, boolean>();
  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await fromUnknownTable(supabase, 'client_portal_codes')
        .select('client_id, status')
        .eq('tenant_id', tenantId);
      for (const row of data ?? []) {
        const r = row as { client_id: string; status?: string };
        if (r.status === 'active' || r.status === 'regenerated') {
          portalByClient.set(String(r.client_id), true);
        }
      }
    }
  } else {
    for (const code of listClientPortalCodes(tenantId)) {
      if (code.status === 'active' || code.status === 'regenerated') {
        portalByClient.set(code.clientId, true);
      }
    }
  }

  const representativeByClient = new Map<string, string>();
  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (supabase) {
      const ids = listResult.data.map((c) => c.id);
      if (ids.length > 0) {
        const { data } = await fromUnknownTable(supabase, 'clients')
          .select('id, representative_name')
          .eq('tenant_id', tenantId)
          .in('id', ids);
        for (const row of data ?? []) {
          const r = row as { id: string; representative_name?: string | null };
          if (r.representative_name) {
            representativeByClient.set(String(r.id), String(r.representative_name));
          }
        }
      }
    }
  }

  const rows: CsDocumentClientRecipient[] = listResult.data
    .map((client) => {
      const fullName = `${client.firstName} ${client.lastName}`.trim();
      const location = [client.zip, client.city].filter(Boolean).join(' ').trim() || null;
      const portalActive = portalByClient.get(client.id) ?? false;
      return {
        id: client.id,
        fullName,
        locationLabel: location,
        careLevel: client.careLevel ?? null,
        payorName: client.costCarrier ?? null,
        representativeName: representativeByClient.get(client.id) ?? null,
        status: client.status,
        statusLabel: WORKFLOW_STATUS_LABELS[client.status] ?? client.status,
        portalActive,
        portalLabel: portalLabel(portalActive),
      };
    })
    .filter((row) =>
      matchesSearch(
        [
          row.fullName,
          row.locationLabel ?? '',
          row.careLevel ?? '',
          row.payorName ?? '',
          row.representativeName ?? '',
        ],
        searchQuery,
      ),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'de'));

  return { ok: true, data: rows };
}
