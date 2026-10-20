import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Evaluate the actual screen decisions without rendering unrelated portal modules.
function expression(ast: ts.SourceFile, name: string, values: Record<string, unknown>): unknown {
  let initializer: ts.Expression | undefined;
  function find(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) initializer = node.initializer;
    ts.forEachChild(node, find);
  }
  find(ast);
  if (!initializer) throw new Error(`Missing screen decision: ${name}`);
  const js = ts.transpileModule('const result = ' + initializer.getText(ast) + ';', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function(...Object.keys(values), js + '; return result;')(...Object.values(values));
}

const idle = {
  loading: false, driveLoading: false, actionLoading: false, startServiceLoading: false,
  arrivalConfirmationPending: false, locationDisclosureLoading: false, deviationSubmitting: false,
  signatureConfirmationPending: false, signatureConfirmationStalled: false,
  workflowWaitStalled: false,
};

describe.each(['.web', ''])('employee visit confirmation remains accessible (%s)', (platform) => {
  const file = path.join(__dirname, `../../screens/portal/EmployeePortalVisitExecutionScreen${platform}.tsx`);
  const ast = ts.createSourceFile('screen.tsx', readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const decision = (name: string, values: Record<string, unknown>) => expression(ast, name, values);
  it('leaves the page uncovered while a timed-out workflow is unconfirmed', () => {
    expect(decision('blockingWorkflowLoading', { ...idle, workflowConfirmationPending: true, taskSaving: false })).toBe(false);
  });

  it('does not cover the visit for an unrelated optional task save that never replies', () => {
    expect(decision('blockingWorkflowLoading', { ...idle, workflowConfirmationPending: false, taskSaving: true })).toBe(false);
  });

  it('shows a clear warning, keeps status checking available and blocks a duplicate action', () => {
    const warning = 'Die Speicherung ist noch nicht bestätigt.';
    expect(decision('guide', { workflowConfirmationPending: true, refetchWarning: warning })).toEqual({ tone: 'warning', message: warning });
    expect(decision('guideNeedsRefresh', { workflowConfirmationPending: true })).toBe(true);
    expect(decision('primaryButtonDisabled', { readOnlyExecution: false, workflowConfirmationPending: true })).toBe(true);
  });

  it('still shows feedback during the original, bounded service-end request', () => {
    expect(decision('blockingWorkflowLoading', { ...idle, actionLoading: true })).toBe(true);
  });

  it.each(['driveLoading', 'actionLoading', 'startServiceLoading', 'arrivalConfirmationPending', 'locationDisclosureLoading', 'deviationSubmitting'])('leaves status checking accessible when %s does not answer', (flag) => {
    expect(decision('blockingWorkflowLoading', { ...idle, [flag]: true, workflowWaitStalled: true })).toBe(false);
    expect(decision('guide', { workflowConfirmationPending: false, workflowWaitStalled: true })).toMatchObject({ tone: 'warning' });
    expect(decision('guideNeedsRefresh', { workflowConfirmationPending: false, workflowWaitStalled: true })).toBe(true);
    expect(decision('primaryButtonDisabled', { readOnlyExecution: false, workflowConfirmationPending: false, workflowWaitStalled: true })).toBe(true);
  });
});
