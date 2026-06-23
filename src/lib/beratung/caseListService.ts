import type { RoleKey, ServiceResult } from '@/types';
import type {
  BeratungDashboardStats,
  CounselingListItem,
  FollowUp,
  Protocol,
} from '@/types/modules/beratung';
import {
  createDemoCounselingCase,
  getDemoCounselingCaseListItems,
} from '@/data/demo/counselingCases';
import { getDemoCounselingProtocols, getDemoFollowUps } from '@/data/demo/beratungExtended';
import {
  isAppointmentUpcoming,
  isCaseClosedThisMonth,
  isCaseOpen,
} from './counselingCaseUtils';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { beratungSupabaseRepository } from '@/lib/services/repositories/beratungRepository.supabase';
import { emptyBeratungDashboardStats } from '@/types/modules/beratung';

const WEEK_MS = 7 * 86_400_000;

function isSameDay(iso: string, reference = new Date()): boolean {
  const date = new Date(iso);
  return (
    date.getDate() === reference.getDate() &&
    date.getMonth() === reference.getMonth() &&
    date.getFullYear() === reference.getFullYear()
  );
}

function isWithinLastWeek(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() <= WEEK_MS;
}

function isRelativeCase(item: CounselingListItem): boolean {
  const haystack = `${item.category} ${item.subject}`.toLowerCase();
  return haystack.includes('angehör') || haystack.includes('familie');
}

function isFirstConsultationCase(item: CounselingListItem): boolean {
  const haystack = `${item.category} ${item.subject}`.toLowerCase();
  return (
    item.status === 'entwurf' ||
    haystack.includes('erstberatung') ||
    haystack.includes('erstgespräch') ||
    haystack.includes('erstgespraech')
  );
}

function isOpenProtocolStatus(status: Protocol['status']): boolean {
  return status === 'entwurf' || status === 'in_bearbeitung' || status === 'aktiv';
}

function isOpenFollowUpStatus(status: FollowUp['status']): boolean {
  return status !== 'abgeschlossen' && status !== 'gesperrt';
}

function buildDashboardStats(
  items: CounselingListItem[],
  protocols: (Protocol & { caseSubject: string })[] = [],
  followUps: FollowUp[] = [],
): BeratungDashboardStats {
  const now = Date.now();
  const openCases = items.filter((item) => isCaseOpen(item.status));
  const openFollowUps = followUps.filter((item) => isOpenFollowUpStatus(item.status));
  const casesWithFollowUp = new Set(openFollowUps.map((item) => item.caseId));
  const casesWithProtocol = new Set(protocols.map((item) => item.caseId));

  return {
    totalCases: items.length,
    openCount: openCases.length,
    activeCount: items.filter((item) => item.status === 'aktiv').length,
    upcomingAppointmentsCount: items.filter((item) => isAppointmentUpcoming(item.nextAppointmentAt)).length,
    closedThisMonthCount: items.filter((item) =>
      isCaseClosedThisMonth(item.status === 'abgeschlossen' ? item.updatedAt : null),
    ).length,
    newCasesCount: openCases.filter(
      (item) => item.status === 'entwurf' || isWithinLastWeek(item.openedAt),
    ).length,
    appointmentsTodayCount: openCases.filter(
      (item) => item.nextAppointmentAt && isSameDay(item.nextAppointmentAt),
    ).length,
    openFirstConsultationsCount: openCases.filter(
      (item) => isFirstConsultationCase(item) && !casesWithProtocol.has(item.id),
    ).length,
    openProtocolsCount: protocols.filter((item) => isOpenProtocolStatus(item.status)).length,
    dueFollowUpsCount: openFollowUps.filter((item) => new Date(item.dueAt).getTime() <= now).length,
    openCallbacksCount: openFollowUps.filter((item) =>
      (item.note ?? '').toLowerCase().includes('rückruf'),
    ).length,
    openRelativeContactsCount: openCases.filter((item) => isRelativeCase(item)).length,
    casesWithoutNextStepCount: openCases.filter(
      (item) => !item.nextAppointmentAt && !casesWithFollowUp.has(item.id),
    ).length,
    deadlinesEscalationsCount: openFollowUps.filter((item) => new Date(item.dueAt).getTime() < now).length,
    closedThisWeekCount: items.filter(
      (item) => item.status === 'abgeschlossen' && isWithinLastWeek(item.updatedAt),
    ).length,
    openReportsCount: protocols.filter((item) => item.status === 'entwurf').length,
  };
}

function mapLiveCaseRow(row: {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}): CounselingListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    subject: row.title,
    category: 'Allgemein',
    openedAt: row.created_at,
    nextAppointmentAt: null,
    status: (row.status === 'aktiv' || row.status === 'entwurf' || row.status === 'abgeschlossen'
      ? row.status
      : 'entwurf') as CounselingListItem['status'],
    updatedAt: row.updated_at,
    clientName: '—',
    counselorName: '—',
  };
}

export async function fetchCounselingCaseList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CounselingListItem[]>> {
  const denied = enforcePermission<CounselingListItem[]>(
    actorRoleKey,
    'beratung.cases.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await beratungSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    return { ok: true, data: result.data.map(mapLiveCaseRow) };
  }

  await new Promise((r) => setTimeout(r, 260));
  return { ok: true, data: getDemoCounselingCaseListItems() };
}

export async function fetchBeratungDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BeratungDashboardStats>> {
  const denied = enforcePermission<BeratungDashboardStats>(actorRoleKey, 'beratung.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  await new Promise((r) => setTimeout(r, 220));
  const listResult = await fetchCounselingCaseList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  if (getServiceMode() === 'supabase') {
    return {
      ok: true,
      data: {
        ...emptyBeratungDashboardStats(),
        ...buildDashboardStats(listResult.data),
      },
    };
  }

  return {
    ok: true,
    data: buildDashboardStats(
      listResult.data,
      getDemoCounselingProtocols(),
      getDemoFollowUps(),
    ),
  };
}

export async function fetchRecentCounselingCases(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CounselingListItem[]>> {
  const listResult = await fetchCounselingCaseList(tenantId, actorRoleKey);
  if (!listResult.ok) return listResult;

  const recent = listResult.data
    .filter((item) => isCaseOpen(item.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  return { ok: true, data: recent };
}

export async function createCounselingCase(
  actorRoleKey: RoleKey | null | undefined,
  input: { subject: string; category?: string },
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;

  if (!input.subject.trim()) {
    return { ok: false, error: 'Bezeichnung ist erforderlich.' };
  }

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Live-Anlage: Repository erweitern.' };
  }

  await new Promise((r) => setTimeout(r, 300));
  const created = createDemoCounselingCase({
    subject: input.subject.trim(),
    category: input.category,
  });
  return { ok: true, data: { id: created.id } };
}
