/**
 * ASSIST.WORKFLOW.1 — Report no-show with required note.
 */
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { getServiceMode } from '@/lib/services/mode';
import { transitionAssistExecutionStatus } from './internal/transitionAssistExecutionStatus';
import type { AssistExecutionContext } from './types';
import {
  assistWorkflowErrorToResult,
  createAssistWorkflowError,
} from './assistWorkflowErrors';

export async function reportNoShow(
  ctx: AssistExecutionContext,
  note: string,
): Promise<ServiceResult<AssistExecutionContext>> {
  if (!note.trim()) {
    return assistWorkflowErrorToResult(
      createAssistWorkflowError('AWF_NO_SHOW_NOTE_REQUIRED', {
        tenantId: ctx.tenantId,
        assignmentId: ctx.assignmentId,
        operation: 'reportNoShow',
      }),
    );
  }

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (supabase) {
      await fromUnknownTable(supabase, 'assist_visits')
        .update({
          execution_status: 'no_show',
          error_message: note.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', ctx.tenantId)
        .eq('id', ctx.assistVisitId);

      await fromUnknownTable(supabase, 'assignments')
        .update({
          documentation_notes: note.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', ctx.tenantId)
        .eq('id', ctx.assignmentId);
    }
  }

  return transitionAssistExecutionStatus(ctx, 'nicht_erschienen', {
    noShowNote: note.trim(),
  });
}
