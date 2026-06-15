import type { RoleKey, ServiceResult } from '@/types';
import type { CourseListItem } from '@/types/modules/akademie';
import {
  createDemoLesson,
  getDemoExams,
  getDemoInstructors,
  getDemoLearningProgress,
  getDemoLessons,
  getDemoMediaItems,
  type ExamListItem,
  type InstructorItem,
  type LessonListItem,
  type MediaItem,
  type ProgressItem,
} from '@/data/demo/akademieLessons';
import { getDemoCourseListItems } from '@/data/demo/courses';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function guardDemo(tenantId: string) {
  if (tenantId !== DEMO_TENANT_ID) return { ok: false as const, error: 'Kein Zugriff auf diesen Mandanten.' };
  return null;
}

export async function fetchLessonList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<LessonListItem[]>> {
  const denied = enforcePermission<LessonListItem[]>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  return { ok: true, data: getDemoLessons() };
}

export async function fetchExamList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ExamListItem[]>> {
  const denied = enforcePermission<ExamListItem[]>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  return { ok: true, data: getDemoExams() };
}

export async function fetchMandatoryCourses(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CourseListItem[]>> {
  const denied = enforcePermission<CourseListItem[]>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  return { ok: true, data: getDemoCourseListItems().filter((c) => c.isMandatory) };
}

export async function fetchTrainingPlanCourses(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CourseListItem[]>> {
  const denied = enforcePermission<CourseListItem[]>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  return { ok: true, data: getDemoCourseListItems().filter((c) => c.startsAt) };
}

export async function fetchMediaLibrary(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MediaItem[]>> {
  const denied = enforcePermission<MediaItem[]>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  return { ok: true, data: getDemoMediaItems() };
}

export async function fetchInstructorList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InstructorItem[]>> {
  const denied = enforcePermission<InstructorItem[]>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  return { ok: true, data: getDemoInstructors() };
}

export async function fetchLearningProgressList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ProgressItem[]>> {
  const denied = enforcePermission<ProgressItem[]>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay();
  return { ok: true, data: getDemoLearningProgress() };
}

export async function createLesson(
  tenantId: string,
  input: { courseId: string; title: string; durationMinutes: number },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<LessonListItem>> {
  const denied = enforcePermission<LessonListItem>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const live = guardDemo(tenantId);
  if (live) return live;
  await demoDelay(280);
  return { ok: true, data: createDemoLesson(input) };
}
