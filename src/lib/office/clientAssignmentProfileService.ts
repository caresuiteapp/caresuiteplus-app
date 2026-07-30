import type { ServiceResult } from '@/types';
import type {
  ClientAssignmentProfile,
  ClientAssignmentProfileInput,
  ScheduledClientAssignment,
} from '@/types/modules/clientAssignmentProfile';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';

type ProfileRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  employee_id: string | null;
  profile_name: string;
  assignment_title: string;
  duration_minutes: number;
  task_titles: unknown;
  location_address: string | null;
  notes_for_employee: string | null;
  internal_notes: string | null;
  client_visible_notes: string | null;
  billing_relevant: boolean;
  requires_signature: boolean;
  requires_documentation: boolean;
  requires_route: boolean;
  client_portal_visible: boolean;
  employee_portal_visible: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  clients?: { first_name?: string | null; last_name?: string | null } | null;
  employees?: { first_name?: string | null; last_name?: string | null } | null;
};

const demoProfiles: ClientAssignmentProfile[] = [];

function personName(
  row?: { first_name?: string | null; last_name?: string | null } | null,
): string {
  return `${row?.first_name ?? ''} ${row?.last_name ?? ''}`.trim();
}

function taskTitles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object' && 'title' in entry) {
        return String((entry as { title?: unknown }).title ?? '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

function mapRow(row: ProfileRow): ClientAssignmentProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    clientName: personName(row.clients) || 'Klient:in',
    employeeId: row.employee_id,
    employeeName: personName(row.employees) || 'Nicht zugewiesen',
    profileName: row.profile_name,
    assignmentTitle: row.assignment_title,
    durationMinutes: row.duration_minutes,
    taskTitles: taskTitles(row.task_titles),
    locationAddress: row.location_address ?? '',
    notesForEmployee: row.notes_for_employee ?? '',
    internalNotes: row.internal_notes ?? '',
    clientVisibleNotes: row.client_visible_notes ?? '',
    billingRelevant: row.billing_relevant,
    requiresSignature: row.requires_signature,
    requiresDocumentation: row.requires_documentation,
    requiresRoute: row.requires_route,
    clientPortalVisible: row.client_portal_visible,
    employeePortalVisible: row.employee_portal_visible,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateProfile(input: ClientAssignmentProfileInput): string | null {
  if (!input.clientId.trim()) return 'Klient:in fehlt.';
  if (!input.profileName.trim()) return 'Profilname ist erforderlich.';
  if (!input.assignmentTitle.trim()) return 'Einsatzbezeichnung ist erforderlich.';
  if (!input.employeeId?.trim()) return 'Mitarbeitende Person ist erforderlich.';
  if (input.durationMinutes < 15 || input.durationMinutes > 720) {
    return 'Die Dauer muss zwischen 15 Minuten und 12 Stunden liegen.';
  }
  if (input.taskTitles.map((task) => task.trim()).filter(Boolean).length === 0) {
    return 'Mindestens eine Aufgabe ist erforderlich.';
  }
  return null;
}

const PROFILE_SELECT = `
  id, tenant_id, client_id, employee_id, profile_name, assignment_title,
  duration_minutes, task_titles, location_address, notes_for_employee,
  internal_notes, client_visible_notes, billing_relevant, requires_signature,
  requires_documentation, requires_route, client_portal_visible,
  employee_portal_visible, is_active, sort_order, created_at, updated_at,
  clients(first_name,last_name), employees(first_name,last_name)
`;

export async function listClientAssignmentProfiles(
  tenantId: string,
  clientId?: string,
): Promise<ServiceResult<ClientAssignmentProfile[]>> {
  const tenantError = assertTenantForMode(tenantId);
  if (tenantError) return tenantError;

  if (getServiceMode() !== 'supabase') {
    return {
      ok: true,
      data: demoProfiles
        .filter((profile) => profile.tenantId === tenantId)
        .filter((profile) => !clientId || profile.clientId === clientId)
        .filter((profile) => profile.isActive),
    };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Datenbankverbindung nicht verfügbar.' };

  let query = fromUnknownTable(client, 'client_assignment_profiles')
    .select(PROFILE_SELECT)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('profile_name', { ascending: true });

  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query;
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: (data ?? []).map((row) => mapRow(row as unknown as ProfileRow)) };
}

export async function saveClientAssignmentProfile(
  tenantId: string,
  input: ClientAssignmentProfileInput,
  profileId?: string,
  actorProfileId?: string | null,
): Promise<ServiceResult<ClientAssignmentProfile>> {
  const tenantError = assertTenantForMode(tenantId);
  if (tenantError) return tenantError;
  const validationError = validateProfile(input);
  if (validationError) return { ok: false, error: validationError };

  const now = new Date().toISOString();
  if (getServiceMode() !== 'supabase') {
    const existingIndex = profileId
      ? demoProfiles.findIndex((profile) => profile.id === profileId)
      : -1;
    const profile: ClientAssignmentProfile = {
      id: profileId ?? `assignment-profile-${Date.now()}`,
      tenantId,
      clientId: input.clientId,
      clientName: 'Klient:in',
      employeeId: input.employeeId,
      employeeName: 'Mitarbeitende:r',
      profileName: input.profileName.trim(),
      assignmentTitle: input.assignmentTitle.trim(),
      durationMinutes: input.durationMinutes,
      taskTitles: input.taskTitles.map((task) => task.trim()).filter(Boolean),
      locationAddress: input.locationAddress.trim(),
      notesForEmployee: input.notesForEmployee.trim(),
      internalNotes: input.internalNotes.trim(),
      clientVisibleNotes: input.clientVisibleNotes.trim(),
      billingRelevant: input.billingRelevant,
      requiresSignature: input.requiresSignature,
      requiresDocumentation: input.requiresDocumentation,
      requiresRoute: input.requiresRoute,
      clientPortalVisible: input.clientPortalVisible,
      employeePortalVisible: input.employeePortalVisible,
      isActive: true,
      sortOrder: existingIndex >= 0 ? demoProfiles[existingIndex]!.sortOrder : demoProfiles.length,
      createdAt: existingIndex >= 0 ? demoProfiles[existingIndex]!.createdAt : now,
      updatedAt: now,
    };
    if (existingIndex >= 0) demoProfiles[existingIndex] = profile;
    else demoProfiles.push(profile);
    return { ok: true, data: profile };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Datenbankverbindung nicht verfügbar.' };
  const payload = {
    tenant_id: tenantId,
    client_id: input.clientId,
    employee_id: input.employeeId,
    profile_name: input.profileName.trim(),
    assignment_title: input.assignmentTitle.trim(),
    duration_minutes: input.durationMinutes,
    task_titles: input.taskTitles.map((task) => task.trim()).filter(Boolean),
    location_address: input.locationAddress.trim() || null,
    notes_for_employee: input.notesForEmployee.trim() || null,
    internal_notes: input.internalNotes.trim() || null,
    client_visible_notes: input.clientVisibleNotes.trim() || null,
    billing_relevant: input.billingRelevant,
    requires_signature: input.requiresSignature,
    requires_documentation: input.requiresDocumentation,
    requires_route: input.requiresRoute,
    client_portal_visible: input.clientPortalVisible,
    employee_portal_visible: input.employeePortalVisible,
    updated_by: actorProfileId ?? null,
    updated_at: now,
    ...(profileId ? {} : { created_by: actorProfileId ?? null }),
  };

  const query = profileId
    ? fromUnknownTable(client, 'client_assignment_profiles')
        .update(payload)
        .eq('tenant_id', tenantId)
        .eq('id', profileId)
    : fromUnknownTable(client, 'client_assignment_profiles').insert(payload);

  const { data, error } = await query.select(PROFILE_SELECT).single();
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: mapRow(data as unknown as ProfileRow) };
}

export async function archiveClientAssignmentProfile(
  tenantId: string,
  profileId: string,
  actorProfileId?: string | null,
): Promise<ServiceResult<void>> {
  if (getServiceMode() !== 'supabase') {
    const profile = demoProfiles.find((item) => item.id === profileId && item.tenantId === tenantId);
    if (profile) profile.isActive = false;
    return { ok: true, data: undefined };
  }
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Datenbankverbindung nicht verfügbar.' };
  const { error } = await fromUnknownTable(client, 'client_assignment_profiles')
    .update({ is_active: false, updated_by: actorProfileId ?? null, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', profileId);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: undefined };
}

export async function scheduleClientAssignmentProfile(
  tenantId: string,
  profileId: string,
  assignmentDate: string,
  startTime: string,
): Promise<ServiceResult<ScheduledClientAssignment>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(assignmentDate)) {
    return { ok: false, error: 'Datum ist ungültig.' };
  }
  if (!/^\d{2}:\d{2}$/.test(startTime)) {
    return { ok: false, error: 'Uhrzeit ist ungültig.' };
  }
  if (getServiceMode() !== 'supabase') {
    const profile = demoProfiles.find(
      (item) => item.id === profileId && item.tenantId === tenantId && item.isActive,
    );
    if (!profile) return { ok: false, error: 'Einsatzprofil nicht gefunden.' };
    const startAt = new Date(`${assignmentDate}T${startTime}:00`).toISOString();
    const endAt = new Date(new Date(startAt).getTime() + profile.durationMinutes * 60_000).toISOString();
    return {
      ok: true,
      data: {
        assignmentId: `assignment-${Date.now()}`,
        profileId,
        status: 'confirmed',
        startAt,
        endAt,
      },
    };
  }
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Datenbankverbindung nicht verfügbar.' };
  const { data, error } = await client.rpc('schedule_client_assignment_profile' as never, {
    p_tenant_id: tenantId,
    p_profile_id: profileId,
    p_assignment_date: assignmentDate,
    p_start_time: startTime,
  } as never);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: data as unknown as ScheduledClientAssignment };
}
