import type { RoleKey } from '@/types/core/auth';
import type { ProductKey } from '@/types/core/tenant';
import type { TrainingCourse, TrainingRequirement } from '@/types/modules/training';

/** Automatische Pflichtzuordnung nach Rolle und Modul (Prompt 75 E). */
export const DEFAULT_MANDATORY_TRAINING_BY_ROLE: Partial<Record<RoleKey, string[]>> = {
  caregiver: ['hygiene_ifsg', 'dsgvo_basics'],
  nurse: ['hygiene_ifsg', 'dsgvo_basics', 'dementia_care'],
  dispatch: ['dsgvo_basics', 'caresuite_docs'],
  employee_portal: ['dsgvo_basics'],
  business_admin: ['dsgvo_basics'],
  business_manager: ['dsgvo_basics'],
};

export const DEFAULT_MANDATORY_TRAINING_BY_MODULE: Partial<Record<ProductKey, string[]>> = {
  assist: ['hygiene_ifsg'],
  pflege: ['hygiene_ifsg'],
  office: ['dsgvo_basics'],
  akademie: ['academy_scorm_prep'],
};

export function resolveMandatoryCourseKeys(input: {
  roleKey?: RoleKey | null;
  moduleKeys?: ProductKey[];
  jobTitle?: string | null;
}): string[] {
  const keys = new Set<string>();

  if (input.roleKey && DEFAULT_MANDATORY_TRAINING_BY_ROLE[input.roleKey]) {
    for (const key of DEFAULT_MANDATORY_TRAINING_BY_ROLE[input.roleKey]!) {
      keys.add(key);
    }
  }

  for (const moduleKey of input.moduleKeys ?? []) {
    const moduleCourses = DEFAULT_MANDATORY_TRAINING_BY_MODULE[moduleKey];
    if (moduleCourses) {
      for (const key of moduleCourses) keys.add(key);
    }
  }

  if (input.jobTitle?.includes('Pflegefach')) {
    keys.add('hygiene_ifsg');
  }
  if (input.jobTitle?.includes('Betreuung')) {
    keys.add('hygiene_ifsg');
  }

  return [...keys];
}

export function resolveRequiredCoursesForEmployee(input: {
  courses: TrainingCourse[];
  requirements: TrainingRequirement[];
  roleKey?: RoleKey | null;
  moduleKeys?: ProductKey[];
  jobTitle?: string | null;
}): TrainingCourse[] {
  const mandatoryKeys = resolveMandatoryCourseKeys(input);
  const courseByKey = new Map(input.courses.map((c) => [c.courseKey, c]));
  const required = new Map<string, TrainingCourse>();

  for (const key of mandatoryKeys) {
    const course = courseByKey.get(key);
    if (course?.isMandatory) required.set(course.id, course);
  }

  for (const req of input.requirements) {
    if (!req.mandatory) continue;
    const matchesRole = !req.roleKey || req.roleKey === input.roleKey;
    const matchesModule =
      !req.moduleKey || (input.moduleKeys ?? []).includes(req.moduleKey as ProductKey);
    const matchesJob = !req.jobTitle || req.jobTitle === input.jobTitle;
    if (matchesRole && matchesModule && matchesJob) {
      const course = input.courses.find((c) => c.id === req.courseId);
      if (course) required.set(course.id, course);
    }
  }

  for (const course of input.courses) {
    if (course.isMandatory && course.trainingTypeGroup === 'mandatory_briefing') {
      const roleMatch = course.roleKeys.length === 0 || (input.roleKey && course.roleKeys.includes(input.roleKey));
      const moduleMatch =
        course.moduleKeys.length === 0 ||
        (input.moduleKeys ?? []).some((m) => course.moduleKeys.includes(m));
      if (roleMatch && moduleMatch) required.set(course.id, course);
    }
  }

  return [...required.values()];
}
