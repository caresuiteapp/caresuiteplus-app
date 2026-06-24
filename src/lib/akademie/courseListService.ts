import type { RoleKey } from '@/types';
import type { AkademieDashboardStats, CourseListItem } from '@/types/modules/akademie';
import { emptyAkademieDashboardStats } from '@/types/modules/akademie';
import {
  countCertificatesExpiringSoon,
  getDemoCertificateListItems,
  getDemoEnrollmentListItems,
} from '@/data/demo/akademieExtended';
import {
  getDemoCourseListItems,
} from '@/data/demo/courses';
import { getDemoExams, getDemoMediaItems } from '@/data/demo/akademieLessons';
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
  const now = Date.now();
  const enrollments = getDemoEnrollmentListItems();
  const exams = getDemoExams();
  const media = getDemoMediaItems();
  const certificates = getDemoCertificateListItems();
  const mandatoryCourses = items.filter((item) => item.isMandatory);

  const certCourseIds = new Set(certificates.map((c) => c.courseId));

  return {
    totalCourses: items.length,
    activeCoursesCount: items.filter((item) => item.status === 'aktiv').length,
    upcomingCoursesCount: items.filter((item) => isCourseUpcoming(item.startsAt)).length,
    runningCoursesCount: items.filter((item) => item.status === 'in_bearbeitung').length,
    mandatoryCount: mandatoryCourses.length,
    mandatoryOpenCount: mandatoryCourses.filter(
      (item) => item.status === 'aktiv' || item.status === 'in_bearbeitung',
    ).length,
    mandatoryOverdueCount: mandatoryCourses.filter((item) => {
      if (!item.startsAt) return false;
      return (
        new Date(item.startsAt).getTime() < now &&
        item.status !== 'abgeschlossen' &&
        item.status !== 'archiviert'
      );
    }).length,
    totalEnrollments: enrollments.length,
    activeParticipantsCount: new Set(
      enrollments
        .filter((e) => e.status === 'aktiv' || e.status === 'in_bearbeitung')
        .map((e) => e.profileId),
    ).size,
    openEnrollmentsCount: enrollments.filter((e) => e.status !== 'abgeschlossen').length,
    openProgressCount: enrollments.filter(
      (e) => e.progressPercent < 100 && e.status !== 'abgeschlossen',
    ).length,
    upcomingStartsCount: items.filter((item) => isCourseUpcoming(item.startsAt)).length,
    upcomingExamsCount: exams.filter((e) => new Date(e.scheduledAt).getTime() > now).length,
    examsToGradeCount: exams.filter((e) => e.status === 'in_bearbeitung').length,
    certificatesToIssueCount: enrollments.filter(
      (e) => e.progressPercent === 100 && !certCourseIds.has(e.courseId),
    ).length,
    certificatesExpiringCount: countCertificatesExpiringSoon(),
    mediathekOpenCount: media.filter((m) => m.status === 'aktiv').length,
    trainingPlanOpenCount: items.filter((item) => item.startsAt && isCourseUpcoming(item.startsAt)).length,
  };
}

function buildLiveCourseStats(items: CourseListItem[]): AkademieDashboardStats {
  return {
    ...emptyAkademieDashboardStats(),
    totalCourses: items.length,
    activeCoursesCount: items.filter((item) => item.status === 'aktiv').length,
    upcomingCoursesCount: items.filter((item) => isCourseUpcoming(item.startsAt)).length,
    runningCoursesCount: items.filter((item) => item.status === 'in_bearbeitung').length,
    mandatoryCount: items.filter((item) => item.isMandatory).length,
    upcomingStartsCount: items.filter((item) => isCourseUpcoming(item.startsAt)).length,
    trainingPlanOpenCount: items.filter((item) => item.startsAt && isCourseUpcoming(item.startsAt)).length,
  };
}

type CourseListLoadResult =
  | { ok: true; data: CourseListItem[]; usedDemoFallback?: boolean; tableMissing?: boolean }
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

  const stats =
    getServiceMode() === 'supabase'
      ? buildLiveCourseStats(listResult.data)
      : buildDashboardStats(listResult.data);

  return {
    ok: true,
    data: stats,
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
