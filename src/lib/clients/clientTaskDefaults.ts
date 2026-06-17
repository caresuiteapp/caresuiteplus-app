import type { ClientTask } from '@/types/modules/client';

export const CLIENT_TASK_ASSIST_DEFAULTS: Pick<
  ClientTask,
  | 'moduleKey'
  | 'leistungsbereich'
  | 'subcategory'
  | 'packageId'
  | 'leistungsart'
  | 'isMandatory'
  | 'proofRequired'
  | 'documentationRequired'
  | 'billingRelevant'
  | 'visibleToClient'
> = {
  moduleKey: 'assist',
  leistungsbereich: null,
  subcategory: null,
  packageId: null,
  leistungsart: null,
  isMandatory: false,
  proofRequired: false,
  documentationRequired: true,
  billingRelevant: true,
  visibleToClient: true,
};

export function normalizeClientTask(task: ClientTask): ClientTask {
  return { ...CLIENT_TASK_ASSIST_DEFAULTS, ...task };
}
