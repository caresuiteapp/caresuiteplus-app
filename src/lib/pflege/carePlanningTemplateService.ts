import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import type { RoleKey, ServiceResult } from '@/types';
import { readCompleteCarePlanRows } from './carePlanCompleteRead';
import type { CarePlanningDomain, CarePlanningModel, CarePlanningSetting } from './carePlanningModels';
import type { CarePlanningTemplate, PlanningTemplateKind } from './carePlanningTemplates';

type Scope = { tenantId: string; role: RoleKey | null | undefined; setting: CarePlanningSetting };

function denied<T>({ tenantId, role, setting }: Scope, write = false): ServiceResult<T> | null {
  const readPermission = setting === 'ambulant' ? 'pflege.plans.view' : 'stationaer.residents.view';
  const writePermission = setting === 'ambulant' ? 'pflege.plans.manage' : 'stationaer.assessments.manage';
  return enforcePermission<T>(role, readPermission) ?? (write ? enforcePermission<T>(role, writePermission) : null) ?? guardServiceTenant(tenantId);
}

function mapTemplate(row: Record<string, unknown>): CarePlanningTemplate {
  return {
    id: String(row.id), title: String(row.title), text: String(row.body), updatedAt: String(row.updated_at),
    kind: row.kind as PlanningTemplateKind, domain: row.domain as CarePlanningDomain,
    model: row.model as CarePlanningModel, setting: row.setting as CarePlanningSetting,
  };
}

export async function fetchOwnPlanningTemplates(scope: Scope, model: CarePlanningModel): Promise<ServiceResult<CarePlanningTemplate[]>> {
  const block = denied<CarePlanningTemplate[]>(scope);
  if (block) return block;
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Der eigene Vorlagenkatalog ist nicht verbunden.' };
  const records = await readCompleteCarePlanRows(
    (first, last) => fromUnknownTable(client, 'care_planning_templates').select('*', { count: 'exact' })
      .eq('tenant_id', scope.tenantId).eq('setting', scope.setting).eq('model', model)
      .order('title').order('id').range(first, last),
    row => row.tenant_id === scope.tenantId && row.setting === scope.setting && row.model === model,
  );
  return records.ok ? { ok: true, data: records.data.map(mapTemplate) } : records;
}

export async function saveOwnPlanningTemplate(scope: Scope, template: CarePlanningTemplate): Promise<ServiceResult<CarePlanningTemplate>> {
  const block = denied<CarePlanningTemplate>(scope, true);
  if (block) return block;
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Der eigene Vorlagenkatalog ist nicht verbunden.' };
  const title = template.title.trim(), body = template.text.trim();
  if (!title || !body || !template.model || template.setting !== scope.setting) {
    return { ok: false, error: 'Bezeichnung, Modell und Text ergänzen.' };
  }
  const table = fromUnknownTable(client, 'care_planning_templates');
  const content = { kind: template.kind, domain: template.domain, model: template.model, title, body };
  const write = template.updatedAt
    ? table.update(content).eq('tenant_id', scope.tenantId).eq('setting', scope.setting)
      .eq('id', template.id).eq('updated_at', template.updatedAt)
    : table.insert({ ...content, tenant_id: scope.tenantId, id: template.id, setting: scope.setting });
  const result = await write.select('*').maybeSingle();
  if (result.error) return { ok: false, error: toGermanSupabaseError(result.error) };
  if (!result.data) return { ok: false, error: 'Die Vorlage wurde inzwischen geändert oder ist nicht bearbeitbar.' };
  return { ok: true, data: mapTemplate(result.data as Record<string, unknown>) };
}
