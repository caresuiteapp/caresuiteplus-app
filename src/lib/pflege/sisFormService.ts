import type { RoleKey, ServiceResult } from '@/types';
import type { SisFormDetail, SisRiskEntry, SisTopicKey } from '@/types/modules/sisForm';
import {
  createDemoSisFormDetail,
  ensureDemoSisFormDetail,
  getDemoSisFormDetail,
  saveDemoSisFormDetail,
} from '@/data/demo/sisFormDetails';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isPflegeDemoFunctional } from '@/lib/pflege/pflegeModuleConfig';

async function demoDelay(ms = 220): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchSisFormDetail(
  tenantId: string,
  assessmentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SisFormDetail>> {
  const denied = enforcePermission<SisFormDetail>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!isPflegeDemoFunctional()) {
    return { ok: false, error: 'SIS-Formular Live: Repository erweitern.' };
  }
  await demoDelay();
  const detail = ensureDemoSisFormDetail(assessmentId);
  if (!detail) return { ok: false, error: 'SIS-Assessment nicht gefunden.' };
  return { ok: true, data: detail };
}

export async function createSisFormAssessment(
  tenantId: string,
  input: { clientId: string; clientName: string; assessorName: string },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SisFormDetail>> {
  const denied = enforcePermission<SisFormDetail>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!isPflegeDemoFunctional()) {
    return { ok: false, error: 'SIS anlegen: Demo-Modus erforderlich.' };
  }
  await demoDelay(300);
  const detail = createDemoSisFormDetail(input);
  return { ok: true, data: detail };
}

export async function saveSisFormAssessment(
  tenantId: string,
  detail: SisFormDetail,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SisFormDetail>> {
  const denied = enforcePermission<SisFormDetail>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!isPflegeDemoFunctional()) {
    return { ok: false, error: 'SIS speichern: Demo-Modus erforderlich.' };
  }
  await demoDelay(320);
  const score = computeOverallScore(detail);
  const saved = saveDemoSisFormDetail({ ...detail, overallScore: score, tenantId });
  return { ok: true, data: saved };
}

export function computeOverallScore(detail: SisFormDetail): number {
  const filledTopics = Object.values(detail.topics).filter(
    (t) => t.resources.trim() || t.problems.trim() || t.actionNeeded.trim(),
  ).length;
  const riskWeight = detail.risks.reduce((sum, r) => {
    const map = { kein_risiko: 0, niedrig: 1, mittel: 2, hoch: 3, akut: 4, unbekannt: 1 };
    return sum + (map[r.level] ?? 0);
  }, 0);
  return Math.min(100, filledTopics * 8 + riskWeight * 5);
}

export function updateSisTopicField(
  detail: SisFormDetail,
  topic: SisTopicKey,
  field: keyof SisFormDetail['topics'][SisTopicKey],
  value: string,
): SisFormDetail {
  return {
    ...detail,
    topics: {
      ...detail.topics,
      [topic]: { ...detail.topics[topic], [field]: value },
    },
  };
}

export function upsertSisRisk(detail: SisFormDetail, risk: SisRiskEntry): SisFormDetail {
  const idx = detail.risks.findIndex((r) => r.id === risk.id);
  const risks = [...detail.risks];
  if (idx >= 0) risks[idx] = risk;
  else risks.push(risk);
  return { ...detail, risks };
}

export function removeSisRisk(detail: SisFormDetail, riskId: string): SisFormDetail {
  return { ...detail, risks: detail.risks.filter((r) => r.id !== riskId) };
}

export async function getSisFormForCreate(
  tenantId: string,
  assessmentId: string | undefined,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<SisFormDetail | null>> {
  if (!assessmentId) return { ok: true, data: null };
  return fetchSisFormDetail(tenantId, assessmentId, actorRoleKey);
}
