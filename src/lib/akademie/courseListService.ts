import type { RoleKey } from '@/types';
import type { AkademieDashboardStats, CourseListItem } from '@/types/modules/akademie';
import {
  getDemoCourseListItems,
  getDemoEnrollments,
} from '@/data/demo/courses';
import { isCourseUpcoming } from './courseUtils';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { akademieSupabaseRepository } from '@/lib/services/repositories/akademieRepository.supabase';
import { isMissingTableServiceError } from '@/lib/supabase/errors';
import {
  resolveMissingTableList,
  type PreviewAwareResult,
} from '@/lib/supabase/missingtablefallback';

function buildDashboardStats(items: CourseListItem[]): AkademieDashboardStats {
  const enrollments = getDemoEnrollments();

  return {
    totalCourses: items.length,
    activeCoursesCount: items.filter((item) => item.status === 'aktiv').length,
    mandatoryCount: items.filter((item) => item.isMandatory).length,
    totalEnrollments: enrollments.length,
    upcomingStartsCount: items.filter((item) => isCourseUpcoming(item.startsAt)).length,
  };
}

type CourseListLoadResult =
  | { ok: true; data: CourseListItem[]; usedDemoFallback: boolean; tableMissing?: boolean }
  | { ok: false; error: string };

async function loadCourseList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<CourseListLoadResult> {
  const denied = enforcePermission<CourseListItem[]>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await akademieSupabaseRepository.listMapped(tenantId);
    if (!result.ok && isMissingTableServiceError(result.error)) {
      return resolveMissingTableList(result, tenantId, getDemoCourseListItems);
    }
    if (result.ok && result.tableMissing) {
      const resolved = resolveMissingTableList(result, tenantId, getDemoCourseListItems);
      if (!resolved.ok) return resolved;
      return {
        ok: true,
        data: resolved.data,
        usedDemoFallback: resolved.usedDemoFallback,
        tableMissing: !resolved.usedDemoFallback,
      };
    }
    if (!result.ok) return result;
    return { ok: true, data: result.data, usedDemoFallback: false };
  }

  await new Promise((r) => setTimeout(r, 260));
  return { ok: true, data: getDemoCourseListItems(), usedDemoFallback: true };
}

export async function fetchCourseList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<CourseListItem[]>> {
  const result = await loadCourseList(tenantId, actorRoleKey);
  if (!result.ok) return result;

  return {
    ok: true,
    data: result.data,
    previewData: result.usedDemoFallback || result.tableMissing === true,
    tableMissing: result.tableMissing,
  };
}

export async function fetchAkademieDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<AkademieDashboardStats>> {
  const denied = enforcePermission<AkademieDashboardStats>(actorRoleKey, 'akademie.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  await new Promise((r) => setTimeout(r, 220));
  const listResult = await loadCourseList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  return {
    ok: true,
    data: buildDashboardStats(listResult.data),
    previewData: listResult.usedDemoFallback || listResult.tableMissing === true,
    tableMissing: listResult.tableMissing,
  };
}

export async function fetchUpcomingCourses(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<CourseListItem[]>> {
  const listResult = await loadCourseList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  const upcoming = listResult.data
    .filter((item) => item.status === 'aktiv' || item.status === 'in_bearbeitung')
    .sort((a, b) => {
      const aTime = a.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
    .slice(0, 4);

  return {
    ok: true,
    data: upcoming,
    previewData: listResult.usedDemoFallback || listResult.tableMissing === true,
    tableMissing: listResult.tableMissing,
  };
}
