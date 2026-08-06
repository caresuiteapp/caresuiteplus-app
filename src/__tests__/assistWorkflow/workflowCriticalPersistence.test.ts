import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const source = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('critical employee workflow persistence', () => {
  it('repairs an already-started assignment whose canonical timer event is missing', () => {
    const file = source('src/hooks/useEmployeePortalVisitExecution.ts');
    expect(file).toContain('serviceStartRepairRef');
    expect(file).toContain("ctx.assignmentStatus !== 'gestartet'");
    expect(file).toContain("timeoutLabel: 'repairServiceStart'");
  });
  it('awaits arrival source records but defers live-monitor projections', () => {
    const file = source('src/features/assistWorkflow/markArrived.ts');
    expect(file).toContain('await upsertAssistVisitExecutionState');
    expect(file).toContain('await mirrorAssistVisitStatusFromAssignment');
    expect(file).toContain('scheduleDeferredTask');
    expect(file).toContain('await persistEmployeePortalStatusTransition');
  });

  it('persists service_end before scheduling derived administration mirrors', () => {
    const file = source('src/features/assistWorkflow/endService.ts');
    expect(file).toContain('persistEndedExecutionMirrors');
    expect(file).toMatch(/if \(ctx\.visitTimes\?\.serviceEndedAt\)[\s\S]*persistEndedExecutionMirrors/);
    expect(file).toContain('scheduleDeferredTask');
    expect(file).toContain("eventType: 'service_end'");
  });

  it('records the submitting profile canonically and defers duplicate snapshots', () => {
    const file = source('src/features/assistWorkflow/saveVisitDocumentation.ts');
    expect(file).toContain('submitted_by: profileId');
    expect(file).toContain('const executionState = await upsertAssistVisitExecutionState');
    expect(file).toContain('scheduleDeferredTask');
  });

  it('does not silently accept database errors for no-show reporting', () => {
    const file = source('src/features/assistWorkflow/reportNoShow.ts');
    expect(file).toContain('if (visitError)');
    expect(file).toContain('if (assignmentError)');
  });

  it('does not turn an arbitrary refresh into timeout success', () => {
    const file = source('src/hooks/useEmployeePortalVisitExecution.ts');
    expect(file).toContain('didWorkflowActionReachPostcondition');
    expect(file).toContain('WORKFLOW_ACTION_TIMEOUT_UNCONFIRMED');
    expect(file).toContain('didWorkflowActionReachPostcondition(options.recoveryAction, ctx, refreshed)');
    expect(file).toContain('return { ok: true, data: refreshed as T };');
    expect(file).toContain('workflowRecoveryReadback');
    expect(file).toContain('void refreshExecutionContext().then');
  });

  it('keeps ordinary actions bounded but gives canonical service start a mobile-safe budget', () => {
    const file = source('src/features/assistWorkflow/internal/withWorkflowTimeout.ts');
    expect(file).toContain('WORKFLOW_ACTION_TIMEOUT_MS = 15_000');
    expect(file).toContain('WORKFLOW_START_SERVICE_TIMEOUT_MS = 20_000');
    expect(file).toContain('WORKFLOW_END_SERVICE_TIMEOUT_MS = 15_000');
  });

  it('never blocks the canonical service start on GPS permission or position capture', () => {
    const file = source('src/hooks/useEmployeePortalVisitExecution.ts');
    expect(file).toContain('GPS is ancillary');
    expect(file).toContain('void (async () =>');
    expect(file).toContain('timeoutMs: WORKFLOW_START_SERVICE_TIMEOUT_MS');
  });

  it('reuses the already-authorized screen detail instead of reloading the assignment before each transition', () => {
    const transition = source('src/features/assistWorkflow/internal/transitionAssistExecutionStatus.ts');
    const liveService = source('src/lib/portal/employeePortalExecutionLiveService.ts');
    const repository = source('src/lib/assist/repositories/assignmentRepository.supabase.ts');
    expect(transition).toContain('knownDetail: options.fastWorkflow ? ctx.detail : undefined');
    expect(liveService).toContain('mapPortalDetailToAssignmentDetail(options.knownDetail, employeeId)');
    expect(repository).toContain('Return after the authoritative status/timestamp write');
  });

  it('loads tracking and canonical time events together on the initial execution screen', () => {
    const liveContext = source('src/features/liveTracking/resolveEmployeeLiveContext.ts');
    const executionContext = source('src/features/assistWorkflow/resolveAssistExecutionContext.ts');
    expect(liveContext).toContain('fetchTimeEventsForVisit(tenantId, resolution.visitId, 100)');
    expect(liveContext).toContain('timeEventsLoaded: timeEventsResult.ok');
    expect(executionContext).toContain('liveResult.data.timeEventsLoaded');
  });
});
