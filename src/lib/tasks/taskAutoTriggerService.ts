import type { AutoTaskTriggerType } from '@/types/modules/internalTasks';
import { createInternalTaskFromAutoTrigger } from './internalTaskService';
import { createTeamThread } from './teamCommunicationService';

/** Zentralisierte Auto-Auslöser für interne Aufgaben (Prompt 69 H) */
export function triggerInternalTaskFromEvent(input: {
  tenantId: string;
  trigger: AutoTaskTriggerType;
  description?: string;
  linkedEntityType?: Parameters<typeof createInternalTaskFromAutoTrigger>[0]['linkedEntityType'];
  linkedEntityId?: string | null;
  notifyChannel?: Parameters<typeof createTeamThread>[0]['channelKey'];
}): ReturnType<typeof createInternalTaskFromAutoTrigger> {
  const task = createInternalTaskFromAutoTrigger({
    tenantId: input.tenantId,
    trigger: input.trigger,
    description: input.description,
    linkedEntityType: input.linkedEntityType,
    linkedEntityId: input.linkedEntityId,
  });

  if (input.notifyChannel) {
    createTeamThread({
      tenantId: input.tenantId,
      channelKey: input.notifyChannel,
      title: task.title,
      linkedTaskId: task.id,
      createdByUserId: null,
    });
  }

  return task;
}

export const AUTO_TRIGGER_CHANNEL_MAP: Partial<
  Record<AutoTaskTriggerType, Parameters<typeof createTeamThread>[0]['channelKey']>
> = {
  cancel_request: 'dispatch',
  reschedule_request: 'dispatch',
  problem_report: 'dispatch',
  emergency_report: 'management',
  missing_documentation: 'dispatch',
  missing_signature: 'dispatch',
  service_record_review: 'qm',
  invoice_blocked: 'billing',
  budget_exceeded: 'billing',
  connect_error: 'system_messages',
  privacy_request: 'internal_admin',
  system_error: 'system_messages',
};

export function triggerWithDefaultChannel(input: {
  tenantId: string;
  trigger: AutoTaskTriggerType;
  description?: string;
  linkedEntityType?: Parameters<typeof createInternalTaskFromAutoTrigger>[0]['linkedEntityType'];
  linkedEntityId?: string | null;
}) {
  return triggerInternalTaskFromEvent({
    ...input,
    notifyChannel: AUTO_TRIGGER_CHANNEL_MAP[input.trigger],
  });
}
