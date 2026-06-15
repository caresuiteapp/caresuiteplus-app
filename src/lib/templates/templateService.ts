import type { RoleKey, ServiceResult } from '@/types';
import type {
  CareSuiteTemplate,
  CreateTemplateInput,
  TemplateDashboardStats,
  TemplateListFilters,
  TemplateModuleKey,
  TemplateType,
  TemplateUsageLog,
  TenantTemplateSettings,
  UpdateTemplateInput,
} from '@/types/templates';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { renderTemplateWithVariables as renderVars } from './templateVariables';
import { TEMPLATE_EDIT_PERMISSION, TEMPLATE_VIEW_PERMISSION } from './templatePermissions';
import { catalogDemoRepository, templateDemoRepository } from './templateRepository.demo';
import { catalogSupabaseRepository, templateSupabaseRepository } from './templateRepository.supabase';

function repo() {
  return getServiceMode() === 'supabase' ? templateSupabaseRepository : templateDemoRepository;
}

async function demoDelay(ms = 120): Promise<void> {
  if (getServiceMode() === 'demo') {
    await new Promise((r) => setTimeout(r, ms));
  }
}

export async function listTemplates(
  tenantId: string,
  filters: TemplateListFilters = {},
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareSuiteTemplate[]>> {
  const denied = enforcePermission<CareSuiteTemplate[]>(actorRoleKey, TEMPLATE_VIEW_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  await demoDelay();
  return repo().list(tenantId, filters);
}

export async function getTemplate(
  tenantId: string,
  templateId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareSuiteTemplate>> {
  const denied = enforcePermission<CareSuiteTemplate>(actorRoleKey, TEMPLATE_VIEW_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  await demoDelay();
  const result = await repo().getById(tenantId, templateId);
  if (!result.ok) return result;
  if (!result.data) return { ok: false, error: 'Vorlage nicht gefunden.' };
  return { ok: true, data: result.data };
}

export async function createTemplate(
  tenantId: string,
  input: CreateTemplateInput,
  actorRoleKey?: RoleKey | null,
  createdBy?: string | null,
): Promise<ServiceResult<CareSuiteTemplate>> {
  const denied = enforcePermission<CareSuiteTemplate>(actorRoleKey, TEMPLATE_EDIT_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  await demoDelay(180);
  return repo().create(tenantId, input, createdBy);
}

export async function updateTemplate(
  tenantId: string,
  templateId: string,
  patch: UpdateTemplateInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareSuiteTemplate>> {
  const denied = enforcePermission<CareSuiteTemplate>(actorRoleKey, TEMPLATE_EDIT_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  await demoDelay(150);
  return repo().update(tenantId, templateId, patch);
}

export async function archiveTemplate(
  tenantId: string,
  templateId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareSuiteTemplate>> {
  const denied = enforcePermission<CareSuiteTemplate>(actorRoleKey, TEMPLATE_EDIT_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  await demoDelay(120);
  return repo().archive(tenantId, templateId);
}

export async function duplicateSystemTemplateForTenant(
  tenantId: string,
  systemTemplateId: string,
  actorRoleKey?: RoleKey | null,
  createdBy?: string | null,
): Promise<ServiceResult<CareSuiteTemplate>> {
  const denied = enforcePermission<CareSuiteTemplate>(actorRoleKey, TEMPLATE_EDIT_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  await demoDelay(200);
  return repo().duplicateSystemForTenant(tenantId, systemTemplateId, createdBy);
}

export async function listTemplatesByModule(
  tenantId: string,
  moduleKey: TemplateModuleKey,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareSuiteTemplate[]>> {
  return listTemplates(tenantId, { moduleKey, status: 'active' }, actorRoleKey);
}

export async function listTemplatesByType(
  tenantId: string,
  templateType: TemplateType,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareSuiteTemplate[]>> {
  return listTemplates(tenantId, { templateType, status: 'active' }, actorRoleKey);
}

export async function searchTemplates(
  tenantId: string,
  query: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareSuiteTemplate[]>> {
  return listTemplates(tenantId, { search: query }, actorRoleKey);
}

export function renderTemplateWithVariables(
  content: string,
  variables: Record<string, string>,
): string {
  return renderVars(content, variables);
}

export async function logTemplateUsage(
  tenantId: string,
  templateId: string,
  moduleKey: TemplateModuleKey,
  context?: string | null,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TemplateUsageLog>> {
  const denied = enforcePermission<TemplateUsageLog>(actorRoleKey, TEMPLATE_VIEW_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo().logUsage(tenantId, templateId, moduleKey, context);
}

export async function getTemplateDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TemplateDashboardStats>> {
  const denied = enforcePermission<TemplateDashboardStats>(actorRoleKey, TEMPLATE_VIEW_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  await demoDelay();
  return repo().getDashboardStats(tenantId);
}

export async function getTenantTemplateSettings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantTemplateSettings>> {
  const denied = enforcePermission<TenantTemplateSettings>(actorRoleKey, TEMPLATE_VIEW_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo().getSettings(tenantId);
}

export async function updateTenantTemplateSettings(
  tenantId: string,
  patch: Partial<Omit<TenantTemplateSettings, 'tenantId'>>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantTemplateSettings>> {
  const denied = enforcePermission<TenantTemplateSettings>(actorRoleKey, TEMPLATE_EDIT_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo().updateSettings(tenantId, patch);
}

export { catalogDemoRepository, catalogSupabaseRepository };
