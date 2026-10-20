import type { ServiceResult } from '@/types';
import type { CarePlanDetail, CarePlanListItem, CarePlanTask } from '@/types/modules/pflege';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

type Row = Record<string, unknown>;

export type LiveCarePlanInput = {
  id?: string | null;
  clientId: string;
  title: string;
  description: string;
  goals: string;
  resources: string;
  risks: string;
  validFrom: string;
  validUntil: string | null;
  sourceAssessmentId?: string | null;
  primaryNurseId?: string | null;
  actorName: string;
  items: {
    title: string;
    category?: string;
    description?: string;
    goal?: string;
    intervention?: string;
    frequency?: string;
    timing?: string;
    responsibleRole?: string;
    personContribution?: string;
    relativesContribution?: string;
    warningSigns?: string;
    escalationPath?: string;
    evaluationCriteria?: string;
    evaluationIntervalDays?: number | null;
    nextEvaluationAt?: string | null;
    status?: string;
    sortOrder?: number;
    notes?: string;
  }[];
};

const unavailable = <T>(): ServiceResult<T> => ({
  ok: false,
  error: SERVICE_ERRORS.supabaseUnavailable,
});

function mapStatus(value: unknown): CarePlanListItem['status'] {
  switch (String(value ?? 'draft')) {
    case 'active':
    case 'aktiv': return 'aktiv';
    case 'completed':
    case 'abgeschlossen': return 'abgeschlossen';
    case 'paused':
    case 'gesperrt': return 'gesperrt';
    case 'archived':
    case 'archiviert': return 'archiviert';
    case 'entwurf':
    case 'draft':
    default: return 'entwurf';
  }
}

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

function mapTask(row: Row): CarePlanTask {
  return {
    id: text(row.id),
    label: text(row.title),
    frequency: text(row.frequency) || text(row.timing) || 'Individuell',
    status: mapStatus(row.status),
    category: text(row.category),
    goal: text(row.goal),
    intervention: text(row.intervention) || text(row.description),
    timing: text(row.timing),
    responsibleRole: text(row.responsible_role),
    warningSigns: text(row.warning_signs),
    escalationPath: text(row.escalation_path),
    evaluationCriteria: text(row.evaluation_criteria),
    nextEvaluationAt: row.next_evaluation_date ? text(row.next_evaluation_date) : null,
  };
}

async function loadReferences(
  tenantId: string,
  plans: Row[],
): Promise<ServiceResult<{
  clients: Map<string, Row>;
  employees: Map<string, Row>;
  items: Row[];
}>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();
  const clientIds = [...new Set(plans.map((row) => text(row.client_id)).filter(Boolean))];
  const employeeIds = [...new Set(plans.map((row) => text(row.primary_nurse_id)).filter(Boolean))];
  const planIds = plans.map((row) => text(row.id)).filter(Boolean);

  const [clientResult, employeeResult, itemResult] = await Promise.all([
    clientIds.length
      ? fromUnknownTable(supabase, 'clients')
          .select('id,first_name,last_name,city,care_level,status')
          .eq('tenant_id', tenantId)
          .in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    employeeIds.length
      ? fromUnknownTable(supabase, 'employees')
          .select('id,first_name,last_name')
          .eq('tenant_id', tenantId)
          .in('id', employeeIds)
      : Promise.resolve({ data: [], error: null }),
    planIds.length
      ? fromUnknownTable(supabase, 'care_plan_items')
          .select('*')
          .eq('tenant_id', tenantId)
          .in('care_plan_id', planIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error = clientResult.error ?? employeeResult.error ?? itemResult.error;
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return {
    ok: true,
    data: {
      clients: new Map(((clientResult.data ?? []) as Row[]).map((row) => [text(row.id), row])),
      employees: new Map(((employeeResult.data ?? []) as Row[]).map((row) => [text(row.id), row])),
      items: (itemResult.data ?? []) as Row[],
    },
  };
}

function mapListItem(row: Row, clients: Map<string, Row>, items: Row[]): CarePlanListItem {
  const client = clients.get(text(row.client_id));
  const planItems = items.filter((item) => text(item.care_plan_id) === text(row.id));
  return {
    id: text(row.id),
    tenantId: text(row.tenant_id),
    title: text(row.title),
    validFrom: text(row.valid_from) || text(row.created_at),
    validUntil: row.valid_until ? text(row.valid_until) : null,
    status: mapStatus(row.status),
    clientId: text(row.client_id),
    updatedAt: text(row.updated_at),
    clientName: client
      ? `${text(client.first_name)} ${text(client.last_name)}`.trim() || '—'
      : '—',
    careLevel: client?.care_level ? text(client.care_level) : null,
    alertCount: planItems.filter((item) => {
      const due = item.next_evaluation_date ? Date.parse(text(item.next_evaluation_date)) : Number.POSITIVE_INFINITY;
      return !['completed', 'archived'].includes(text(item.status)) && due <= Date.now();
    }).length,
  };
}

export const carePlanLiveRepository = {
  async list(tenantId: string): Promise<ServiceResult<CarePlanListItem[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'care_plans')
      .select('*')
      .eq('tenant_id', tenantId)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const plans = (data ?? []) as Row[];
    const references = await loadReferences(tenantId, plans);
    if (!references.ok) return references;
    return {
      ok: true,
      data: plans.map((row) => mapListItem(row, references.data.clients, references.data.items)),
    };
  },

  async get(tenantId: string, id: string): Promise<ServiceResult<CarePlanDetail | null>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'care_plans')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: true, data: null };
    const row = data as Row;
    const references = await loadReferences(tenantId, [row]);
    if (!references.ok) return references;
    const client = references.data.clients.get(text(row.client_id));
    const employee = references.data.employees.get(text(row.primary_nurse_id));
    const list = mapListItem(row, references.data.clients, references.data.items);
    const [diagnosisResult, orderResult] = await Promise.all([
      fromUnknownTable(supabase, 'care_diagnoses')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('client_id', list.clientId).eq('status', 'active'),
      fromUnknownTable(supabase, 'care_medical_orders')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('client_id', list.clientId).eq('status', 'active'),
    ]);
    if (diagnosisResult.error || orderResult.error) {
      return { ok: false, error: toGermanSupabaseError(diagnosisResult.error ?? orderResult.error) };
    }
    return {
      ok: true,
      data: {
        ...list,
        primaryNurseId: row.primary_nurse_id ? text(row.primary_nurse_id) : null,
        sensitivity: 'health',
        visibility: 'team',
        summary: text(row.description),
        goals: text(row.goals),
        resources: text(row.resources),
        risks: text(row.risks),
        assessmentId: row.source_assessment_id ? text(row.source_assessment_id) : null,
        version: Number(row.version ?? 1),
        reviewDueAt: row.review_due_at ? text(row.review_due_at) : null,
        approvedAt: row.approved_at ? text(row.approved_at) : null,
        approvedByName: text(row.approved_by_name),
        tasks: references.data.items
          .filter((item) => text(item.care_plan_id) === id)
          .map(mapTask),
        createdAt: text(row.created_at),
        city: client ? text(client.city) || '—' : '—',
        employeeName: employee
          ? `${text(employee.first_name)} ${text(employee.last_name)}`.trim() || '—'
          : 'Nicht zugewiesen',
        nextActionHint: list.alertCount > 0
          ? `${list.alertCount} Maßnahme(n) müssen evaluiert werden.`
          : 'Pflegeplan ist fachlich aktuell.',
        dueVitalsCount: 0,
        diagnosisCount: diagnosisResult.count ?? 0,
        activeOrderCount: orderResult.count ?? 0,
      },
    };
  },

  async save(tenantId: string, input: LiveCarePlanInput): Promise<ServiceResult<{ id: string }>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const rpc = supabase as unknown as {
      rpc: (name: string, params: Record<string, unknown>) => Promise<{
        data: Row | null;
        error: Parameters<typeof toGermanSupabaseError>[0];
      }>;
    };
    const { data, error } = await rpc.rpc('save_live_care_plan', {
      p_plan_id: input.id ?? null,
      p_client_id: input.clientId,
      p_title: input.title.trim(),
      p_description: input.description.trim(),
      p_goals: input.goals.trim(),
      p_resources: input.resources.trim(),
      p_risks: input.risks.trim(),
      p_valid_from: input.validFrom,
      p_valid_until: input.validUntil,
      p_source_assessment_id: input.sourceAssessmentId ?? null,
      p_primary_nurse_id: input.primaryNurseId ?? null,
      p_actor_name: input.actorName,
      p_items: input.items,
    });
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    const id = text(data.id);
    const readback = await this.get(tenantId, id);
    if (!readback.ok) return readback;
    if (!readback.data) return { ok: false, error: 'Pflegeplan wurde nicht zurückgelesen.' };
    return { ok: true, data: { id } };
  },
};
