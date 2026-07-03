import type { ServiceResult } from '@/types';
import type { PortalEmployeePersonnelView } from '@/types/portal/employeePersonnel';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';
import { loadEmployeePersonnelFileLive } from '@/lib/office/employeePersonnelFileLiveLoader';
import { filterPersonnelDocumentsForViewer } from '@/lib/office/employeePersonnelAccess';
import { buildPersonnelAccessContext } from '@/lib/office/employeePersonnelAccess';
import { runService } from '@/lib/services/serviceRunner';
import { fetchLiveEmployeePortalProfile } from './employeeProfileLiveService';
import { projectEmployeePersonnelForPortal } from './employeePortalPersonnelProjection';

export async function fetchLiveEmployeePortalPersonnelView(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<PortalEmployeePersonnelView>> {
  return runService(async () => {
    const [fileResult, profileResult] = await Promise.all([
      loadEmployeePersonnelFileLive(tenantId, employeeId),
      fetchLiveEmployeePortalProfile(tenantId, employeeId),
    ]);

    if (!fileResult.ok) {
      return { ok: false, error: 'Profildaten konnten nicht geladen werden.' };
    }

    const accessCtx = buildPersonnelAccessContext({
      tenantId,
      roleKey: 'employee_portal',
      employeeId,
      targetEmployeeId: employeeId,
    });

    const file = {
      ...fileResult.data,
      documents: filterPersonnelDocumentsForViewer(accessCtx, fileResult.data.documents),
    };

    const profile = profileResult.ok ? profileResult.data : null;

    return {
      ok: true,
      data: projectEmployeePersonnelForPortal(file, profile),
    };
  });
}

export async function fetchDemoEmployeePortalPersonnelView(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<PortalEmployeePersonnelView>> {
  return runService(async () => {
    const file = getDemoEmployeePersonnelFile(employeeId);
    if (!file || file.tenantId !== tenantId) {
      return { ok: false, error: 'Mitarbeiterprofil nicht gefunden.' };
    }

    const accessCtx = buildPersonnelAccessContext({
      tenantId,
      roleKey: 'employee_portal',
      employeeId,
      targetEmployeeId: employeeId,
    });

    const filtered = {
      ...file,
      documents: filterPersonnelDocumentsForViewer(accessCtx, file.documents),
    };

    return {
      ok: true,
      data: projectEmployeePersonnelForPortal(filtered, null),
    };
  });
}
