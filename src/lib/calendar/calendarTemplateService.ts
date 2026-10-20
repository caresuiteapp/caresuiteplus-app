import type { RoleKey, ServiceResult } from '@/types';

import type { CalendarEventTemplate, CalendarModuleKey } from '@/types/calendar';

import {

  getSystemTemplatesForModule,

  SYSTEM_CALENDAR_TEMPLATES,

} from '@/data/calendar/defaultTemplates';

import { getSupabaseClient } from '@/lib/supabase/client';

import { isSupabaseRlsError, toGermanSupabaseError } from '@/lib/supabase/errors';

import { fromUnknownTable } from '@/lib/supabase/untypedTable';

import { isMissingTableError } from '@/lib/supabase/missingtablefallback';



function mapTemplateRow(row: Record<string, unknown>): CalendarEventTemplate {

  return {

    id: String(row.id),

    tenantId: row.tenant_id ? String(row.tenant_id) : null,

    moduleKey: row.module_key as CalendarModuleKey,

    templateKey: String(row.template_key),

    label: String(row.label),

    description: row.description ? String(row.description) : null,

    sourceType: row.source_type as CalendarEventTemplate['sourceType'],

    eventType: row.event_type as CalendarEventTemplate['eventType'],

    defaultDurationMinutes: Number(row.default_duration_minutes ?? 60),

    allDay: Boolean(row.all_day),

    isSystem: Boolean(row.is_system),

    isActive: row.is_active !== false,

    roleKeys: Array.isArray(row.role_keys) ? (row.role_keys as string[]) : [],

    fieldSchema: Array.isArray(row.field_schema)

      ? (row.field_schema as CalendarEventTemplate['fieldSchema'])

      : [],

    createdAt: String(row.created_at ?? new Date().toISOString()),

    updatedAt: String(row.updated_at ?? new Date().toISOString()),

  };

}



function filterByRole(

  templates: CalendarEventTemplate[],

  roleKey?: RoleKey | null,

): CalendarEventTemplate[] {

  if (!roleKey) return templates;

  return templates.filter(

    (t) => t.roleKeys.length === 0 || t.roleKeys.includes(roleKey),

  );

}



function resolveModuleFilter(moduleKey: CalendarModuleKey): CalendarModuleKey {

  return moduleKey === 'all' ? 'office' : moduleKey;

}



function isRecoverableTemplateQueryError(error: unknown): boolean {

  return isMissingTableError(error) || isSupabaseRlsError(error);

}



function mergeTemplates(

  systemFromDb: CalendarEventTemplate[],

  fallbackSystem: CalendarEventTemplate[],

  tenantCustom: CalendarEventTemplate[],

  moduleKey: CalendarModuleKey,

): CalendarEventTemplate[] {

  const resolved = resolveModuleFilter(moduleKey);

  const system = systemFromDb.length > 0 ? systemFromDb : fallbackSystem;

  const systemKeys = new Set(system.map((t) => t.templateKey));

  const custom = tenantCustom.filter((t) => !systemKeys.has(t.templateKey));

  return [...system, ...custom].filter(

    (t) => moduleKey === 'all' || t.moduleKey === resolved || t.moduleKey === moduleKey,

  );

}



export async function listTemplates(

  moduleKey: CalendarModuleKey,

  tenantId?: string | null,

  roleKey?: RoleKey | null,

): Promise<ServiceResult<CalendarEventTemplate[]>> {

  const fallbackSystem = getSystemTemplatesForModule(moduleKey);

  const resolved = resolveModuleFilter(moduleKey);



  const supabase = getSupabaseClient();

  if (!supabase) {

    return { ok: true, data: filterByRole(fallbackSystem, roleKey) };

  }



  let systemQuery = fromUnknownTable(supabase, 'calendar_event_templates')

    .select('*')

    .eq('is_active', true)

    .eq('is_system', true)

    .is('tenant_id', null)

    .order('label', { ascending: true });



  if (moduleKey !== 'all') {

    systemQuery = systemQuery.eq('module_key', resolved);

  }



  const { data: systemData, error: systemError } = await systemQuery;



  if (systemError && !isRecoverableTemplateQueryError(systemError)) {

    return { ok: false, error: toGermanSupabaseError(systemError) };

  }



  const systemFromDb = (systemError ? [] : (systemData ?? [])).map((row) =>

    mapTemplateRow(row as Record<string, unknown>),

  );



  let tenantCustom: CalendarEventTemplate[] = [];

  if (tenantId) {

    let tenantQuery = fromUnknownTable(supabase, 'calendar_event_templates')

      .select('*')

      .eq('is_active', true)

      .eq('tenant_id', tenantId)

      .eq('is_system', false)

      .order('label', { ascending: true });



    if (moduleKey !== 'all') {

      tenantQuery = tenantQuery.eq('module_key', resolved);

    }



    const { data: tenantData, error: tenantError } = await tenantQuery;



    if (tenantError && !isRecoverableTemplateQueryError(tenantError)) {

      return { ok: false, error: toGermanSupabaseError(tenantError) };

    }

    tenantCustom = (tenantError ? [] : (tenantData ?? [])).map((row) =>

      mapTemplateRow(row as Record<string, unknown>),

    );

  }



  const merged = mergeTemplates(systemFromDb, fallbackSystem, tenantCustom, moduleKey);

  return { ok: true, data: filterByRole(merged, roleKey) };

}



export async function seedSystemCalendarTemplates(

  tenantId: string,

): Promise<ServiceResult<number>> {

  const supabase = getSupabaseClient();

  if (!supabase) {

    return { ok: true, data: SYSTEM_CALENDAR_TEMPLATES.length };

  }



  const payloads = SYSTEM_CALENDAR_TEMPLATES.map((t) => ({

    tenant_id: null,

    module_key: t.moduleKey,

    template_key: t.templateKey,

    label: t.label,

    description: t.description,

    source_type: t.sourceType,

    event_type: t.eventType,

    default_duration_minutes: t.defaultDurationMinutes,

    all_day: t.allDay,

    is_system: true,

    is_active: true,

    role_keys: t.roleKeys,

    field_schema: t.fieldSchema,

  }));



  const { error } = await fromUnknownTable(supabase, 'calendar_event_templates').upsert(

    payloads,

    { onConflict: 'module_key,template_key', ignoreDuplicates: true },

  );



  if (error) {

    if (isRecoverableTemplateQueryError(error)) {

      return { ok: true, data: SYSTEM_CALENDAR_TEMPLATES.length };

    }

    return { ok: false, error: toGermanSupabaseError(error) };

  }



  void tenantId;

  return { ok: true, data: SYSTEM_CALENDAR_TEMPLATES.length };

}



export async function createTenantTemplate(

  tenantId: string,

  template: Omit<CalendarEventTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isSystem' | 'tenantId'>,

): Promise<ServiceResult<CalendarEventTemplate>> {

  const supabase = getSupabaseClient();

  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };



  const payload = {

    tenant_id: tenantId,

    module_key: template.moduleKey,

    template_key: template.templateKey,

    label: template.label,

    description: template.description,

    source_type: template.sourceType,

    event_type: template.eventType,

    default_duration_minutes: template.defaultDurationMinutes,

    all_day: template.allDay,

    is_system: false,

    is_active: true,

    role_keys: template.roleKeys,

    field_schema: template.fieldSchema,

  };



  const { data, error } = await fromUnknownTable(supabase, 'calendar_event_templates')

    .insert(payload)

    .select('*')

    .single();



  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  return { ok: true, data: mapTemplateRow(data as Record<string, unknown>) };

}



export async function updateTenantTemplate(

  tenantId: string,

  templateId: string,

  patch: Partial<Pick<CalendarEventTemplate, 'label' | 'description' | 'isActive' | 'fieldSchema'>>,

): Promise<ServiceResult<CalendarEventTemplate>> {

  const supabase = getSupabaseClient();

  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };



  const { data, error } = await fromUnknownTable(supabase, 'calendar_event_templates')

    .update({

      label: patch.label,

      description: patch.description,

      is_active: patch.isActive,

      field_schema: patch.fieldSchema,

      updated_at: new Date().toISOString(),

    })

    .eq('tenant_id', tenantId)

    .eq('id', templateId)

    .eq('is_system', false)

    .select('*')

    .single();



  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  return { ok: true, data: mapTemplateRow(data as Record<string, unknown>) };

}



export async function deleteTenantTemplate(

  tenantId: string,

  templateId: string,

): Promise<ServiceResult<void>> {

  const supabase = getSupabaseClient();

  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };



  const { error } = await fromUnknownTable(supabase, 'calendar_event_templates')

    .update({ is_active: false, updated_at: new Date().toISOString() })

    .eq('tenant_id', tenantId)

    .eq('id', templateId)

    .eq('is_system', false);



  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  return { ok: true, data: undefined };

}

