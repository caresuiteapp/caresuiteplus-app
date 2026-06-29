/**
 * ASSIST.WORKFLOW.1 — Start pause during service.
 */
import type { ServiceResult } from '@/types';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import type { AssistExecutionContext } from './types';

export async function startPause(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  return transitionAssistExecutionStatus(ctx, 'pausiert');
}
