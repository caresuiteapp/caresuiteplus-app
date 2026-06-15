import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

type TableRepo = {
  table: string;
  list: (tenantId: string) => Promise<ServiceResult<Record<string, unknown>[]>>;
};

function createAssignmentRepo(table: string): TableRepo {
  return {
    table,
    async list(tenantId: string) {
      const supabase = getSupabaseClient();
      if (!supabase) return unavailable();
      const { data, error } = await fromUnknownTable(supabase, table)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false });
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
      return { ok: true, data: (data ?? []) as Record<string, unknown>[] };
    },
  };
}

/** Supabase-Repositories für OfficeCore Modulzuordnungen (Migration 0037). */
export const officeCoreSupabaseRepository = {
  clientModuleAssignments: createAssignmentRepo('client_module_assignments'),
  employeeModuleAssignments: createAssignmentRepo('employee_module_assignments'),
  moduleServiceCatalog: createAssignmentRepo('module_service_catalog'),
  moduleBillingSources: createAssignmentRepo('module_billing_sources'),
  moduleDocumentVisibility: createAssignmentRepo('module_document_visibility'),
  moduleTemplateAssignments: createAssignmentRepo('module_template_assignments'),
  modulePermissionProfiles: createAssignmentRepo('module_permission_profiles'),
};
