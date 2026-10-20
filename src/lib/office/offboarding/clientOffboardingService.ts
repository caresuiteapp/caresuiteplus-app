import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { ServiceResult } from '@/types';
import type {
  ClientOffboardingAction,
  ClientOffboardingActionKey,
  ClientOffboardingCase,
  ClientOffboardingCheck,
  ClientOffboardingSummary,
  ClientPortalClosureMode,
  ClientTerminationKind,
} from '@/types/modules/clientOffboarding';

type Row = Record<string, unknown>;

const ACTION_ORDER: ClientOffboardingActionKey[] = [
  'reassign_or_cancel_assignments',
  'complete_documentation',
  'collect_or_defer_signatures',
  'prepare_final_billing',
  'notify_client_or_representative',
  'notify_cost_bearer',
  'notify_authority_if_required',
  'export_case_documents',
  'lock_portal_access',
  'create_final_protocol',
  'archive_client_record',
];

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? String(row[key]) : '';
}

function nullableText(row: Row, key: string): string | null {
  return text(row, key).trim() || null;
}

function bool(row: Row, key: string): boolean {
  return row[key] === true;
}

function numberValue(row: Row, key: string): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

function objectValue(row: Row, key: string): Record<string, unknown> {
  const value = row[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mapCase(row: Row): ClientOffboardingCase {
  return {
    id: text(row, 'id'),
    tenantId: text(row, 'tenant_id'),
    clientId: text(row, 'client_id'),
    status: text(row, 'status') as ClientOffboardingCase['status'],
    terminationKind: nullableText(row, 'termination_kind') as ClientTerminationKind | null,
    noticeDate: nullableText(row, 'notice_date'),
    effectiveDate: nullableText(row, 'effective_date'),
    lastServiceDate: nullableText(row, 'last_service_date'),
    reasonCategory: nullableText(row, 'reason_category'),
    internalReason: nullableText(row, 'internal_reason'),
    externalReason: nullableText(row, 'external_reason'),
    portalClosureMode: (nullableText(row, 'portal_closure_mode') ?? 'effective_date') as ClientPortalClosureMode,
    portalGraceUntil: nullableText(row, 'portal_grace_until'),
    legalHold: bool(row, 'legal_hold'),
    finalProtocol: row.final_protocol && typeof row.final_protocol === 'object'
      ? row.final_protocol as Record<string, unknown>
      : null,
    responsibleUserId: nullableText(row, 'responsible_user_id'),
    startedAt: nullableText(row, 'started_at'),
    completedAt: nullableText(row, 'completed_at'),
    archivedAt: nullableText(row, 'archived_at'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

function mapCheck(row: Row): ClientOffboardingCheck {
  return {
    id: text(row, 'id'),
    caseId: text(row, 'case_id'),
    tenantId: text(row, 'tenant_id'),
    clientId: text(row, 'client_id'),
    checkKey: text(row, 'check_key') as ClientOffboardingCheck['checkKey'],
    status: text(row, 'status') as ClientOffboardingCheck['status'],
    severity: text(row, 'severity') as ClientOffboardingCheck['severity'],
    message: text(row, 'message'),
    objectCount: numberValue(row, 'object_count'),
    details: objectValue(row, 'details'),
    evaluatedAt: text(row, 'evaluated_at'),
  };
}

function mapAction(row: Row): ClientOffboardingAction {
  return {
    id: text(row, 'id'),
    caseId: text(row, 'case_id'),
    tenantId: text(row, 'tenant_id'),
    clientId: text(row, 'client_id'),
    actionKey: text(row, 'action_key') as ClientOffboardingAction['actionKey'],
    status: text(row, 'status') as ClientOffboardingAction['status'],
    notes: nullableText(row, 'notes'),
    completedAt: nullableText(row, 'completed_at'),
    completedBy: nullableText(row, 'completed_by'),
    updatedAt: text(row, 'updated_at'),
  };
}

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

async function rpc(name: string, args: Record<string, unknown>): Promise<ServiceResult<Row>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Die sichere Live-Datenbank ist nicht verfügbar.' };
  const result = await (supabase as unknown as RpcClient).rpc(name, args);
  if (result.error) {
    return {
      ok: false,
      error: result.error.message ?? `Die Offboarding-Aktion ${name} ist fehlgeschlagen.`,
    };
  }
  return { ok: true, data: (result.data ?? {}) as Row };
}

function draftCase(tenantId: string, clientId: string): ClientOffboardingCase {
  const now = new Date().toISOString();
  return {
    id: `draft-${clientId}`,
    tenantId,
    clientId,
    status: 'draft',
    terminationKind: null,
    noticeDate: null,
    effectiveDate: null,
    lastServiceDate: null,
    reasonCategory: null,
    internalReason: null,
    externalReason: null,
    portalClosureMode: 'effective_date',
    portalGraceUntil: null,
    legalHold: false,
    finalProtocol: null,
    responsibleUserId: null,
    startedAt: null,
    completedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function clientName(tenantId: string, clientId: string): Promise<ServiceResult<string>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Die sichere Live-Datenbank ist nicht verfügbar.' };
  const result = await fromUnknownTable(supabase, 'clients')
    .select('id,first_name,last_name')
    .eq('tenant_id', tenantId)
    .eq('id', clientId)
    .maybeSingle();
  if (result.error) return { ok: false, error: result.error.message };
  const row = (result.data ?? null) as Row | null;
  if (!row) return { ok: false, error: 'Klient:in wurde nicht gefunden.' };
  return { ok: true, data: `${text(row, 'first_name')} ${text(row, 'last_name')}`.trim() || 'Klient:in' };
}

export async function fetchClientOffboardingSummary(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientOffboardingSummary>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Die sichere Live-Datenbank ist nicht verfügbar.' };
  const name = await clientName(tenantId, clientId);
  if (!name.ok) return name;

  const caseResult = await fromUnknownTable(supabase, 'client_offboarding_cases')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (caseResult.error) {
    const prepared = /does not exist|schema cache|PGRST205|42P01/i.test(caseResult.error.message);
    return {
      ok: false,
      error: prepared
        ? 'Das Datenbankschema für Klient:innen-Kündigung und Offboarding ist noch nicht installiert.'
        : caseResult.error.message,
    };
  }

  const caseRow = (caseResult.data ?? null) as Row | null;
  if (!caseRow) {
    return {
      ok: true,
      data: {
        clientName: name.data,
        case: draftCase(tenantId, clientId),
        checks: [],
        actions: [],
        hardBlockers: [],
        warningChecks: [],
        progressPercent: 0,
        portalLocked: false,
      },
    };
  }

  const caseData = mapCase(caseRow);
  const [checksResult, actionsResult] = await Promise.all([
    fromUnknownTable(supabase, 'client_offboarding_checks')
      .select('*')
      .eq('case_id', caseData.id)
      .order('check_key', { ascending: true }),
    fromUnknownTable(supabase, 'client_offboarding_actions')
      .select('*')
      .eq('case_id', caseData.id),
  ]);
  const error = checksResult.error || actionsResult.error;
  if (error) return { ok: false, error: error.message };

  const checks = ((checksResult.data ?? []) as Row[]).map(mapCheck);
  const actionsUnsorted = ((actionsResult.data ?? []) as Row[]).map(mapAction);
  const actions = ACTION_ORDER.map((key) => actionsUnsorted.find((entry) => entry.actionKey === key)).filter(
    (entry): entry is ClientOffboardingAction => Boolean(entry),
  );
  const completedActions = actions.filter((entry) => ['completed', 'not_applicable'].includes(entry.status)).length;
  const hardBlockers = checks.filter((entry) => entry.severity === 'required' && entry.status === 'failed');
  const warningChecks = checks.filter((entry) => entry.status === 'warning');
  const portalLocked = actions.some(
    (entry) => entry.actionKey === 'lock_portal_access' && entry.status === 'completed',
  );

  return {
    ok: true,
    data: {
      clientName: name.data,
      case: caseData,
      checks,
      actions,
      hardBlockers,
      warningChecks,
      progressPercent: actions.length > 0 ? Math.round((completedActions / actions.length) * 100) : 0,
      portalLocked,
    },
  };
}

export async function startClientOffboarding(input: {
  tenantId: string;
  clientId: string;
  terminationKind: ClientTerminationKind;
  noticeDate: string;
  effectiveDate: string;
  lastServiceDate?: string | null;
  reasonCategory: string;
  internalReason: string;
  externalReason?: string | null;
  portalClosureMode: ClientPortalClosureMode;
  portalGraceUntil?: string | null;
  legalHold?: boolean;
  actorId?: string | null;
}): Promise<ServiceResult<ClientOffboardingSummary>> {
  if (!input.noticeDate || !input.effectiveDate || !input.terminationKind || !input.reasonCategory || !input.internalReason.trim()) {
    return { ok: false, error: 'Kündigungsart, Zugang, Beendigungsdatum, Grundkategorie und interner Vermerk sind Pflichtangaben.' };
  }
  if (['ordinary_by_provider', 'extraordinary_by_provider'].includes(input.terminationKind) && !input.externalReason?.trim()) {
    return { ok: false, error: 'Bei einer Kündigung durch den Leistungserbringer ist eine sachliche externe Begründung Pflicht.' };
  }
  const result = await rpc('start_client_offboarding', {
    p_tenant_id: input.tenantId,
    p_client_id: input.clientId,
    p_termination_kind: input.terminationKind,
    p_notice_date: input.noticeDate,
    p_effective_date: input.effectiveDate,
    p_last_service_date: input.lastServiceDate || null,
    p_reason_category: input.reasonCategory,
    p_internal_reason: input.internalReason.trim(),
    p_external_reason: input.externalReason?.trim() || null,
    p_portal_closure_mode: input.portalClosureMode,
    p_portal_grace_until: input.portalGraceUntil || null,
    p_legal_hold: Boolean(input.legalHold),
    p_actor_id: input.actorId || null,
  });
  if (!result.ok) return result;
  return refreshClientOffboardingChecks(input.tenantId, input.clientId, input.actorId);
}

export async function refreshClientOffboardingChecks(
  tenantId: string,
  clientId: string,
  actorId?: string | null,
): Promise<ServiceResult<ClientOffboardingSummary>> {
  const result = await rpc('refresh_client_offboarding_checks', {
    p_tenant_id: tenantId,
    p_client_id: clientId,
    p_actor_id: actorId || null,
  });
  if (!result.ok) return result;
  return fetchClientOffboardingSummary(tenantId, clientId);
}

export async function markClientOffboardingAction(input: {
  tenantId: string;
  clientId: string;
  actionKey: ClientOffboardingActionKey;
  completed: boolean;
  notes?: string | null;
  actorId?: string | null;
}): Promise<ServiceResult<ClientOffboardingSummary>> {
  const result = await rpc('mark_client_offboarding_action', {
    p_tenant_id: input.tenantId,
    p_client_id: input.clientId,
    p_action_key: input.actionKey,
    p_status: input.completed ? 'completed' : 'pending',
    p_notes: input.notes?.trim() || null,
    p_actor_id: input.actorId || null,
  });
  if (!result.ok) return result;
  return refreshClientOffboardingChecks(input.tenantId, input.clientId, input.actorId);
}

export async function lockClientOffboardingPortalAccess(
  tenantId: string,
  clientId: string,
  actorId?: string | null,
): Promise<ServiceResult<ClientOffboardingSummary>> {
  const result = await rpc('lock_client_offboarding_portal', {
    p_tenant_id: tenantId,
    p_client_id: clientId,
    p_actor_id: actorId || null,
  });
  if (!result.ok) return result;
  return refreshClientOffboardingChecks(tenantId, clientId, actorId);
}

export async function generateClientOffboardingProtocol(
  tenantId: string,
  clientId: string,
  actorId?: string | null,
): Promise<ServiceResult<ClientOffboardingSummary>> {
  const result = await rpc('generate_client_offboarding_protocol', {
    p_tenant_id: tenantId,
    p_client_id: clientId,
    p_actor_id: actorId || null,
  });
  if (!result.ok) return result;
  return refreshClientOffboardingChecks(tenantId, clientId, actorId);
}

export async function completeClientOffboarding(
  tenantId: string,
  clientId: string,
  actorId?: string | null,
): Promise<ServiceResult<ClientOffboardingSummary>> {
  const result = await rpc('complete_client_offboarding', {
    p_tenant_id: tenantId,
    p_client_id: clientId,
    p_actor_id: actorId || null,
  });
  if (!result.ok) return result;
  return fetchClientOffboardingSummary(tenantId, clientId);
}
