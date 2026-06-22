import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import type { TenantSearchEntityKind } from './tenantSearchTypes';

export function resolveTenantSearchHref(
  kind: TenantSearchEntityKind,
  id: string,
  options?: { clientId?: string | null; assignmentId?: string | null },
): string {
  switch (kind) {
    case 'client':
      return clientRecordRoute(id);
    case 'employee':
      return `/office/employees/${id}`;
    case 'assignment':
      return `/assist/assignments/${id}`;
    case 'execution':
      return `/assist/assignments/${options?.assignmentId ?? id}/execute`;
    case 'trip':
      return `/assist/fahrten/${id}`;
    case 'case':
      return `/beratung/cases/${id}`;
    case 'course':
      return `/akademie/courses/${id}`;
    case 'communication':
      return `/business/messages/${id}`;
    case 'office_message':
      return `/office/messages/${id}`;
    case 'appointment':
      return `/office/appointments/${id}`;
    case 'invoice':
      return `/office/invoices/${id}`;
    case 'document':
      if (options?.clientId) {
        return `${clientRecordRoute(options.clientId)}/documents?doc=${id}`;
      }
      return '/office/documents';
    case 'resident':
      return `/stationaer/bewohner/${id}`;
    case 'care_plan':
      return `/pflege/plans/${id}`;
    default:
      return '/business';
  }
}
