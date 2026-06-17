import type { ServiceResult } from '@/types';
import type {
  ClientModuleAssignment,
  EmployeeModuleAssignment,
  ModuleAssignmentSection,
  ModuleBillingSource,
  ModuleDocumentVisibility,
  ModulePermissionProfile,
  ModuleServiceCatalogEntry,
  ModuleTemplateAssignment,
} from '@/lib/officeCore/types';
import {
  mapClientModuleAssignmentRow,
  mapEmployeeModuleAssignmentRow,
  mapModuleBillingSourceRow,
  mapModuleDocumentVisibilityRow,
  mapModulePermissionProfileRow,
  mapModuleServiceCatalogRow,
  mapModuleTemplateAssignmentRow,
} from '@/lib/officeCore/moduleAssignmentMapper';
import { officeCoreSupabaseRepository } from '@/lib/officeCore/supabaseRepository';
import { formatOfficeClientName } from '@/lib/office/officeDocumentDisplay';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

async function fetchClientNameMap(
  tenantId: string,
  clientIds: string[],
): Promise<Map<string, string>> {
  if (clientIds.length === 0) return new Map();

  const supabase = getSupabaseClient();
  if (!supabase) return new Map();

  const { data, error } = await fromUnknownTable(supabase, 'clients')
    .select('id, first_name, last_name')
    .eq('tenant_id', tenantId)
    .in('id', clientIds);

  if (error || !data) return new Map();

  return new Map(
    (data as Array<{ id: string; first_name?: string | null; last_name?: string | null }>).map(
      (row) => [
        row.id,
        formatOfficeClientName(row.first_name, row.last_name) ?? 'Unbekannt',
      ],
    ),
  );
}

async function fetchEmployeeNameMap(
  tenantId: string,
  employeeIds: string[],
): Promise<Map<string, string>> {
  if (employeeIds.length === 0) return new Map();

  const supabase = getSupabaseClient();
  if (!supabase) return new Map();

  const { data, error } = await fromUnknownTable(supabase, 'employees')
    .select('id, first_name, last_name')
    .eq('tenant_id', tenantId)
    .in('id', employeeIds);

  if (error || !data) return new Map();

  return new Map(
    (data as Array<{ id: string; first_name?: string | null; last_name?: string | null }>).map(
      (row) => [
        row.id,
        formatOfficeClientName(row.first_name, row.last_name) ?? 'Unbekannt',
      ],
    ),
  );
}

export async function loadClientModuleAssignmentsLive(
  tenantId: string,
): Promise<ServiceResult<ClientModuleAssignment[]>> {
  const result = await officeCoreSupabaseRepository.clientModuleAssignments.list(tenantId);
  if (!result.ok) return result;

  const rows = result.data;
  const clientIds = [...new Set(rows.map((row) => String(row.client_id)))];
  const employeeIds = [
    ...new Set(
      rows
        .map((row) => row.primary_employee_id)
        .filter(Boolean)
        .map((id) => String(id)),
    ),
  ];

  const [clientNames, employeeNames] = await Promise.all([
    fetchClientNameMap(tenantId, clientIds),
    fetchEmployeeNameMap(tenantId, employeeIds),
  ]);

  return {
    ok: true,
    data: rows.map((row) =>
      mapClientModuleAssignmentRow(
        row,
        clientNames.get(String(row.client_id)) ?? 'Unbekannt',
        row.primary_employee_id
          ? employeeNames.get(String(row.primary_employee_id))
          : undefined,
      ),
    ),
  };
}

export async function loadEmployeeModuleAssignmentsLive(
  tenantId: string,
): Promise<ServiceResult<EmployeeModuleAssignment[]>> {
  const result = await officeCoreSupabaseRepository.employeeModuleAssignments.list(tenantId);
  if (!result.ok) return result;

  const rows = result.data;
  const employeeIds = [...new Set(rows.map((row) => String(row.employee_id)))];
  const employeeNames = await fetchEmployeeNameMap(tenantId, employeeIds);

  return {
    ok: true,
    data: rows.map((row) =>
      mapEmployeeModuleAssignmentRow(
        row,
        employeeNames.get(String(row.employee_id)) ?? 'Unbekannt',
      ),
    ),
  };
}

export async function loadModuleServiceCatalogLive(
  tenantId: string,
): Promise<ServiceResult<ModuleServiceCatalogEntry[]>> {
  const result = await officeCoreSupabaseRepository.moduleServiceCatalog.list(tenantId);
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(mapModuleServiceCatalogRow) };
}

export async function loadModuleBillingSourcesLive(
  tenantId: string,
): Promise<ServiceResult<ModuleBillingSource[]>> {
  const result = await officeCoreSupabaseRepository.moduleBillingSources.list(tenantId);
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(mapModuleBillingSourceRow) };
}

export async function loadModuleDocumentVisibilityLive(
  tenantId: string,
): Promise<ServiceResult<ModuleDocumentVisibility[]>> {
  const result = await officeCoreSupabaseRepository.moduleDocumentVisibility.list(tenantId);
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(mapModuleDocumentVisibilityRow) };
}

export async function loadModuleTemplateAssignmentsLive(
  tenantId: string,
): Promise<ServiceResult<ModuleTemplateAssignment[]>> {
  const result = await officeCoreSupabaseRepository.moduleTemplateAssignments.list(tenantId);
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(mapModuleTemplateAssignmentRow) };
}

export async function loadModulePermissionProfilesLive(
  tenantId: string,
): Promise<ServiceResult<ModulePermissionProfile[]>> {
  const result = await officeCoreSupabaseRepository.modulePermissionProfiles.list(tenantId);
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(mapModulePermissionProfileRow) };
}

export async function loadModuleAssignmentSectionCountLive(
  tenantId: string,
  section: ModuleAssignmentSection,
): Promise<ServiceResult<number>> {
  switch (section) {
    case 'clients': {
      const result = await officeCoreSupabaseRepository.clientModuleAssignments.list(tenantId);
      return result.ok ? { ok: true, data: result.data.length } : result;
    }
    case 'employees': {
      const result = await officeCoreSupabaseRepository.employeeModuleAssignments.list(tenantId);
      return result.ok ? { ok: true, data: result.data.length } : result;
    }
    case 'services': {
      const result = await officeCoreSupabaseRepository.moduleServiceCatalog.list(tenantId);
      return result.ok ? { ok: true, data: result.data.length } : result;
    }
    case 'billing': {
      const result = await officeCoreSupabaseRepository.moduleBillingSources.list(tenantId);
      return result.ok ? { ok: true, data: result.data.length } : result;
    }
    case 'documents': {
      const result = await officeCoreSupabaseRepository.moduleDocumentVisibility.list(tenantId);
      return result.ok ? { ok: true, data: result.data.length } : result;
    }
    case 'templates': {
      const result = await officeCoreSupabaseRepository.moduleTemplateAssignments.list(tenantId);
      return result.ok ? { ok: true, data: result.data.length } : result;
    }
    case 'permissions': {
      const result = await officeCoreSupabaseRepository.modulePermissionProfiles.list(tenantId);
      return result.ok ? { ok: true, data: result.data.length } : result;
    }
  }
}
