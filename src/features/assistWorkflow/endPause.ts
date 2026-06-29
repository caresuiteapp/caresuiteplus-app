/**
 * ASSIST.WORKFLOW.1 — End pause and resume service.
 */
import type { ServiceResult } from '@/types';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import type { AssistExecutionContext } from './types';

export async function endPause(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  return transitionAssistExecutionStatus(ctx, 'gestartet');
}
