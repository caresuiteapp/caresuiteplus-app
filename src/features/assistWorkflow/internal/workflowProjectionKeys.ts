import type { AssistExecutionContext } from '../types';

/** Shared key for coalescing documentation/signature proof projections. */
export function assistProofProjectionKey(ctx: AssistExecutionContext): string {
  return `assist-proof:${ctx.tenantId}:${ctx.assignmentId}`;
}
