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
import { enforcePermission, hasPermission } from '@/lib/permissions';
import { hasCommunicationPermission } from '@/features/communication/communication.permissions';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { renderTemplateWithVariables as renderVars } from './templateVariables';
import {
  isCommunicationMessageListQuery,
} from './communicationTemplateDefaults';
import { TEMPLATE_EDIT_PERMISSION, TEMPLATE_VIEW_PERMISSION } from './templatePermissions';
import { catalogSupabaseRepository, templateSupabaseRepository } from './templateRepository.supabase';

function repo() {
  return templateSupabaseRepository;
}

function enforceListTemplatesPermission(
  actorRoleKey: RoleKey | null | undefined,
  filters: TemplateListFilters,
): ServiceResult<CareSuiteTemplate[]> | null {
  if (hasPermission(actorRoleKey, TEMPLATE_VIEW_PERMISSION)) return null;

  if (
    isCommunicationMessageListQuery(filters) &&
    (hasCommunicationPermission(actorRoleKey, 'communication.create_thread') ||
      hasCommunicationPermission(actorRoleKey, 'communication.send_message'))
  ) {
    return null;
  }

  return enforcePermission<CareSuiteTemplate[]>(actorRoleKey, TEMPLATE_VIEW_PERMISSION);
}

export async function listTemplates(
  tenantId: string,
  filters: TemplateListFilters = {},
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareSuiteTemplate[]>> {
  const denied = enforceListTemplatesPermission(actorRoleKey, filters);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
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

export { catalogSupabaseRepository };
