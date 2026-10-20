import type { RoleKey, ServiceResult } from '@/types';
import type { CourseDetail } from '@/types/modules/akademie';
import {
  getDemoCourseById,
  getDemoEnrollmentsForCourse,
  getInstructorName,
} from '@/data/demo/courses';
import { enforcePermission } from '@/lib/permissions';
import { CLIENT_STATUS_HINTS } from '@/lib/services';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { akademieSupabaseRepository } from '@/lib/services/repositories/akademieRepository.supabase';

function enrichCourse(
  seed: NonNullable<ReturnType<typeof getDemoCourseById>>,
): CourseDetail {
  const enrollments = getDemoEnrollmentsForCourse(seed.id);
  const completed = enrollments.filter((e) => e.progressPercent >= 100).length;
  const completionRate =
    enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0;

  return {
    ...seed,
    enrollmentCount: seed.enrollmentCount,
    completionRatePercent: completionRate,
    instructorName: getInstructorName(seed.instructorId),
    nextActionHint: CLIENT_STATUS_HINTS[seed.status],
  };
}

export async function fetchCourseDetail(
  courseId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CourseDetail>> {
  const denied = enforcePermission<CourseDetail>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return akademieSupabaseRepository.getDetailMapped(courseId, tenantId);
  }

  await new Promise((r) => setTimeout(r, 240));

  const seed = getDemoCourseById(courseId);
  if (!seed) {
    return { ok: false, error: 'Kurs nicht gefunden.' };
  }

  return { ok: true, data: enrichCourse(seed) };
}
