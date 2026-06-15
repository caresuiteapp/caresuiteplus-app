import type { CourseListItem, Course, Enrollment } from '@/types/modules/akademie';
import type { WorkflowStatus } from '@/types';
import { demoEmployees } from './employees';
import { DEMO_TENANT_ID } from './tenant';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

type CourseSeed = Course & { instructorId: string; enrollmentCount: number };

const ENROLLMENT_SEEDS: Enrollment[] = [
  {
    id: 'enroll-001',
    tenantId: DEMO_TENANT_ID,
    courseId: 'course-001',
    profileId: 'employee-001',
    enrolledAt: daysAgo(30),
    completedAt: daysAgo(5),
    progressPercent: 100,
    status: 'abgeschlossen',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(5),
  },
  {
    id: 'enroll-002',
    tenantId: DEMO_TENANT_ID,
    courseId: 'course-001',
    profileId: 'employee-002',
    enrolledAt: daysAgo(28),
    completedAt: null,
    progressPercent: 65,
    status: 'in_bearbeitung',
    createdAt: daysAgo(28),
    updatedAt: daysAgo(2),
  },
  {
    id: 'enroll-003',
    tenantId: DEMO_TENANT_ID,
    courseId: 'course-002',
    profileId: 'employee-003',
    enrolledAt: daysAgo(10),
    completedAt: null,
    progressPercent: 20,
    status: 'aktiv',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(1),
  },
];

const COURSE_SEEDS: CourseSeed[] = [
  {
    id: 'course-001',
    tenantId: DEMO_TENANT_ID,
    title: 'Hygiene und Infektionsschutz',
    description: 'Pflichtschulung gemäß IfSG — Grundlagen für alle Mitarbeitenden.',
    category: 'Pflichtschulung',
    durationMinutes: 90,
    isMandatory: true,
    status: 'aktiv',
    startsAt: daysAgo(45),
    endsAt: daysFromNow(30),
    instructorId: 'employee-004',
    enrollmentCount: 12,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(3),
  },
  {
    id: 'course-002',
    tenantId: DEMO_TENANT_ID,
    title: 'Demenzsensible Kommunikation',
    description: 'Praxisnahe Gesprächsführung bei Menschen mit Demenz.',
    category: 'Fachfortbildung',
    durationMinutes: 240,
    isMandatory: false,
    status: 'aktiv',
    startsAt: daysFromNow(14),
    endsAt: daysFromNow(14),
    instructorId: 'employee-005',
    enrollmentCount: 8,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(2),
  },
  {
    id: 'course-003',
    tenantId: DEMO_TENANT_ID,
    title: 'Erste Hilfe Auffrischung',
    description: 'Jährliche Auffrischung für Betreuungskräfte.',
    category: 'Pflichtschulung',
    durationMinutes: 180,
    isMandatory: true,
    status: 'in_bearbeitung',
    startsAt: daysFromNow(7),
    endsAt: daysFromNow(7),
    instructorId: 'employee-004',
    enrollmentCount: 15,
    createdAt: daysAgo(15),
    updatedAt: daysAgo(1),
  },
  {
    id: 'course-004',
    tenantId: DEMO_TENANT_ID,
    title: 'Dokumentation in CareSuite+',
    description: 'Effiziente Nutzung der Module Office, Assist und Pflege.',
    category: 'Systemschulung',
    durationMinutes: 120,
    isMandatory: false,
    status: 'aktiv',
    startsAt: daysFromNow(3),
    endsAt: daysFromNow(3),
    instructorId: 'employee-006',
    enrollmentCount: 6,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(4),
  },
  {
    id: 'course-005',
    tenantId: DEMO_TENANT_ID,
    title: 'Medikamentenmanagement',
    description: 'Sichere Medikamentengabe und Dokumentation.',
    category: 'Fachfortbildung',
    durationMinutes: 300,
    isMandatory: true,
    status: 'entwurf',
    startsAt: null,
    endsAt: null,
    instructorId: 'employee-002',
    enrollmentCount: 0,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  {
    id: 'course-006',
    tenantId: DEMO_TENANT_ID,
    title: 'Basisschulung Alltagsbegleitung',
    description: 'Einführung für neue Alltagsbegleiter:innen.',
    category: 'Onboarding',
    durationMinutes: 360,
    isMandatory: true,
    status: 'abgeschlossen',
    startsAt: daysAgo(90),
    endsAt: daysAgo(88),
    instructorId: 'employee-001',
    enrollmentCount: 9,
    createdAt: daysAgo(100),
    updatedAt: daysAgo(88),
  },
];

let courseStore: CourseSeed[] = COURSE_SEEDS.map((seed) => ({ ...seed }));

function instructorName(instructorId: string): string {
  const employee = demoEmployees.find((e) => e.id === instructorId);
  return employee ? `${employee.firstName} ${employee.lastName}` : 'Unbekannt';
}

export function getDemoCourseListItems(): CourseListItem[] {
  return courseStore.map((course) => ({
    id: course.id,
    tenantId: course.tenantId,
    title: course.title,
    category: course.category,
    durationMinutes: course.durationMinutes,
    isMandatory: course.isMandatory,
    status: course.status,
    startsAt: course.startsAt,
    updatedAt: course.updatedAt,
    enrollmentCount: course.enrollmentCount,
  }));
}

export function getDemoCourseById(id: string): CourseSeed | null {
  const course = courseStore.find((c) => c.id === id);
  return course ? { ...course } : null;
}

export function getDemoEnrollmentsForCourse(courseId: string): Enrollment[] {
  return ENROLLMENT_SEEDS.filter((e) => e.courseId === courseId).map((e) => ({ ...e }));
}

export function getDemoEnrollments(): Enrollment[] {
  return ENROLLMENT_SEEDS.map((e) => ({ ...e }));
}

export function isCourseUpcoming(startsAt: string | null): boolean {
  if (!startsAt) return false;
  return new Date(startsAt) > new Date();
}

export function getInstructorName(instructorId: string): string {
  return instructorName(instructorId);
}

export const demoCourses = COURSE_SEEDS;
