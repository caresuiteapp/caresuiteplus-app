import type { RoleKey, ServiceResult } from '@/types';
import type {
  AkademieModuleSettings,
  AkademieReportStats,
  CertificateListItem,
  EnrollmentListItem,
  EnrollmentDetail,
  CertificateDetail,
} from '@/types/modules/akademie';
import {
  countCertificatesExpiringSoon,
  countCompletionsThisMonth,
  getDemoCertificateListItems,
  getDemoEnrollmentListItems,
  getDemoEnrollmentDetail,
  getDemoCertificateDetail,
} from '@/data/demo/akademieExtended';
import { getDemoCourseListItems } from '@/data/demo/courses';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { akademieExtensionSupabaseRepository } from '@/lib/services/repositories/akademieExtensionRepository.supabase';

let akademieSettingsStore: AkademieModuleSettings = {
  mandatoryReminders: true,
  certificateAutoIssue: true,
  examRequired: false,
  externalInstructors: true,
  progressTracking: true,
};

async function demoDelay(ms = 200): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function rejectLiveTenant<T>(tenantId: string): ServiceResult<T> | null {
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };
  }
  return null;
}

export async function fetchEnrollmentList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EnrollmentListItem[]>> {
  const denied = enforcePermission<EnrollmentListItem[]>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return akademieExtensionSupabaseRepository.listEnrollmentsMapped(tenantId);
  }

  const live = rejectLiveTenant<EnrollmentListItem[]>(tenantId);
  if (live) return live;

  await demoDelay();
  return { ok: true, data: getDemoEnrollmentListItems() };
}

export async function fetchEnrollmentDetail(
  enrollmentId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EnrollmentDetail>> {
  const denied = enforcePermission<EnrollmentDetail>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return akademieExtensionSupabaseRepository.getEnrollmentDetailMapped(tenantId, enrollmentId);
  }

  const live = rejectLiveTenant<EnrollmentDetail>(tenantId);
  if (live) return live;

  await demoDelay();
  const detail = getDemoEnrollmentDetail(enrollmentId);
  if (!detail) return { ok: false, error: 'Teilnahme nicht gefunden.' };
  return { ok: true, data: detail };
}

export async function fetchCertificateList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CertificateListItem[]>> {
  const denied = enforcePermission<CertificateListItem[]>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return akademieExtensionSupabaseRepository.listCertificatesMapped(tenantId);
  }

  const live = rejectLiveTenant<CertificateListItem[]>(tenantId);
  if (live) return live;

  await demoDelay();
  return { ok: true, data: getDemoCertificateListItems() };
}

export async function fetchCertificateDetail(
  certificateId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CertificateDetail>> {
  const denied = enforcePermission<CertificateDetail>(actorRoleKey, 'akademie.courses.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return akademieExtensionSupabaseRepository.getCertificateDetailMapped(tenantId, certificateId);
  }

  const live = rejectLiveTenant<CertificateDetail>(tenantId);
  if (live) return live;

  await demoDelay();
  const detail = getDemoCertificateDetail(certificateId);
  if (!detail) return { ok: false, error: 'Zertifikat nicht gefunden.' };
  return { ok: true, data: detail };
}

export async function fetchAkademieModuleSettings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AkademieModuleSettings>> {
  const denied = enforcePermission<AkademieModuleSettings>(actorRoleKey, 'akademie.access');
  if (denied) return denied;
  const live = rejectLiveTenant<AkademieModuleSettings>(tenantId);
  if (live) return live;

  await demoDelay(180);
  return { ok: true, data: { ...akademieSettingsStore } };
}

export async function updateAkademieModuleSettings(
  tenantId: string,
  patch: Partial<AkademieModuleSettings>,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AkademieModuleSettings>> {
  const denied = enforcePermission<AkademieModuleSettings>(actorRoleKey, 'akademie.access');
  if (denied) return denied;
  const live = rejectLiveTenant<AkademieModuleSettings>(tenantId);
  if (live) return live;

  akademieSettingsStore = { ...akademieSettingsStore, ...patch };
  await demoDelay(120);
  return { ok: true, data: { ...akademieSettingsStore } };
}

export async function fetchAkademieReportStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AkademieReportStats>> {
  const denied = enforcePermission<AkademieReportStats>(actorRoleKey, 'akademie.access');
  if (denied) return denied;
  const live = rejectLiveTenant<AkademieReportStats>(tenantId);
  if (live) return live;

  const courses = getDemoCourseListItems();
  const active = courses.filter((c) => c.status === 'aktiv').length;
  const mandatory = courses.filter((c) => c.isMandatory).length;
  const enrollments = getDemoEnrollmentListItems();
  const mandatoryCompleted = enrollments.filter((e) => e.progressPercent === 100).length;

  await demoDelay();
  return {
    ok: true,
    data: {
      activeCourses: active,
      enrollmentsOpen: enrollments.filter((e) => e.status !== 'abgeschlossen').length,
      completionsThisMonth: countCompletionsThisMonth(),
      certificatesExpiring: countCertificatesExpiringSoon(),
      mandatoryCompliancePercent: mandatory > 0 ? Math.round((mandatoryCompleted / mandatory) * 100) : 100,
    },
  };
}
