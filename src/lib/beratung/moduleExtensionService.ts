import type { RoleKey, ServiceResult } from '@/types';
import type {
  BeratungModuleSettings,
  BeratungReportStats,
  FollowUp,
  Protocol,
} from '@/types/modules/beratung';
import {
  addDemoCounselingProtocol,
  countDueFollowUps,
  countProtocolsThisMonth,
  getDemoCounselingProtocols,
  getDemoFollowUpById,
  getDemoFollowUps,
  getDemoProtocolById,
} from '@/data/demo/beratungExtended';
import { getDemoCounselingCaseListItems } from '@/data/demo/counselingCases';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';

let beratungSettingsStore: BeratungModuleSettings = {
  protocolsRequired: true,
  followUpReminders: true,
  relativePortalSharing: true,
  careGradeTemplates: true,
  anonymCasesAllowed: false,
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

export async function fetchCounselingProtocols(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<(Protocol & { caseSubject: string })[]>> {
  const denied = enforcePermission<(Protocol & { caseSubject: string })[]>(actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;
  const live = guardDemoOnlyFeature<(Protocol & { caseSubject: string })[]>(tenantId, 'Beratungsprotokolle');
  if (live) return live;

  await demoDelay();
  return { ok: true, data: getDemoCounselingProtocols() };
}

export type CounselingProtocolCreateInput = {
  caseId: string;
  caseSubject: string;
  content: string;
  templateId?: string;
};

/** WP414 — Beratungsprotokoll anlegen (Arbeitsplan 075) */
export async function createCounselingProtocol(
  tenantId: string,
  input: CounselingProtocolCreateInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<Protocol & { caseSubject: string }>> {
  const denied = enforcePermission<Protocol & { caseSubject: string }>(actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;
  const live = guardDemoOnlyFeature<Protocol & { caseSubject: string }>(tenantId, 'Beratungsprotokoll');
  if (live) return live;

  if (!input.caseId.trim()) return { ok: false, error: 'Fall ist erforderlich.' };
  if (!input.content.trim()) return { ok: false, error: 'Protokolltext ist erforderlich.' };

  await demoDelay(180);
  const protocol = addDemoCounselingProtocol({
    caseId: input.caseId,
    caseSubject: input.caseSubject,
    content: input.content,
    status: 'entwurf',
  });
  return { ok: true, data: protocol };
}

export async function fetchFollowUps(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<FollowUp[]>> {
  const denied = enforcePermission<FollowUp[]>(actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;
  const live = guardDemoOnlyFeature<FollowUp[]>(tenantId, 'Wiedervorlagen');
  if (live) return live;

  await demoDelay();
  return { ok: true, data: getDemoFollowUps() };
}

export async function fetchFollowUpDetail(
  tenantId: string,
  followUpId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<FollowUp>> {
  const denied = enforcePermission<FollowUp>(actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;
  const live = guardDemoOnlyFeature<FollowUp>(tenantId, 'Wiedervorlage');
  if (live) return live;

  await demoDelay();
  const followUp = getDemoFollowUpById(followUpId);
  if (!followUp) {
    return { ok: false, error: 'Wiedervorlage nicht gefunden.' };
  }
  return { ok: true, data: followUp };
}

export async function fetchProtocolDetail(
  tenantId: string,
  protocolId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<Protocol & { caseSubject: string }>> {
  const denied = enforcePermission<Protocol & { caseSubject: string }>(
    actorRoleKey,
    'beratung.cases.view',
  );
  if (denied) return denied;
  const live = guardDemoOnlyFeature<Protocol & { caseSubject: string }>(
    tenantId,
    'Beratungsprotokoll',
  );
  if (live) return live;

  await demoDelay();
  const protocol = getDemoProtocolById(protocolId);
  if (!protocol) {
    return { ok: false, error: 'Protokoll nicht gefunden.' };
  }
  return { ok: true, data: protocol };
}

export async function fetchBeratungModuleSettings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BeratungModuleSettings>> {
  const denied = enforcePermission<BeratungModuleSettings>(actorRoleKey, 'beratung.access');
  if (denied) return denied;
  const live = guardDemoOnlyFeature<BeratungModuleSettings>(tenantId, 'Beratungs-Moduleinstellungen');
  if (live) return live;

  await demoDelay(180);
  return { ok: true, data: { ...beratungSettingsStore } };
}

export async function updateBeratungModuleSettings(
  tenantId: string,
  patch: Partial<BeratungModuleSettings>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BeratungModuleSettings>> {
  const denied = enforcePermission<BeratungModuleSettings>(actorRoleKey, 'beratung.access');
  if (denied) return denied;
  const live = guardDemoOnlyFeature<BeratungModuleSettings>(tenantId, 'Beratungs-Moduleinstellungen');
  if (live) return live;

  beratungSettingsStore = { ...beratungSettingsStore, ...patch };
  await demoDelay(120);
  return { ok: true, data: { ...beratungSettingsStore } };
}

export async function fetchBeratungReportStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BeratungReportStats>> {
  const denied = enforcePermission<BeratungReportStats>(actorRoleKey, 'beratung.access');
  if (denied) return denied;
  const live = guardDemoOnlyFeature<BeratungReportStats>(tenantId, 'Beratungs-Reporting');
  if (live) return live;

  const cases = getDemoCounselingCaseListItems();
  const open = cases.filter((c) => c.status === 'aktiv' || c.status === 'in_bearbeitung').length;

  await demoDelay();
  return {
    ok: true,
    data: {
      openCases: open,
      protocolsThisMonth: countProtocolsThisMonth(),
      followUpsDue: countDueFollowUps(),
      closedThisMonth: cases.filter((c) => c.status === 'abgeschlossen').length,
      avgCaseDurationDays: 18,
    },
  };
}
