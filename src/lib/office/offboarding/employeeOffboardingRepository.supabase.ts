import type { ServiceResult } from '@/types';
import type {
  EmployeeAccessRevocation,
  EmployeeFinalClearance,
  EmployeeOffboardingCheck,
  EmployeeOffboardingSession,
  EmployeeOffboardingStep,
  OffboardingAuditEvent,
} from '@/types/modules/employeeOffboarding';
import { OFFBOARDING_STEP_ORDER } from '@/types/modules/employeeOffboarding';
import { getSupabaseClient } from '@/lib/supabase/client';
import {
  isSupabaseMissingTableError,
  isSupabaseSchemaMismatchError,
  toGermanSupabaseError,
} from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { EmployeeOffboardingStoreSnapshot } from './employeeOffboardingStore';

export const OFFBOARDING_SCHEMA_ERROR =
  'Datenbankschema für das Mitarbeitenden-Offboarding ist unvollständig. Die Personal-R3-Datenbankreparatur muss angewendet werden.';

type Row = Record<string, unknown>;

function schemaError(error: unknown): string {
  return isSupabaseMissingTableError(error) || isSupabaseSchemaMismatchError(error)
    ? OFFBOARDING_SCHEMA_ERROR
    : toGermanSupabaseError(error);
}

function text(row: Row, key: string): string {
  return String(row[key] ?? '');
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function mapSession(row: Row): EmployeeOffboardingSession {
  return {
    id: text(row, 'id'),
    tenantId: text(row, 'tenant_id'),
    employeeId: text(row, 'employee_id'),
    overallStatus: text(row, 'overall_status') as EmployeeOffboardingSession['overallStatus'],
    currentStepKey: text(row, 'current_step_key') as EmployeeOffboardingSession['currentStepKey'],
    exitDate: nullableText(row, 'exit_date'),
    terminationType: nullableText(row, 'termination_type') as EmployeeOffboardingSession['terminationType'],
    internalReason: nullableText(row, 'internal_reason'),
    responsibleUserId: nullableText(row, 'responsible_user_id'),
    startedAt: nullableText(row, 'started_at'),
    completedAt: nullableText(row, 'completed_at'),
    lastSavedAt: text(row, 'last_saved_at'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

function mapStep(row: Row): EmployeeOffboardingStep {
  return {
    id: text(row, 'id'),
    sessionId: text(row, 'session_id'),
    tenantId: text(row, 'tenant_id'),
    employeeId: text(row, 'employee_id'),
    stepKey: text(row, 'step_key') as EmployeeOffboardingStep['stepKey'],
    status: text(row, 'status') as EmployeeOffboardingStep['status'],
    responsibleUserId: nullableText(row, 'responsible_user_id'),
    completedAt: nullableText(row, 'completed_at'),
    notes: nullableText(row, 'notes'),
    updatedAt: text(row, 'updated_at'),
  };
}

function mapCheck(row: Row): EmployeeOffboardingCheck {
  return {
    id: text(row, 'id'),
    sessionId: text(row, 'session_id'),
    tenantId: text(row, 'tenant_id'),
    employeeId: text(row, 'employee_id'),
    checkKey: text(row, 'check_key') as EmployeeOffboardingCheck['checkKey'],
    status: text(row, 'status') as EmployeeOffboardingCheck['status'],
    message: text(row, 'message'),
    count: typeof row.count_value === 'number' ? row.count_value : null,
    evaluatedAt: text(row, 'evaluated_at'),
  };
}

function mapRevocation(row: Row): EmployeeAccessRevocation {
  return {
    id: text(row, 'id'),
    sessionId: text(row, 'session_id'),
    tenantId: text(row, 'tenant_id'),
    employeeId: text(row, 'employee_id'),
    kind: text(row, 'kind') as EmployeeAccessRevocation['kind'],
    status: text(row, 'status') as EmployeeAccessRevocation['status'],
    providerConnected: row.provider_connected === true,
    preparedAt: nullableText(row, 'prepared_at'),
    lockedAt: nullableText(row, 'locked_at'),
    actorId: nullableText(row, 'actor_id'),
    notes: nullableText(row, 'notes'),
    updatedAt: text(row, 'updated_at'),
  };
}

function mapClearance(row: Row): EmployeeFinalClearance {
  return {
    id: text(row, 'id'),
    sessionId: text(row, 'session_id'),
    tenantId: text(row, 'tenant_id'),
    employeeId: text(row, 'employee_id'),
    clearedBy: nullableText(row, 'cleared_by'),
    clearedAt: nullableText(row, 'cleared_at'),
    protocolDocumentId: nullableText(row, 'protocol_document_id'),
    protocolGeneratedAt: nullableText(row, 'protocol_generated_at'),
    archivedAt: nullableText(row, 'archived_at'),
    employmentStatusAfter: nullableText(row, 'employment_status_after') as EmployeeFinalClearance['employmentStatusAfter'],
    notes: nullableText(row, 'notes'),
  };
}

function mapAudit(row: Row): OffboardingAuditEvent {
  return {
    id: text(row, 'id'),
    tenantId: text(row, 'tenant_id'),
    sessionId: text(row, 'session_id'),
    employeeId: text(row, 'employee_id'),
    action: text(row, 'action') as OffboardingAuditEvent['action'],
    stepKey: (nullableText(row, 'step_key') ?? undefined) as OffboardingAuditEvent['stepKey'],
    detail: text(row, 'detail'),
    actorId: nullableText(row, 'actor_id'),
    createdAt: text(row, 'created_at'),
  };
}

async function ensureSession(tenantId: string, employeeId: string): Promise<ServiceResult<Row>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };

  const existing = await fromUnknownTable(supabase, 'employee_offboarding_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();
  if (existing.error) return { ok: false, error: schemaError(existing.error) };
  if (existing.data) return { ok: true, data: existing.data as Row };

  const created = await fromUnknownTable(supabase, 'employee_offboarding_sessions')
    .insert({ tenant_id: tenantId, employee_id: employeeId })
    .select('*')
    .single();
  if (created.error || !created.data) {
    return { ok: false, error: schemaError(created.error) };
  }
  return { ok: true, data: created.data as Row };
}

export async function loadEmployeeOffboardingSnapshot(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeeOffboardingStoreSnapshot>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };

  const sessionResult = await ensureSession(tenantId, employeeId);
  if (!sessionResult.ok) return sessionResult;
  const session = mapSession(sessionResult.data);

  let stepsResult = await fromUnknownTable(supabase, 'employee_offboarding_steps')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true });
  if (stepsResult.error) return { ok: false, error: schemaError(stepsResult.error) };

  if (!stepsResult.data || stepsResult.data.length === 0) {
    const seeded = await fromUnknownTable(supabase, 'employee_offboarding_steps').insert(
      OFFBOARDING_STEP_ORDER.map((stepKey) => ({
        session_id: session.id,
        tenant_id: tenantId,
        employee_id: employeeId,
        step_key: stepKey,
      })),
    );
    if (seeded.error) return { ok: false, error: schemaError(seeded.error) };
    stepsResult = await fromUnknownTable(supabase, 'employee_offboarding_steps')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });
    if (stepsResult.error) return { ok: false, error: schemaError(stepsResult.error) };
  }

  const [checks, revocations, clearances, audits] = await Promise.all([
    fromUnknownTable(supabase, 'employee_offboarding_checks').select('*').eq('session_id', session.id),
    fromUnknownTable(supabase, 'employee_access_revocations').select('*').eq('session_id', session.id),
    fromUnknownTable(supabase, 'employee_final_clearance').select('*').eq('session_id', session.id).maybeSingle(),
    fromUnknownTable(supabase, 'offboarding_audit_events')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: false }),
  ]);
  const error = checks.error ?? revocations.error ?? clearances.error ?? audits.error;
  if (error) return { ok: false, error: schemaError(error) };

  return {
    ok: true,
    data: {
      session,
      steps: (stepsResult.data ?? []).map((row) => mapStep(row as Row)),
      checks: (checks.data ?? []).map((row) => mapCheck(row as Row)),
      revocations: (revocations.data ?? []).map((row) => mapRevocation(row as Row)),
      clearance: clearances.data ? mapClearance(clearances.data as Row) : null,
      auditEvents: (audits.data ?? []).map((row) => mapAudit(row as Row)),
    },
  };
}

export async function persistEmployeeOffboardingSnapshot(
  snapshot: EmployeeOffboardingStoreSnapshot,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Live-Datenbank ist nicht verfügbar.' };
  const { session } = snapshot;
  const now = new Date().toISOString();

  const sessionWrite = await fromUnknownTable(supabase, 'employee_offboarding_sessions')
    .update({
      overall_status: session.overallStatus,
      current_step_key: session.currentStepKey,
      exit_date: session.exitDate,
      termination_type: session.terminationType,
      internal_reason: session.internalReason,
      responsible_user_id: session.responsibleUserId,
      started_at: session.startedAt,
      completed_at: session.completedAt,
      last_saved_at: now,
      updated_at: now,
    })
    .eq('id', session.id)
    .eq('tenant_id', session.tenantId);
  if (sessionWrite.error) return { ok: false, error: schemaError(sessionWrite.error) };

  if (snapshot.steps.length > 0) {
    const stepWrite = await fromUnknownTable(supabase, 'employee_offboarding_steps').upsert(
      snapshot.steps.map((step) => ({
        session_id: session.id,
        tenant_id: session.tenantId,
        employee_id: session.employeeId,
        step_key: step.stepKey,
        status: step.status,
        responsible_user_id: step.responsibleUserId,
        completed_at: step.completedAt,
        notes: step.notes,
        updated_at: now,
      })),
      { onConflict: 'session_id,step_key' },
    );
    if (stepWrite.error) return { ok: false, error: schemaError(stepWrite.error) };
  }

  const checkDelete = await fromUnknownTable(supabase, 'employee_offboarding_checks')
    .delete()
    .eq('session_id', session.id);
  if (checkDelete.error) return { ok: false, error: schemaError(checkDelete.error) };
  if (snapshot.checks.length > 0) {
    const checkWrite = await fromUnknownTable(supabase, 'employee_offboarding_checks').insert(
      snapshot.checks.map((check) => ({
        session_id: session.id,
        tenant_id: session.tenantId,
        employee_id: session.employeeId,
        check_key: check.checkKey,
        status: check.status,
        message: check.message,
        count_value: check.count,
        evaluated_at: check.evaluatedAt,
      })),
    );
    if (checkWrite.error) return { ok: false, error: schemaError(checkWrite.error) };
  }

  if (snapshot.revocations.length > 0) {
    const revocationWrite = await fromUnknownTable(supabase, 'employee_access_revocations').upsert(
      snapshot.revocations.map((entry) => ({
        session_id: session.id,
        tenant_id: session.tenantId,
        employee_id: session.employeeId,
        kind: entry.kind,
        status: entry.status,
        provider_connected: entry.providerConnected,
        prepared_at: entry.preparedAt,
        locked_at: entry.lockedAt,
        actor_id: entry.actorId,
        notes: entry.notes,
        updated_at: now,
      })),
      { onConflict: 'session_id,kind' },
    );
    if (revocationWrite.error) return { ok: false, error: schemaError(revocationWrite.error) };
  }

  if (snapshot.clearance) {
    const clearance = snapshot.clearance;
    const clearanceWrite = await fromUnknownTable(supabase, 'employee_final_clearance').upsert(
      {
        session_id: session.id,
        tenant_id: session.tenantId,
        employee_id: session.employeeId,
        cleared_by: clearance.clearedBy,
        cleared_at: clearance.clearedAt,
        protocol_document_id: clearance.protocolDocumentId,
        protocol_generated_at: clearance.protocolGeneratedAt,
        archived_at: clearance.archivedAt,
        employment_status_after: clearance.employmentStatusAfter,
        notes: clearance.notes,
        updated_at: now,
      },
      { onConflict: 'session_id' },
    );
    if (clearanceWrite.error) return { ok: false, error: schemaError(clearanceWrite.error) };
  }

  const newAuditEvents = snapshot.auditEvents.filter((event) => event.id.startsWith('offb-audit-'));
  if (newAuditEvents.length > 0) {
    const auditWrite = await fromUnknownTable(supabase, 'offboarding_audit_events').insert(
      newAuditEvents.map((event) => ({
        tenant_id: event.tenantId,
        session_id: session.id,
        employee_id: event.employeeId,
        action: event.action,
        step_key: event.stepKey ?? null,
        detail: event.detail,
        actor_id: event.actorId,
        created_at: event.createdAt,
      })),
    );
    if (auditWrite.error) return { ok: false, error: schemaError(auditWrite.error) };
  }

  return { ok: true, data: undefined };
}
