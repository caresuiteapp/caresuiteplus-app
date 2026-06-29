/**
 * ASSIST.WORKFLOW.1 — End service / checkout.
 */
import type { ServiceResult } from '@/types';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import type { AssistExecutionContext } from './types';

export async function endService(
  ctx: AssistExecutionContext,
): Promise<ServiceResult<AssistExecutionContext>> {
  return transitionAssistExecutionStatus(ctx, 'beendet');
}
