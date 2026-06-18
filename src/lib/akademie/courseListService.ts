import type { RoleKey, ServiceResult } from '@/types';
import type { AkademieDashboardStats, CourseListItem } from '@/types/modules/akademie';
import {
  getDemoCourseListItems,
  getDemoEnrollments,
  isCourseUpcoming,
} from '@/data/demo/courses';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { akademieSupabaseRepository } from '@/lib/services/repositories/akademieRepository.supabase';
import {
  handleMissingTableQuery,
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

export async function fetchCourseList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<CourseListItem[]>> {
  const denied = enforcePermission<CourseListItem[]>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await akademieSupabaseRepository.listMapped(tenantId);
    return handleMissingTableQuery(result, getDemoCourseListItems(), tenantId);
  }

  await new Promise((r) => setTimeout(r, 260));
  return { ok: true, data: getDemoCourseListItems(), previewData: true };
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
  const listResult = await fetchCourseList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  return {
    ok: true,
    data: buildDashboardStats(listResult.data),
    previewData: listResult.previewData,
  };
}

export async function fetchUpcomingCourses(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<PreviewAwareResult<CourseListItem[]>> {
  const listResult = await fetchCourseList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  const upcoming = listResult.data
    .filter((item) => item.status === 'aktiv' || item.status === 'in_bearbeitung')
    .sort((a, b) => {
      const aTime = a.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
    .slice(0, 4);

  return { ok: true, data: upcoming, previewData: listResult.previewData };
}
