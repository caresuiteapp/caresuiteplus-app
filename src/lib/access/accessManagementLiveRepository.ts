import type { ServiceResult } from '@/types';
import type {
  EmployeePortalAccount,
  LoginAuditEvent,
  RelativePortalCode,
  TenantUser,
} from '@/lib/auth/auth.types';
import type { AccessDashboardStats } from '@/lib/auth/permissionService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  mapEmployeePortalAccountRow,
  mapLoginAuditEventRow,
  mapRelativePortalCodeRow,
  mapTenantUserRow,
  type RelativePortalAccessListItem,
} from './accessManagementMappers';

function castRows(data: unknown): Record<string, unknown>[] {
  return (Array.isArray(data) ? data : []) as Record<string, unknown>[];
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: 'Supabase ist nicht verfügbar.' };
}

export async function fetchTenantUsersFromSupabase(
  tenantId: string,
): Promise<ServiceResult<TenantUser[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await supabase
    .from('tenant_users')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('display_name', { ascending: true });

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: castRows(data).map(mapTenantUserRow) };
}

export async function fetchEmployeePortalAccountsFromSupabase(
  tenantId: string,
): Promise<ServiceResult<EmployeePortalAccount[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await supabase
    .from('employee_portal_accounts_mgmt')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('username', { ascending: true });

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  const accounts = castRows(data).map(mapEmployeePortalAccountRow);
  const employeeIds = [...new Set(accounts.map((entry) => entry.employeeId).filter(Boolean))];
  if (employeeIds.length === 0) return { ok: true, data: accounts };

  const { data: employeeRows, error: employeeError } = await fromUnknownTable(supabase, 'employees')
    .select('id, first_name, last_name, employee_number')
    .eq('tenant_id', tenantId)
    .in('id', employeeIds);

  if (employeeError) return { ok: false, error: toGermanSupabaseError(employeeError) };

  const employees = new Map(
    castRows(employeeRows).map((row) => [
      String(row.id ?? ''),
      {
        name: `${String(row.first_name ?? '')} ${String(row.last_name ?? '')}`.trim(),
        number: String(row.employee_number ?? '').trim(),
      },
    ]),
  );

  return {
    ok: true,
    data: accounts.map((account) => ({
      ...account,
      employeeName: employees.get(account.employeeId)?.name || null,
      employeeNumber: employees.get(account.employeeId)?.number || null,
    })),
  };
}

export async function fetchRelativePortalCodesFromSupabase(
  tenantId: string,
): Promise<ServiceResult<RelativePortalCode[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await supabase
    .from('relative_portal_codes_mgmt')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: castRows(data).map(mapRelativePortalCodeRow) };
}

export async function fetchRelativePortalAccessListFromSupabase(
  tenantId: string,
): Promise<ServiceResult<RelativePortalAccessListItem[]>> {
  const codesResult = await fetchRelativePortalCodesFromSupabase(tenantId);
  if (!codesResult.ok) return codesResult;

  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const codes = codesResult.data;
  const clientIds = [...new Set(codes.map((entry) => entry.clientId))];
  const contactIds = [...new Set(codes.map((entry) => entry.relativeContactId))];

  const clientNames = new Map<string, string>();
  const contactNames = new Map<string, string>();

  if (clientIds.length > 0) {
    const { data: clientRows } = await fromUnknownTable(supabase, 'clients')
      .select('id, first_name, last_name')
      .eq('tenant_id', tenantId)
      .in('id', clientIds);

    for (const row of castRows(clientRows)) {
      const id = String(row.id ?? '');
      const name = `${String(row.first_name ?? '')} ${String(row.last_name ?? '')}`.trim();
      if (id && name) clientNames.set(id, name);
    }
  }

  if (contactIds.length > 0) {
    const { data: contactRows } = await fromUnknownTable(supabase, 'client_contacts')
      .select('id, first_name, last_name')
      .eq('tenant_id', tenantId)
      .in('id', contactIds);

    for (const row of castRows(contactRows)) {
      const id = String(row.id ?? '');
      const name = `${String(row.first_name ?? '')} ${String(row.last_name ?? '')}`.trim();
      if (id && name) contactNames.set(id, name);
    }
  }

  return {
    ok: true,
    data: codes.map((entry) => ({
      ...entry,
      clientName: clientNames.get(entry.clientId) ?? 'Unbekannt',
      relativeContactName: contactNames.get(entry.relativeContactId) ?? 'Angehörige:r',
    })),
  };
}

export async function fetchLoginAuditEventsFromSupabase(
  tenantId: string,
): Promise<ServiceResult<LoginAuditEvent[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await supabase
    .from('login_audit_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: castRows(data).map(mapLoginAuditEventRow) };
}

export async function fetchAccessDashboardStatsFromSupabase(
  tenantId: string,
): Promise<ServiceResult<AccessDashboardStats>> {
  const [usersResult, employeesResult, relativeCodesResult, auditResult] = await Promise.all([
    fetchTenantUsersFromSupabase(tenantId),
    fetchEmployeePortalAccountsFromSupabase(tenantId),
    fetchRelativePortalCodesFromSupabase(tenantId),
    fetchLoginAuditEventsFromSupabase(tenantId),
  ]);

  if (!usersResult.ok) return usersResult;
  if (!employeesResult.ok) return employeesResult;
  if (!relativeCodesResult.ok) return relativeCodesResult;
  if (!auditResult.ok) return auditResult;

  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { count: clientPortalActiveCount, error: clientPortalError } = await fromUnknownTable(
    supabase,
    'client_portal_access',
  )
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('portal_enabled', true);

  if (clientPortalError) {
    return { ok: false, error: toGermanSupabaseError(clientPortalError) };
  }

  const internalUsers = usersResult.data;
  const employeeAccounts = employeesResult.data;
  const relativeCodes = relativeCodesResult.data;
  const activeClientPortal = clientPortalActiveCount ?? 0;
  const activeRelativePortal = relativeCodes.filter((entry) => entry.status === 'active').length;

  const blockedAccesses =
    internalUsers.filter((entry) => entry.status === 'blocked').length +
    employeeAccounts.filter((entry) => entry.status === 'blocked').length +
    relativeCodes.filter((entry) => entry.status === 'blocked').length;

  const pendingFirstLogins =
    internalUsers.filter((entry) => !entry.firstLoginCompleted).length +
    employeeAccounts.filter((entry) => !entry.firstLoginCompleted).length;

  const recentLogins = auditResult.data.filter((entry) => entry.success).length;

  return {
    ok: true,
    data: {
      internalUsers: internalUsers.length,
      employeeAccounts: employeeAccounts.length,
      activePortalCodes: activeClientPortal + activeRelativePortal,
      blockedAccesses,
      pendingFirstLogins,
      recentLogins,
    },
  };
}

export async function insertRelativePortalCode(input: {
  tenantId: string;
  clientId: string;
  relativeContactId: string;
  codeHash: string;
  createdBy: string | null;
  expiresAt?: string | null;
}): Promise<ServiceResult<RelativePortalCode>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('relative_portal_codes')
    .insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      relative_contact_id: input.relativeContactId,
      code_hash: input.codeHash,
      status: 'active',
      expires_at: input.expiresAt ?? null,
      created_by: input.createdBy,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };

  const codeId = String((data as { id: string }).id);
  await supabase.from('portal_access_permissions').insert({
    tenant_id: input.tenantId,
    portal_type: 'relative',
    portal_account_id: codeId,
    can_view_appointments: true,
    can_view_documents: true,
    can_view_messages: true,
    can_send_messages: true,
    can_view_service_records: false,
    can_view_invoices: false,
    can_download_documents: true,
    can_confirm_appointments: false,
    can_sign_records: false,
  });

  const { data: mgmtRow, error: readError } = await supabase
    .from('relative_portal_codes_mgmt')
    .select('*')
    .eq('id', codeId)
    .single();

  if (readError || !mgmtRow) {
    return { ok: false, error: toGermanSupabaseError(readError) };
  }

  return { ok: true, data: mapRelativePortalCodeRow(mgmtRow as Record<string, unknown>) };
}

export async function insertEmployeePortalAccount(input: {
  tenantId: string;
  employeeId: string;
  username: string;
  tempPasswordHash: string;
  tempPasswordCreatedAt: string;
  tempPasswordExpiresAt: string | null;
  createdBy: string | null;
}): Promise<ServiceResult<EmployeePortalAccount>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('employee_portal_accounts')
    .insert({
      tenant_id: input.tenantId,
      employee_id: input.employeeId,
      username: input.username,
      status: 'pending_first_login',
      must_change_password: true,
      first_login_completed: false,
      temporary_password_hash: input.tempPasswordHash,
      temporary_password_created_at: input.tempPasswordCreatedAt,
      temporary_password_expires_at: input.tempPasswordExpiresAt,
      created_by: input.createdBy,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };

  const accountId = String((data as { id: string }).id);
  const { data: mgmtRow, error: readError } = await supabase
    .from('employee_portal_accounts_mgmt')
    .select('*')
    .eq('id', accountId)
    .single();

  if (readError || !mgmtRow) {
    return { ok: false, error: toGermanSupabaseError(readError) };
  }

  return { ok: true, data: mapEmployeePortalAccountRow(mgmtRow as Record<string, unknown>) };
}

export async function listEmployeeUsernamesFromSupabase(tenantId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('employee_portal_accounts_mgmt')
    .select('username')
    .eq('tenant_id', tenantId);

  if (error) return [];
  return castRows(data)
    .map((row) => String(row.username ?? ''))
    .filter(Boolean);
}

export async function listTenantUsernamesFromSupabase(tenantId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('tenant_users')
    .select('username')
    .eq('tenant_id', tenantId);

  if (error) return [];
  return castRows(data)
    .map((row) => String(row.username ?? ''))
    .filter(Boolean);
}

export async function fetchEmployeePortalAccountById(
  tenantId: string,
  accountId: string,
): Promise<ServiceResult<EmployeePortalAccount | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await supabase
    .from('employee_portal_accounts_mgmt')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', accountId)
    .maybeSingle();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data) return { ok: true, data: null };
  const account = mapEmployeePortalAccountRow(data as Record<string, unknown>);
  const { data: employeeRow, error: employeeError } = await fromUnknownTable(supabase, 'employees')
    .select('id, first_name, last_name, employee_number')
    .eq('tenant_id', tenantId)
    .eq('id', account.employeeId)
    .maybeSingle();

  if (employeeError) return { ok: false, error: toGermanSupabaseError(employeeError) };
  const employee = employeeRow as Record<string, unknown> | null;
  return {
    ok: true,
    data: {
      ...account,
      employeeName: employee
        ? `${String(employee.first_name ?? '')} ${String(employee.last_name ?? '')}`.trim() || null
        : null,
      employeeNumber: employee ? String(employee.employee_number ?? '').trim() || null : null,
    },
  };
}

export async function fetchEmployeePortalAccountByEmployeeId(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeePortalAccount | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await supabase
    .from('employee_portal_accounts_mgmt')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapEmployeePortalAccountRow(data as Record<string, unknown>) };
}

export async function fetchTenantUserById(
  tenantId: string,
  userId: string,
): Promise<ServiceResult<TenantUser | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await supabase
    .from('tenant_users')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', userId)
    .maybeSingle();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapTenantUserRow(data as Record<string, unknown>) };
}

export async function updateEmployeePortalAccountPasswordReset(input: {
  tenantId: string;
  accountId: string;
  tempPasswordHash: string;
  tempPasswordCreatedAt: string;
  tempPasswordExpiresAt: string | null;
  actorId: string | null;
}): Promise<ServiceResult<EmployeePortalAccount>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('employee_portal_accounts')
    .update({
      must_change_password: true,
      first_login_completed: false,
      status: 'password_reset_required',
      temporary_password_hash: input.tempPasswordHash,
      temporary_password_created_at: input.tempPasswordCreatedAt,
      temporary_password_expires_at: input.tempPasswordExpiresAt,
      blocked_at: null,
      blocked_by: input.actorId,
      blocked_reason: null,
      updated_at: now,
    })
    .eq('tenant_id', input.tenantId)
    .eq('id', input.accountId);

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return fetchEmployeePortalAccountById(input.tenantId, input.accountId).then((result) =>
    result.ok && result.data
      ? { ok: true as const, data: result.data }
      : { ok: false as const, error: 'Zugang nach Reset nicht gefunden.' },
  );
}

export async function updateEmployeePortalAccountStatus(input: {
  tenantId: string;
  accountId: string;
  status: EmployeePortalAccount['status'];
  blockedAt?: string | null;
  blockedBy?: string | null;
  blockedReason?: string | null;
}): Promise<ServiceResult<EmployeePortalAccount>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('employee_portal_accounts')
    .update({
      status: input.status,
      blocked_at: input.blockedAt ?? null,
      blocked_by: input.blockedBy ?? null,
      blocked_reason: input.blockedReason ?? null,
      updated_at: now,
    })
    .eq('tenant_id', input.tenantId)
    .eq('id', input.accountId);

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return fetchEmployeePortalAccountById(input.tenantId, input.accountId).then((result) =>
    result.ok && result.data
      ? { ok: true as const, data: result.data }
      : { ok: false as const, error: 'Zugang nicht gefunden.' },
  );
}
