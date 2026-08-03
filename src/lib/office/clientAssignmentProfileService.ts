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
import type { AssistAssignmentTaskDraft } from '@/types/assistCatalog';
import { assignmentProfileEndAt } from '@/lib/office/clientAssignmentProfileDuration';

type ProfileRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  employee_id: string | null;
  profile_name: string;
  assignment_title: string;
  description: string | null;
  duration_minutes: number;
  task_titles: unknown;
  task_drafts: unknown;
  service_key: string | null;
  service_name: string | null;
  subject_key: string | null;
  assignment_type_key: string | null;
  service_category_key: string | null;
  task_package_id: string | null;
  billing_budget_source_key: string | null;
  risk_flag_keys: unknown;
  documentation_template_key: string | null;
  proof_template_key: string | null;
  catalog_snapshot_json: unknown;
  location_address: string | null;
  location_notes: string | null;
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

export function toClientAssignmentScheduleError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Einsatz konnte nicht gespeichert werden. Bitte erneut versuchen.';
  }
  const record = error as { code?: string; message?: string };
  const message = record.message?.trim() ?? '';
  if (
    ['22004', '23P01', '23502', '23503', '23514', 'P0002'].includes(record.code ?? '')
    && message
  ) {
    return message;
  }
  if (
    record.code === '42703'
    || record.code === '42P01'
    || record.code === 'PGRST202'
    || record.code === 'PGRST204'
  ) {
    return 'Das Datenbankschema der Einsatzplanung ist unvollständig. Bitte die Freigabe-Reparatur anwenden.';
  }
  return toGermanSupabaseError(error);
}

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

function taskDrafts(value: unknown, fallbackTitles: string[]): AssistAssignmentTaskDraft[] {
  if (!Array.isArray(value)) {
    return fallbackTitles.map((title, sortOrder) => ({
      itemKey: `manual-${sortOrder}`,
      title,
      isRequired: true,
      isOptional: false,
      sortOrder,
      requiresNoteIfNotDone: true,
    }));
  }
  return value.reduce<AssistAssignmentTaskDraft[]>((drafts, entry, sortOrder) => {
      if (!entry || typeof entry !== 'object') return drafts;
      const draft = entry as Partial<AssistAssignmentTaskDraft>;
      const title = String(draft.title ?? '').trim();
      if (!title) return drafts;
      drafts.push({
        catalogItemId: draft.catalogItemId ?? null,
        itemKey: String(draft.itemKey ?? `manual-${sortOrder}`),
        title,
        isRequired: draft.isRequired !== false,
        isOptional: Boolean(draft.isOptional),
        sortOrder: Number.isFinite(draft.sortOrder) ? Number(draft.sortOrder) : sortOrder,
        defaultDurationMinutes: draft.defaultDurationMinutes ?? null,
        requiresNoteIfNotDone: Boolean(draft.requiresNoteIfNotDone),
        notExecutable: Boolean(draft.notExecutable),
      });
      return drafts;
    }, []);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mapRow(row: ProfileRow): ClientAssignmentProfile {
  const titles = taskTitles(row.task_titles);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    clientName: personName(row.clients) || 'Klient:in',
    employeeId: row.employee_id,
    employeeName: personName(row.employees) || 'Nicht zugewiesen',
    profileName: row.profile_name,
    assignmentTitle: row.assignment_title,
    description: row.description ?? '',
    durationMinutes: row.duration_minutes,
    taskTitles: titles,
    taskDrafts: taskDrafts(row.task_drafts, titles),
    serviceKey: row.service_key ?? '',
    serviceName: row.service_name ?? '',
    subjectKey: row.subject_key ?? '',
    assignmentTypeKey: row.assignment_type_key ?? '',
    serviceCategoryKey: row.service_category_key ?? '',
    taskPackageId: row.task_package_id,
    billingBudgetSourceKey: row.billing_budget_source_key ?? '',
    riskFlagKeys: stringArray(row.risk_flag_keys),
    documentationTemplateKey: row.documentation_template_key ?? '',
    proofTemplateKey: row.proof_template_key ?? '',
    catalogSnapshotJson: jsonObject(row.catalog_snapshot_json),
    locationAddress: row.location_address ?? '',
    locationNotes: row.location_notes ?? '',
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

export function validateClientAssignmentProfileInput(
  input: ClientAssignmentProfileInput,
): string | null {
  if (!input.clientId.trim()) return 'Klient:in fehlt.';
  if (!input.profileName.trim()) return 'Profilname ist erforderlich.';
  if (!input.assignmentTitle.trim()) return 'Einsatzbezeichnung ist erforderlich.';
  if (!input.employeeId?.trim()) return 'Mitarbeitende Person ist erforderlich.';
  if (!input.subjectKey.trim() && !input.assignmentTitle.trim()) {
    return 'Einsatz-Betreff oder Einsatzbezeichnung ist erforderlich.';
  }
  if (input.durationMinutes < 15 || input.durationMinutes > 720) {
    return 'Die Dauer muss zwischen 15 Minuten und 12 Stunden liegen.';
  }
  if (
    input.taskDrafts.filter((task) => task.title.trim()).length === 0
    && input.taskTitles.map((task) => task.trim()).filter(Boolean).length === 0
  ) {
    return 'Mindestens eine Aufgabe ist erforderlich.';
  }
  return null;
}

const PROFILE_SELECT = `
  id, tenant_id, client_id, employee_id, profile_name, assignment_title,
  description, duration_minutes, task_titles, task_drafts, service_key, service_name,
  subject_key, assignment_type_key, service_category_key, task_package_id,
  billing_budget_source_key, risk_flag_keys, documentation_template_key,
  proof_template_key, catalog_snapshot_json, location_address, location_notes, notes_for_employee,
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
  const validationError = validateClientAssignmentProfileInput(input);
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
      description: input.description.trim(),
      durationMinutes: input.durationMinutes,
      taskTitles: input.taskTitles.map((task) => task.trim()).filter(Boolean),
      taskDrafts: input.taskDrafts,
      serviceKey: input.serviceKey,
      serviceName: input.serviceName,
      subjectKey: input.subjectKey,
      assignmentTypeKey: input.assignmentTypeKey,
      serviceCategoryKey: input.serviceCategoryKey,
      taskPackageId: input.taskPackageId,
      billingBudgetSourceKey: input.billingBudgetSourceKey,
      riskFlagKeys: input.riskFlagKeys,
      documentationTemplateKey: input.documentationTemplateKey,
      proofTemplateKey: input.proofTemplateKey,
      catalogSnapshotJson: input.catalogSnapshotJson,
      locationAddress: input.locationAddress.trim(),
      locationNotes: input.locationNotes.trim(),
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
    description: input.description.trim() || null,
    duration_minutes: input.durationMinutes,
    task_titles: input.taskTitles.map((task) => task.trim()).filter(Boolean),
    task_drafts: input.taskDrafts,
    service_key: input.serviceKey || null,
    service_name: input.serviceName || null,
    subject_key: input.subjectKey || null,
    assignment_type_key: input.assignmentTypeKey || null,
    service_category_key: input.serviceCategoryKey || null,
    task_package_id: input.taskPackageId || null,
    billing_budget_source_key: input.billingBudgetSourceKey || null,
    risk_flag_keys: input.riskFlagKeys,
    documentation_template_key: input.documentationTemplateKey || null,
    proof_template_key: input.proofTemplateKey || null,
    catalog_snapshot_json: input.catalogSnapshotJson,
    location_address: input.locationAddress.trim() || null,
    location_notes: input.locationNotes.trim() || null,
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
    const endAt = assignmentProfileEndAt(startAt, profile.durationMinutes);
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
  if (error) return { ok: false, error: toClientAssignmentScheduleError(error) };
  return { ok: true, data: data as unknown as ScheduledClientAssignment };
}
