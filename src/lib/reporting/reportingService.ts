import type { RoleKey, ServiceResult } from '@/types';
import type { PdlCockpitSnapshot, ReportDetail, ReportListItem } from '@/types/reporting';
import {
  demoReportList,
  getDemoPdlCockpit,
  getDemoReportDetail,
} from '@/data/demo/reportingDemo';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { reportingSupabaseRepository } from '@/lib/services/repositories/reportingRepository.supabase';

/** WP507 — Service-Schicht Reporting */
export async function fetchPdlCockpit(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PdlCockpitSnapshot>> {
  const denied = enforcePermission<PdlCockpitSnapshot>(actorRoleKey, 'business.reporting.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return reportingSupabaseRepository.getCockpitMapped(tenantId);
  }

  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, data: getDemoPdlCockpit() };
}

export async function fetchReportList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ReportListItem[]>> {
  const denied = enforcePermission<ReportListItem[]>(actorRoleKey, 'business.reporting.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return reportingSupabaseRepository.listMapped(tenantId);
  }

  await new Promise((r) => setTimeout(r, 180));
  return { ok: true, data: demoReportList };
}

export async function fetchReportDetail(
  tenantId: string,
  reportId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ReportDetail>> {
  const denied = enforcePermission<ReportDetail>(actorRoleKey, 'business.reporting.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return reportingSupabaseRepository.getDetailMapped(reportId, tenantId);
  }

  const detail = getDemoReportDetail(reportId);
  if (!detail) return { ok: false, error: 'Bericht nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 160));
  return { ok: true, data: detail };
}

export async function createReportDraft(
  tenantId: string,
  title: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'business.reporting.create');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!title.trim()) return { ok: false, error: 'Titel ist erforderlich.' };

  if (getServiceMode() === 'supabase') {
    return reportingSupabaseRepository.create(tenantId, { title: title.trim() });
  }

  await new Promise((r) => setTimeout(r, 250));
  const id = `report-${Date.now().toString(36)}`;
  demoReportList.unshift({
    id,
    tenantId,
    title: title.trim(),
    category: 'pdl',
    period: 'Aktuell',
    status: 'entwurf',
    updatedAt: new Date().toISOString(),
  });
  return { ok: true, data: { id } };
}
