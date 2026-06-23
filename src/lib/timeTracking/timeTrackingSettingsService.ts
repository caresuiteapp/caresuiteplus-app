import type { RoleKey, ServiceResult } from '@/types';
import type {
  ActivityType,
  CostCenter,
  TenantTimeTrackingSettings,
  WorkOrganization,
  WorkProject,
} from '@/types/modules/timeTracking';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  getSettings,
  listActivityTypes,
  listCostCenters,
  listOrganizations,
  listProjects,
  nextTimeTrackingId,
  saveActivityType,
  saveCostCenter,
  saveOrganization,
  saveProject,
  saveSettings,
} from './timeTrackingStore';
import { seedDemoTimeTrackingCatalog } from './timeTrackingDemoSeed';

const DEFAULT_SETTINGS: Omit<TenantTimeTrackingSettings, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'> = {
  moduleEnabled: true,
  requirePrivacyConsent: true,
  inactivityTriggerMinutes: 5,
  inactivityResponseMinutes: 2,
  warningThresholdPerDay: 3,
  allowManualCorrections: true,
  integrationMicrosoft: false,
  integrationGoogle: false,
  integrationPhoneMetadata: false,
  defaultActivityTypeId: null,
};

export function ensureTimeTrackingSettings(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): ServiceResult<TenantTimeTrackingSettings> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  let settings = getSettings(tenantId);
  if (!settings) {
    seedDemoTimeTrackingCatalog(tenantId);
    const types = listActivityTypes(tenantId);
    const now = new Date().toISOString();
    settings = {
      id: nextTimeTrackingId('tts'),
      tenantId,
      ...DEFAULT_SETTINGS,
      defaultActivityTypeId: types[0]?.id ?? null,
      createdAt: now,
      updatedAt: now,
    };
    saveSettings(settings);
  }

  const deniedView = enforcePermission<TenantTimeTrackingSettings>(actorRoleKey, 'time.tracking.own.view');
  const deniedSettings = enforcePermission(actorRoleKey, 'time.settings.manage');
  if (deniedView && deniedSettings) return deniedView;

  return { ok: true, data: settings };
}

export function fetchTimeTrackingSettings(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): ServiceResult<TenantTimeTrackingSettings> {
  const denied = enforcePermission<TenantTimeTrackingSettings>(actorRoleKey, 'time.settings.manage');
  if (denied) return denied;
  return ensureTimeTrackingSettings(tenantId, actorRoleKey);
}

export function updateTimeTrackingSettings(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  patch: Partial<TenantTimeTrackingSettings>,
): ServiceResult<TenantTimeTrackingSettings> {
  const denied = enforcePermission<TenantTimeTrackingSettings>(actorRoleKey, 'time.settings.manage');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const base = ensureTimeTrackingSettings(tenantId, actorRoleKey);
  if (!base.ok) return base;

  const updated: TenantTimeTrackingSettings = {
    ...base.data,
    ...patch,
    id: base.data.id,
    tenantId,
    updatedAt: new Date().toISOString(),
  };
  saveSettings(updated);
  return { ok: true, data: updated };
}

export function fetchTimeTrackingCatalogs(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): ServiceResult<{
  organizations: WorkOrganization[];
  costCenters: CostCenter[];
  projects: WorkProject[];
  activityTypes: ActivityType[];
}> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.own.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  ensureTimeTrackingSettings(tenantId, actorRoleKey);

  return {
    ok: true,
    data: {
      organizations: listOrganizations(tenantId),
      costCenters: listCostCenters(tenantId),
      projects: listProjects(tenantId),
      activityTypes: listActivityTypes(tenantId),
    },
  };
}

export function upsertActivityType(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  input: { id?: string; code: string; name: string; category: ActivityType['category'] },
): ServiceResult<ActivityType> {
  const denied = enforcePermission<ActivityType>(actorRoleKey, 'time.settings.manage');
  if (denied) return denied;

  const now = new Date().toISOString();
  const item: ActivityType = {
    id: input.id ?? nextTimeTrackingId('at'),
    tenantId,
    code: input.code,
    name: input.name,
    category: input.category,
    isActive: true,
    sortOrder: listActivityTypes(tenantId).length,
  };
  saveActivityType(item);
  return { ok: true, data: item };
}

export function upsertWorkOrganization(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  input: { id?: string; code: string; name: string },
): ServiceResult<WorkOrganization> {
  const denied = enforcePermission<WorkOrganization>(actorRoleKey, 'time.settings.manage');
  if (denied) return denied;

  const item: WorkOrganization = {
    id: input.id ?? nextTimeTrackingId('org'),
    tenantId,
    code: input.code,
    name: input.name,
    isActive: true,
    sortOrder: listOrganizations(tenantId).length,
  };
  saveOrganization(item);
  return { ok: true, data: item };
}

export function upsertCostCenter(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  input: { id?: string; code: string; name: string; organizationId?: string | null },
): ServiceResult<CostCenter> {
  const denied = enforcePermission<CostCenter>(actorRoleKey, 'time.settings.manage');
  if (denied) return denied;

  const item: CostCenter = {
    id: input.id ?? nextTimeTrackingId('cc'),
    tenantId,
    organizationId: input.organizationId ?? null,
    code: input.code,
    name: input.name,
    isActive: true,
    sortOrder: listCostCenters(tenantId).length,
  };
  saveCostCenter(item);
  return { ok: true, data: item };
}

export function upsertProject(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  input: { id?: string; code: string; name: string; costCenterId?: string | null },
): ServiceResult<WorkProject> {
  const denied = enforcePermission<WorkProject>(actorRoleKey, 'time.settings.manage');
  if (denied) return denied;

  const item: WorkProject = {
    id: input.id ?? nextTimeTrackingId('prj'),
    tenantId,
    costCenterId: input.costCenterId ?? null,
    code: input.code,
    name: input.name,
    isActive: true,
    sortOrder: listProjects(tenantId).length,
  };
  saveProject(item);
  return { ok: true, data: item };
}
