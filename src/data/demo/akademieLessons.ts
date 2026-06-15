import type { Lesson, WorkflowStatus } from '@/types';
import { getDemoEnrollmentListItems } from './akademieExtended';
import { getDemoCourseListItems } from './courses';
import { DEMO_TENANT_ID } from './tenant';

export type ExamListItem = {
  id: string;
  tenantId: string;
  courseId: string;
  courseTitle: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  passingScore: number;
  status: WorkflowStatus;
  enrolledCount: number;
};

export type LessonListItem = Lesson & {
  courseTitle: string;
};

export type MediaItem = {
  id: string;
  tenantId: string;
  title: string;
  mediaType: 'video' | 'pdf' | 'link' | 'audio';
  courseTitle: string;
  durationMinutes: number;
  status: WorkflowStatus;
};

export type InstructorItem = {
  id: string;
  tenantId: string;
  name: string;
  specialty: string;
  courseCount: number;
  status: WorkflowStatus;
};

export type ProgressItem = {
  id: string;
  tenantId: string;
  participantName: string;
  courseTitle: string;
  progressPercent: number;
  lastActivityAt: string;
  status: WorkflowStatus;
};

function courseTitle(courseId: string): string {
  return getDemoCourseListItems().find((c) => c.id === courseId)?.title ?? 'Kurs';
}

function buildLessons(): LessonListItem[] {
  const courses = getDemoCourseListItems().slice(0, 8);
  const items: LessonListItem[] = [];
  courses.forEach((course, ci) => {
    for (let i = 1; i <= 3; i += 1) {
      items.push({
        id: `lesson-${ci + 1}-${i}`,
        tenantId: DEMO_TENANT_ID,
        courseId: course.id,
        courseTitle: course.title,
        title: `Lektion ${i}: ${course.title.split(' ').slice(0, 2).join(' ')}`,
        sortOrder: i,
        durationMinutes: 20 + i * 5,
        status: i === 3 && ci % 3 === 0 ? 'entwurf' : 'aktiv',
        createdAt: new Date(Date.now() - (ci * 3 + i) * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });
  return items;
}

function buildExams(): ExamListItem[] {
  return getDemoCourseListItems().slice(0, 12).map((course, i) => ({
    id: `exam-${String(i + 1).padStart(3, '0')}`,
    tenantId: DEMO_TENANT_ID,
    courseId: course.id,
    courseTitle: course.title,
    title: `Prüfung — ${course.title}`,
    scheduledAt: new Date(Date.now() + (i + 3) * 86400000).toISOString(),
    durationMinutes: 45,
    passingScore: 70 + (i % 3) * 5,
    status: i % 4 === 0 ? 'in_bearbeitung' : 'aktiv',
    enrolledCount: 5 + i,
  }));
}

function buildMedia(): MediaItem[] {
  return getDemoCourseListItems().slice(0, 15).map((course, i) => ({
    id: `media-${String(i + 1).padStart(3, '0')}`,
    tenantId: DEMO_TENANT_ID,
    title: `Mediathek — ${course.title}`,
    mediaType: (['video', 'pdf', 'link', 'audio'] as const)[i % 4]!,
    courseTitle: course.title,
    durationMinutes: course.durationMinutes,
    status: 'aktiv',
  }));
}

function buildInstructors(): InstructorItem[] {
  const names = [
    'Dr. Anna Weber',
    'Thomas Krüger',
    'Sabine Hoffmann',
    'Markus Lehmann',
    'Julia Brandt',
    'Prof. Dr. Fischer',
    'Elena Schwarz',
    'Michael Braun',
  ];
  return names.map((name, i) => ({
    id: `instructor-${i + 1}`,
    tenantId: DEMO_TENANT_ID,
    name,
    specialty: ['Pflege', 'Hygiene', 'Recht', 'Erste Hilfe', 'Kommunikation'][i % 5]!,
    courseCount: 2 + (i % 4),
    status: 'aktiv',
  }));
}

function buildProgress(): ProgressItem[] {
  return getDemoEnrollmentListItems().slice(0, 18).map((e, i) => ({
    id: `progress-${i + 1}`,
    tenantId: DEMO_TENANT_ID,
    participantName: e.participantName,
    courseTitle: e.courseTitle,
    progressPercent: Math.min(100, 20 + i * 5),
    lastActivityAt: new Date(Date.now() - i * 43200000).toISOString(),
    status: e.status,
  }));
}

let lessonStore = buildLessons();
let examStore = buildExams();
let mediaStore = buildMedia();
let instructorStore = buildInstructors();
let progressStore = buildProgress();

export function getDemoLessons(): LessonListItem[] {
  return lessonStore.map((l) => ({ ...l }));
}

export function getDemoExams(): ExamListItem[] {
  return examStore.map((e) => ({ ...e }));
}

export function getDemoMediaItems(): MediaItem[] {
  return mediaStore.map((m) => ({ ...m }));
}

export function getDemoInstructors(): InstructorItem[] {
  return instructorStore.map((i) => ({ ...i }));
}

export function getDemoLearningProgress(): ProgressItem[] {
  return progressStore.map((p) => ({ ...p }));
}

export function createDemoLesson(input: {
  courseId: string;
  title: string;
  durationMinutes: number;
}): LessonListItem {
  const now = new Date().toISOString();
  const item: LessonListItem = {
    id: `lesson-${Date.now()}`,
    tenantId: DEMO_TENANT_ID,
    courseId: input.courseId,
    courseTitle: courseTitle(input.courseId),
    title: input.title,
    sortOrder: lessonStore.filter((l) => l.courseId === input.courseId).length + 1,
    durationMinutes: input.durationMinutes,
    status: 'entwurf',
    createdAt: now,
    updatedAt: now,
  };
  lessonStore = [item, ...lessonStore];
  return { ...item };
}
