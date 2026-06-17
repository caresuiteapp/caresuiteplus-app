import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  buildEmployeeInsertPayload,
  buildEmployeeUpdatePayload,
} from '@/lib/office/employeeSupabasePayload';
import { mapDbStatusToCatalogStatus } from '@/lib/office/employeeStatusMapping';
import {
  EMPLOYEE_DETAIL_SELECT_COLUMNS,
  mapEmployeeRowToDetail,
  type EmployeeDetailLiveRow,
} from '@/lib/office/employeeDetailMapper';
import type { EmployeeDetail } from '@/types/modules/employeeDetail';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { SERVICE_ERRORS } from '../errors';

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapRow(row: Record<string, unknown>): EmployeeListItem {
  const jobTitle = row.role_title ?? row.job_title;
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    jobTitle: String(jobTitle ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    status: mapDbStatusToCatalogStatus(String(row.status ?? '')) as EmployeeListItem['status'],
    updatedAt: String(row.updated_at),
  };
}

/** WP190 — Live Supabase Repository (employees) */
export const employeeSupabaseRepository = {
  wpNumber: 190 as const,

  async list(tenantId: string): Promise<ServiceResult<EmployeeListItem[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('last_name', { ascending: true });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []).map(mapRow) };
  },

  async getById(tenantId: string, id: string): Promise<ServiceResult<EmployeeListItem | null>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: data ? mapRow(data) : null };
  },

  async getByIdForDetail(
    tenantId: string,
    id: string,
  ): Promise<ServiceResult<EmployeeDetailLiveRow | null>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from('employees')
      .select(EMPLOYEE_DETAIL_SELECT_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data as EmployeeDetailLiveRow | null) ?? null };
  },

  async getDetailMapped(
    tenantId: string,
    id: string,
  ): Promise<ServiceResult<EmployeeDetail>> {
    const result = await this.getByIdForDetail(tenantId, id);
    if (!result.ok) return result;
    if (!result.data) {
      return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
    }
    return mapEmployeeRowToDetail(result.data);
  },

  async create(
    tenantId: string,
    input: {
      firstName: string;
      lastName: string;
      jobTitle?: string;
      email?: string;
      phone?: string;
      department?: string;
      status?: string;
      avatarUrl?: string | null;
    },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'employees')
      .insert(buildEmployeeInsertPayload(tenantId, input))
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: data.id } };
  },

  async update(
    tenantId: string,
    id: string,
    input: {
      jobTitle?: string | null;
      phone?: string | null;
      department?: string | null;
      notes?: string | null;
      status?: string;
      avatarUrl?: string | null;
    },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();

    const patch = buildEmployeeUpdatePayload(input);

    if (Object.keys(patch).length === 0) {
      return { ok: true, data: { id } };
    }

    const { data, error } = await fromUnknownTable(supabase, 'employees')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select('id')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: data.id } };
  },
};
