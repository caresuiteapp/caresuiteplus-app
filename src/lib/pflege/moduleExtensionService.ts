import type { RoleKey, ServiceResult } from '@/types';
import type {
  PflegeModuleSettings,
  PflegeReportStats,
  SisAssessment,
} from '@/types/modules/pflege';
import { countDueSisReviews, getDemoSisAssessments } from '@/data/demo/sisAssessments';
import { countActiveCarePlans, getDemoCarePlanListItems } from '@/data/demo/carePlans';
import { countDueVitals } from '@/data/demo/vitalReadings';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';

let pflegeSettingsStore: PflegeModuleSettings = {
  sisEnabled: true,
  vitalAlertsEnabled: true,
  woundDocumentationEnabled: true,
  bodyMapEnabled: false,
  mdkExportPrepared: true,
  autoHandoverHints: true,
};

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function guardDemoOnlyFeature<T>(tenantId: string, featureLabel: string): ServiceResult<T> | null {
  const blocked = guardLiveDemoFeature<T>(tenantId, featureLabel);
  if (blocked) return blocked;
  if (getServiceMode() === 'supabase') {
    return { ok: false, error: `${featureLabel} im Live-Modus noch nicht vollständig angebunden.` };
  }
  return null;
}

export async function fetchSisAssessments(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SisAssessment[]>> {
  const denied = enforcePermission<SisAssessment[]>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const live = guardDemoOnlyFeature<SisAssessment[]>(tenantId, 'SIS-Bewertungen');
  if (live) return live;

  await demoDelay();
  return { ok: true, data: getDemoSisAssessments() };
}

export async function fetchPflegeModuleSettings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PflegeModuleSettings>> {
  const denied = enforcePermission<PflegeModuleSettings>(actorRoleKey, 'pflege.access');
  if (denied) return denied;
  const live = guardDemoOnlyFeature<PflegeModuleSettings>(tenantId, 'Pflege-Moduleinstellungen');
  if (live) return live;

  await demoDelay(180);
  return { ok: true, data: { ...pflegeSettingsStore } };
}

export async function updatePflegeModuleSettings(
  tenantId: string,
  patch: Partial<PflegeModuleSettings>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PflegeModuleSettings>> {
  const denied = enforcePermission<PflegeModuleSettings>(actorRoleKey, 'pflege.access');
  if (denied) return denied;
  const live = guardDemoOnlyFeature<PflegeModuleSettings>(tenantId, 'Pflege-Moduleinstellungen');
  if (live) return live;

  pflegeSettingsStore = { ...pflegeSettingsStore, ...patch };
  await demoDelay(120);
  return { ok: true, data: { ...pflegeSettingsStore } };
}

export async function fetchPflegeReportStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PflegeReportStats>> {
  const denied = enforcePermission<PflegeReportStats>(actorRoleKey, 'pflege.access');
  if (denied) return denied;
  const live = guardDemoOnlyFeature<PflegeReportStats>(tenantId, 'Pflege-Reporting');
  if (live) return live;

  await demoDelay();
  const plans = getDemoCarePlanListItems();
  return {
    ok: true,
    data: {
      activePlans: countActiveCarePlans(),
      sisAssessmentsDue: countDueSisReviews(),
      vitalsDocumentedThisWeek: Math.max(0, plans.length * 2 - countDueVitals()),
      woundCasesOpen: 2,
      mdkReadyCount: 1,
    },
  };
}
