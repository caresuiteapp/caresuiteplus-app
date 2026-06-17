import type { WorkflowStatus } from '@/types/core/base';
import type { ClientListOptions } from './types';

/** Live DB statuses included in Lebenszyklus „Aktiv“ (ohne Entwürfe/Archiv). */
export const ACTIVE_CLIENT_LIFECYCLE_STATUSES = [
  'active',
  'paused',
  'inactive',
  'blocked',
  'deceased',
] as const;

export function resolveClientListQueryOptions(
  options?: ClientListOptions,
): ClientListOptions | undefined {
  if (!options) return options;

  if (options.statusFilter === 'entwurf') {
    return { ...options, lifecycleFilter: 'all' };
  }

  return options;
}

export function isDraftStatusFilter(
  statusFilter: WorkflowStatus | 'all' | undefined,
): boolean {
  return statusFilter === 'entwurf';
}
