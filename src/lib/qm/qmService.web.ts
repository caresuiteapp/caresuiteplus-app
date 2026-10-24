import type { RoleKey, ServiceResult } from '@/types';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { enforceQmPermission, QM_VIEW } from './qmPermissions';
import { qmDemoRepository } from './qmRepository.demo';
import { readQmDashboardSnapshot } from './qmDashboardRepository.web';
import type { QmDashboardSnapshot } from './qm.types';

export async function fetchQmDashboard(tenantId: string, actorRoleKey?: RoleKey | null): Promise<ServiceResult<QmDashboardSnapshot>> {
  const denied = enforceQmPermission<QmDashboardSnapshot>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const blocked = guardServiceTenant(tenantId);
  if (blocked) return blocked;
  if (getServiceMode() !== 'demo') return readQmDashboardSnapshot(tenantId);

  const [chapters, documents, packages, compliance, audits, changes] = await Promise.all([
    qmDemoRepository.listChapters(tenantId), qmDemoRepository.listDocuments(tenantId),
    qmDemoRepository.listMdPackages(tenantId), qmDemoRepository.listCompliance(tenantId),
    qmDemoRepository.listAudits(tenantId), qmDemoRepository.listChanges(tenantId),
  ]);
  if (!chapters.ok) return chapters;
  if (!documents.ok) return documents;
  if (!packages.ok) return packages;
  if (!compliance.ok) return compliance;
  if (!audits.ok) return audits;
  if (!changes.ok) return changes;
  return {
    ok: true,
    data: {
      chapterCount: chapters.data.length, documentCount: documents.data.length,
      complianceOpenCount: compliance.data.filter(item => ['open', 'in_progress', 'overdue'].includes(item.status)).length,
      mdPackageCount: packages.data.length,
      pendingApprovals: documents.data.filter(item => item.status === 'in_review').length,
      recentChanges: [...changes.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
      upcomingAudits: audits.data.filter(item => item.status !== 'completed')
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).slice(0, 5),
      loadedAt: new Date().toISOString(),
    },
  };
}

export { qmSupabaseRepository as qmRepo } from './qmRepository.supabase';
