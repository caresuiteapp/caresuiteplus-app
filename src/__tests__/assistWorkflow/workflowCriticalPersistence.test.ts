import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const source = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('critical employee workflow persistence', () => {
  it('awaits arrival execution-state and live-monitor mirrors', () => {
    const file = source('src/features/assistWorkflow/markArrived.ts');
    expect(file).toContain('await upsertAssistVisitExecutionState');
    expect(file).toContain('await mirrorAssistVisitStatusFromAssignment');
    expect(file).not.toContain('void upsertAssistVisitExecutionState');
    expect(file).not.toContain('void mirrorAssistVisitStatusFromAssignment');
  });

  it('awaits end-of-service mirrors and retries them on idempotent replay', () => {
    const file = source('src/features/assistWorkflow/endService.ts');
    expect(file).toContain('persistEndedExecutionMirrors');
    expect(file).toMatch(/if \(ctx\.visitTimes\?\.serviceEndedAt\)[\s\S]*persistEndedExecutionMirrors/);
    expect(file).not.toContain('void mirrorAssistVisitStatusFromAssignment');
  });

  it('records the submitting profile and confirms documentation state', () => {
    const file = source('src/features/assistWorkflow/saveVisitDocumentation.ts');
    expect(file).toContain('submitted_by: profileId');
    expect(file).toContain('const executionState = await upsertAssistVisitExecutionState');
    expect(file).not.toContain('void upsertAssistVisitExecutionState');
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
    expect(file).toMatch(
      /didWorkflowActionReachPostcondition\(options\.recoveryAction, ctx, recovered\)[\s\S]*return \{ ok: true, data: recovered as T \}/,
    );
  });
});
