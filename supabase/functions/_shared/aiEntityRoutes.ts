export type AiEntityType =
  | 'client'
  | 'employee'
  | 'appointment'
  | 'document'
  | 'case'
  | 'task';

function clientRecordRoute(clientId: string): string {
  return `/business/office/clients/${clientId}`;
}

export function resolveEntityRoute(
  entityType: AiEntityType | string,
  entityId: string,
  options?: { tab?: string; documentId?: string },
): string {
  switch (entityType) {
    case 'client':
      if (options?.tab === 'documents') {
        return `${clientRecordRoute(entityId)}/documents`;
      }
      if (options?.tab === 'care') {
        return `${clientRecordRoute(entityId)}/care`;
      }
      return clientRecordRoute(entityId);
    case 'employee':
      return `/business/office/employees/${entityId}`;
    case 'appointment':
      return `/office/appointments/${entityId}`;
    case 'document':
      if (options?.documentId) {
        return `/business/office/clients/${entityId}/documents?doc=${options.documentId}`;
      }
      return clientRecordRoute(entityId);
    case 'case':
      return `/beratung/faelle/${entityId}`;
    case 'task':
      return `/business/office/clients/${entityId}?tab=aufgaben`;
    default:
      return clientRecordRoute(entityId);
  }
}

export function resolveModuleHomeRoute(module: string): string {
  const map: Record<string, string> = {
    business: '/business',
    office: '/business/office',
    assist: '/assist',
    beratung: '/beratung',
    akademie: '/akademie',
    stationaer: '/stationaer',
    dashboard: '/business',
  };
  return map[module] ?? '/business';
}
