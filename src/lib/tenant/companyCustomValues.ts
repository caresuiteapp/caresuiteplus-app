import type { PermissionKey, RoleKey, ServiceResult } from '@/types';
import type { TenantCustomFieldDefinition } from '@/types/tenant/tenantCenter';
import { enforcePermission } from '@/lib/permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

export type CompanyCustomValueScope = { tenantId: string; roleKey: RoleKey | null; effectivePermissions?: readonly PermissionKey[] };
export type CompanyCustomValue = { definitionId: string; value: string | number | boolean | null; updatedAt: string | null };
export type CompanyCustomValuesResult<T> = ServiceResult<T> & { reloadRequired?: boolean };
type Row = Record<string, unknown>;
const columns = 'id,field_key,label,data_type,module_key,function_key,visibility,validation,is_active,sort_order';
const scalar = (value: unknown): value is CompanyCustomValue['value'] => value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value);
const mapField = (row: Row): TenantCustomFieldDefinition => ({ id: String(row.id), groupId: null, fieldKey: String(row.field_key), label: String(row.label), dataType: row.data_type as TenantCustomFieldDefinition['dataType'], moduleKey: row.module_key as TenantCustomFieldDefinition['moduleKey'], functionKey: row.function_key ? String(row.function_key) : null, visibility: row.visibility as Row ?? {}, validation: row.validation as Row ?? {}, isActive: row.is_active === true, sortOrder: Number(row.sort_order ?? 0) });

export function canEditCompanyCustomValue(field: TenantCustomFieldDefinition) {
  return Boolean(field.id && field.isActive && field.visibility.office === true && field.visibility.protected !== true && field.visibility.sensitive !== true && field.visibility.private !== true);
}
export function companyCustomValueOptions(field: TenantCustomFieldDefinition): { value: string; label: string }[] {
  if (!Array.isArray(field.validation.options)) return [];
  return field.validation.options.flatMap((option: unknown) => {
    if (typeof option === 'string' || typeof option === 'number') return [{ value: String(option), label: String(option) }];
    if (option && typeof option === 'object') { const row = option as Row; const value = typeof row.value === 'string' || typeof row.value === 'number' ? String(row.value) : typeof row.label === 'string' ? row.label : null; return value === null ? [] : [{ value, label: typeof row.label === 'string' ? row.label : value }]; }
    return [];
  });
}
export function parseCompanyCustomValue(field: TenantCustomFieldDefinition, raw: string): ServiceResult<CompanyCustomValue['value']> {
  const value = field.dataType === 'multiline' ? raw.trimEnd() : raw.trim();
  if (!value.trim()) return field.validation.required === true ? { ok: false, error: 'Bitte füllen Sie dieses Pflichtfeld aus.' } : { ok: true, data: null };
  if (field.dataType === 'boolean') return ['true', 'false'].includes(value) ? { ok: true, data: value === 'true' } : { ok: false, error: 'Bitte Ja oder Nein auswählen.' };
  if (field.dataType === 'number') {
    if (!/^-?\d+(?:[.,]\d+)?$/.test(value)) return { ok: false, error: 'Bitte eine gültige Zahl eingeben.' };
    const number = Number(value.replace(',', '.'));
    if (!Number.isFinite(number) || typeof field.validation.min === 'number' && number < field.validation.min || typeof field.validation.max === 'number' && number > field.validation.max) return { ok: false, error: 'Die Zahl liegt außerhalb des erlaubten Bereichs.' };
    return { ok: true, data: number };
  }
  if (field.dataType === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(new Date(`${value}T12:00:00Z`).getTime()) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value)) return { ok: false, error: 'Bitte ein gültiges Datum eingeben.' };
  if (field.dataType === 'select' && !companyCustomValueOptions(field).some(option => option.value === value)) return { ok: false, error: 'Bitte eine der hinterlegten Möglichkeiten auswählen.' };
  const maxLength = typeof field.validation.maxLength === 'number' ? Math.min(10000, field.validation.maxLength) : 10000;
  if (value.length > maxLength) return { ok: false, error: `Höchstens ${maxLength} Zeichen sind möglich.` };
  if (!['text', 'multiline', 'date', 'select'].includes(field.dataType)) return { ok: false, error: 'Diese Eingabeart wird nicht unterstützt.' };
  return { ok: true, data: value };
}
function guard<T>(scope: CompanyCustomValueScope): ServiceResult<T> | null {
  const tenant = guardServiceTenant(scope.tenantId); if (tenant) return tenant;
  const denied = enforcePermission<T>(scope.roleKey, 'business.tenant.manage', { effectivePermissions: scope.effectivePermissions }); if (denied) return denied;
  return isLiveServiceMode() ? null : { ok: false, error: 'Eigene Unternehmensangaben benötigen eine aktive Datenverbindung.' };
}
export async function loadCompanyCustomValues(scope: CompanyCustomValueScope, fieldIds: readonly string[]): Promise<ServiceResult<CompanyCustomValue[]>> {
  const denied = guard<CompanyCustomValue[]>(scope); if (denied) return denied;
  if (!fieldIds.length) return { ok: true, data: [] };
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Datenverbindung nicht verfügbar.' };
  try {
    const definitions = await fromUnknownTable(client, 'tenant_custom_field_definitions').select(columns).eq('tenant_id', scope.tenantId).in('id', [...fieldIds]);
    if (definitions.error) return { ok: false, error: toGermanSupabaseError(definitions.error) };
    const allowed = (definitions.data ?? []).map(mapField).filter(canEditCompanyCustomValue).map(field => field.id!);
    if (!allowed.length) return { ok: true, data: [] };
    const values = await fromUnknownTable(client, 'tenant_custom_field_values').select('definition_id,value,updated_at').eq('tenant_id', scope.tenantId).in('definition_id', allowed);
    if (values.error) return { ok: false, error: toGermanSupabaseError(values.error) };
    const rows = new Map((values.data ?? []).map(row => [String(row.definition_id), row]));
    if ([...rows.values()].some(row => !scalar(row.value))) return { ok: false, error: 'Eine eigene Angabe hat ein unbekanntes Format. Bitte die Felddefinition prüfen.' };
    return { ok: true, data: allowed.map(definitionId => { const row = rows.get(definitionId); return { definitionId, value: row?.value as CompanyCustomValue['value'] ?? null, updatedAt: row?.updated_at ? String(row.updated_at) : null }; }) };
  } catch { return { ok: false, error: 'Eigene Angaben konnten nicht geladen werden.' }; }
}
export async function saveCompanyCustomValue(scope: CompanyCustomValueScope, definitionId: string, raw: string, expectedUpdatedAt: string | null): Promise<CompanyCustomValuesResult<CompanyCustomValue>> {
  const denied = guard<CompanyCustomValue>(scope); if (denied) return denied;
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Datenverbindung nicht verfügbar.' };
  let writeStarted = false;
  try {
    const definition = await fromUnknownTable(client, 'tenant_custom_field_definitions').select(columns).eq('tenant_id', scope.tenantId).eq('id', definitionId).maybeSingle();
    if (definition.error) return { ok: false, error: toGermanSupabaseError(definition.error) };
    if (!definition.data || !canEditCompanyCustomValue(mapField(definition.data))) return { ok: false, error: 'Dieses Unternehmensfeld ist nicht mehr zur Bearbeitung freigegeben.' };
    const value = parseCompanyCustomValue(mapField(definition.data), raw); if (!value.ok) return value;
    const table = fromUnknownTable(client, 'tenant_custom_field_values');
    writeStarted = true;
    const mutation = expectedUpdatedAt
      ? table.update({ value: value.data, updated_at: new Date().toISOString() }).eq('tenant_id', scope.tenantId).eq('definition_id', definitionId).eq('updated_at', expectedUpdatedAt)
      : table.insert({ tenant_id: scope.tenantId, definition_id: definitionId, value: value.data });
    const result = await mutation.select('definition_id,value,updated_at').maybeSingle();
    if (result.error || !result.data || result.data.definition_id !== definitionId || !scalar(result.data.value) || typeof result.data.updated_at !== 'string' || !result.data.updated_at) return { ok: false, reloadRequired: true, error: 'Die Änderung konnte nicht bestätigt werden. Bitte laden Sie die Angaben neu, bevor Sie erneut speichern.' };
    return { ok: true, data: { definitionId: String(result.data.definition_id), value: result.data.value, updatedAt: String(result.data.updated_at) } };
  } catch { return { ok: false, reloadRequired: writeStarted, error: 'Die Angabe konnte nicht gespeichert werden. Bitte laden Sie den aktuellen Stand neu.' }; }
}
