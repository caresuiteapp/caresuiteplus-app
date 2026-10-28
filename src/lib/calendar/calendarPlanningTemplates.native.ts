// Generated native presentation from src/lib/calendar/calendarPlanningTemplates.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey, ServiceResult } from '@/types';
import type { CalendarEventTemplate, CalendarModuleKey } from '@/types/calendar';
import { SYSTEM_CALENDAR_TEMPLATES } from '@/data/calendar/defaultTemplates';
import { getSupabaseClient } from "../supabase/client.ts";
import { isSupabaseMissingTableError, isSupabaseRlsError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
const STANDARD_DATE = '2026-10-17T00:00:00.000Z';
const ASSIST_PLANNING_TEMPLATES = ([
    { templateKey: 'assist_termin', label: 'Termin', description: 'Ein persönlicher Termin mit Ort und Beteiligten.', eventType: 'termin', defaultDurationMinutes: 60, allDay: false },
    { templateKey: 'assist_besprechung', label: 'Besprechung', description: 'Ein Teamgespräch oder eine gemeinsame Besprechung.', eventType: 'besprechung', defaultDurationMinutes: 45, allDay: false },
    { templateKey: 'assist_erinnerung', label: 'Erinnerung', description: 'Eine Erinnerung für einen bestimmten Kalendertag.', eventType: 'erinnerung', defaultDurationMinutes: 1440, allDay: true },
    { templateKey: 'assist_rueckruf', label: 'Rückruf', description: 'Ein kurzer Telefontermin oder vereinbarter Rückruf.', eventType: 'termin', defaultDurationMinutes: 15, allDay: false },
] satisfies Pick<CalendarEventTemplate, 'templateKey' | 'label' | 'description' | 'eventType' | 'defaultDurationMinutes' | 'allDay'>[]).map<CalendarEventTemplate>(template => ({
    ...template,
    id: `sys-${template.templateKey.replace(/_/g, '-')}`,
    moduleKey: 'assist', tenantId: null, sourceType: 'custom_event',
    isSystem: true, isActive: true, roleKeys: [],
    fieldSchema: [{ key: 'title', label: 'Titel', type: 'text', required: true }],
    createdAt: STANDARD_DATE, updatedAt: STANDARD_DATE,
}));
const templateIdentity = (template: CalendarEventTemplate) => `${template.moduleKey}:${template.templateKey}`;
const matchesModule = (template: CalendarEventTemplate, moduleKey: CalendarModuleKey) => moduleKey === 'all' || template.moduleKey === moduleKey;
const isPlanningTemplate = (template: CalendarEventTemplate) => template.sourceType !== 'assist_visit' && template.sourceType !== 'absence';
const isMissingTemplateTable = (error: unknown) => !isSupabaseRlsError(error)
    && (isSupabaseMissingTableError(error) || (error as {
        code?: string;
    } | null)?.code === '42P01');
/** Catalog metadata; the reader applies the current user's role restrictions. */
export function getDefaultCalendarPlanningTemplates(moduleKey: CalendarModuleKey = 'all'): CalendarEventTemplate[] {
    return [...SYSTEM_CALENDAR_TEMPLATES, ...ASSIST_PLANNING_TEMPLATES]
        .filter(template => matchesModule(template, moduleKey) && template.isActive && isPlanningTemplate(template));
}
function mapTemplate(row: Record<string, unknown>): CalendarEventTemplate {
    const duration = Number(row.default_duration_minutes ?? 60);
    return {
        id: String(row.id), tenantId: row.tenant_id ? String(row.tenant_id) : null,
        moduleKey: row.module_key as CalendarModuleKey, templateKey: String(row.template_key),
        label: String(row.label), description: row.description ? String(row.description) : null,
        sourceType: row.source_type as CalendarEventTemplate['sourceType'], eventType: row.event_type as CalendarEventTemplate['eventType'],
        defaultDurationMinutes: Number.isFinite(duration) && duration > 0 ? duration : 60,
        allDay: row.all_day === true, isSystem: row.is_system === true, isActive: row.is_active !== false,
        roleKeys: Array.isArray(row.role_keys) ? row.role_keys as string[] : [],
        fieldSchema: Array.isArray(row.field_schema) ? row.field_schema as CalendarEventTemplate['fieldSchema'] : [],
        createdAt: String(row.created_at ?? STANDARD_DATE), updatedAt: String(row.updated_at ?? STANDARD_DATE),
    };
}
function mergePlanningTemplates(moduleKey: CalendarModuleKey, roleKey: RoleKey | null | undefined, systemRows: CalendarEventTemplate[] = [], customRows: CalendarEventTemplate[] = []): CalendarEventTemplate[] {
    const system = new Map<string, CalendarEventTemplate>();
    for (const template of [...SYSTEM_CALENDAR_TEMPLATES, ...ASSIST_PLANNING_TEMPLATES, ...systemRows]) {
        if (matchesModule(template, moduleKey))
            system.set(templateIdentity(template), template);
    }
    // System overrides, including deactivation and role restrictions, must be
    // applied before filtering. A partial seed must not replace the whole catalog.
    const templates = [...system.values(), ...customRows.filter(template => !system.has(templateIdentity(template)))];
    return templates.filter(template => matchesModule(template, moduleKey) && template.isActive
        && isPlanningTemplate(template)
        && (!template.roleKeys.length || Boolean(roleKey && template.roleKeys.includes(roleKey))))
        .sort((a, b) => a.label.localeCompare(b.label, 'de') || templateIdentity(a).localeCompare(templateIdentity(b)));
}
/** Templates for the ordinary Web calendar form; assignments and absences have separate workflows. */
export async function listCalendarPlanningTemplates(moduleKey: CalendarModuleKey, tenantId?: string | null, roleKey?: RoleKey | null): Promise<ServiceResult<CalendarEventTemplate[]>> {
    const client = getSupabaseClient();
    if (!client)
        return { ok: true, data: mergePlanningTemplates(moduleKey, roleKey) };
    try {
        // Include inactive system rows so their explicit settings can override defaults.
        let systemQuery = fromUnknownTable(client, 'calendar_event_templates').select('*')
            .eq('is_system', true).is('tenant_id', null).order('label', { ascending: true });
        if (moduleKey !== 'all')
            systemQuery = systemQuery.eq('module_key', moduleKey);
        const { data: systemData, error: systemError } = await systemQuery;
        if (systemError) {
            if (isMissingTemplateTable(systemError))
                return { ok: true, data: mergePlanningTemplates(moduleKey, roleKey) };
            return { ok: false, error: toGermanSupabaseError(systemError) };
        }
        const systemRows = (systemData ?? []).map(row => mapTemplate(row as Record<string, unknown>))
            .filter(template => template.isSystem && template.tenantId === null && matchesModule(template, moduleKey));
        let customRows: CalendarEventTemplate[] = [];
        if (tenantId) {
            let tenantQuery = fromUnknownTable(client, 'calendar_event_templates').select('*')
                .eq('tenant_id', tenantId).eq('is_system', false).eq('is_active', true).order('label', { ascending: true });
            if (moduleKey !== 'all')
                tenantQuery = tenantQuery.eq('module_key', moduleKey);
            const { data: tenantData, error: tenantError } = await tenantQuery;
            if (tenantError && !isMissingTemplateTable(tenantError))
                return { ok: false, error: toGermanSupabaseError(tenantError) };
            customRows = (tenantError ? [] : tenantData ?? []).map(row => mapTemplate(row as Record<string, unknown>))
                .filter(template => !template.isSystem && template.tenantId === tenantId && matchesModule(template, moduleKey));
        }
        return { ok: true, data: mergePlanningTemplates(moduleKey, roleKey, systemRows, customRows) };
    }
    catch (error) {
        return { ok: false, error: toGermanSupabaseError(error) };
    }
}
