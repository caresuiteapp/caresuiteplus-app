/**
 * ASSIST.WORKFLOW.1 — Start service at client.
 */
import type { ServiceResult } from '@/types';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import type { AssistExecutionContext } from './types';

export async function startService(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  return transitionAssistExecutionStatus(ctx, 'gestartet');
}
