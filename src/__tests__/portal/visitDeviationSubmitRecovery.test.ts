import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

function submitHandler(platform: string, values: Record<string, unknown>) {
  const file = path.join(__dirname, `../../screens/portal/EmployeePortalVisitExecutionScreen${platform}.tsx`);
  const ast = ts.createSourceFile('screen.tsx', readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression: ts.Expression | undefined;
  function find(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'WfmVisitDeviationJustificationModal') {
      const attr = node.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'onSubmit');
      if (attr && ts.isJsxAttribute(attr) && attr.initializer && ts.isJsxExpression(attr.initializer)) expression = attr.initializer.expression;
    }
    ts.forEachChild(node, find);
  }
  find(ast);
  if (!expression) throw new Error('Deviation callback missing');
  const js = ts.transpileModule('const handler = ' + expression.getText(ast) + ';', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function(...Object.keys(values), js + '; return handler;')(...Object.values(values)) as (text: string) => Promise<void>;
}

function setup(platform: string) {
  const state = { submitting: false, error: null as string | null };
  const values = {
    deviationInFlight: { current: new Set<string>() },
    resolveDeviationCheck: () => ({ planned: '2026-10-07T10:00:00Z', actual: '2026-10-07T10:20:00Z' }),
    deviationModal: { phase: 'end', pendingAction: 'end_service' },
    signatureViewScope: 'visit-1',
    signatureViewScopeRef: { current: 'visit-1' },
    signatureViewMountedRef: { current: true },
    setDeviationSubmitting: (value: boolean) => { state.submitting = value; },
    setDeviationError: (value: string | null) => { state.error = value; },
    submitVisitDeviationJustification: vi.fn().mockResolvedValue({ ok: true }),
    executionContext: { tenantId: 'tenant-1', employeeId: 'employee-1', assistVisitId: 'visit-1', assignmentId: 'visit-1', detail: { clientName: 'Test' } },
    actorId: 'actor-1',
    setDeviationModal: vi.fn(),
    proceedAfterDeviation: vi.fn().mockResolvedValue(undefined),
  };
  return { state, values, submit: submitHandler(platform, values) };
}

describe.each(['.web', ''])('deviation submit recovery (%s)', (platform) => {
  it('releases the busy state on rejection and permits correction without executing the visit action', async () => {
    const { state, values, submit } = setup(platform);
    values.submitVisitDeviationJustification.mockRejectedValueOnce(new Error('Storage failure'));
    await submit('Test justification');
    expect(state.submitting).toBe(false);
    expect(state.error).toMatch(/erneut versuchen/);
    expect(values.proceedAfterDeviation).not.toHaveBeenCalled();
    await submit('Corrected justification');
    expect(values.proceedAfterDeviation).toHaveBeenCalledTimes(1);
  });

  it('ignores a double tap while the justification is still being processed', async () => {
    const { state, values, submit } = setup(platform);
    let resolve!: (value: { ok: boolean }) => void;
    values.submitVisitDeviationJustification.mockReturnValue(new Promise((done) => { resolve = done; }));
    const first = submit('Test justification');
    await submit('Second tap');
    expect(values.submitVisitDeviationJustification).toHaveBeenCalledTimes(1);
    expect(state.submitting).toBe(true);
    resolve({ ok: true });
    await first;
    expect(state.submitting).toBe(false);
    expect(values.proceedAfterDeviation).toHaveBeenCalledTimes(1);
  });

  it('keeps each visit protected independently when an old reply arrives during the next submission', async () => {
    const { state, values, submit } = setup(platform);
    let resolveFirst!: (value: { ok: boolean }) => void;
    let resolveSecond!: (value: { ok: boolean }) => void;
    values.submitVisitDeviationJustification
      .mockReturnValueOnce(new Promise((done) => { resolveFirst = done; }))
      .mockReturnValueOnce(new Promise((done) => { resolveSecond = done; }));
    const first = submit('First visit justification');
    values.signatureViewScopeRef.current = 'visit-2';
    const secondSubmit = submitHandler(platform, { ...values, signatureViewScope: 'visit-2' });
    const second = secondSubmit('Next visit justification');
    await secondSubmit('Duplicate next visit tap');
    expect(values.submitVisitDeviationJustification).toHaveBeenCalledTimes(2);
    resolveFirst({ ok: true });
    await first;
    expect(state.submitting).toBe(true);
    expect(values.proceedAfterDeviation).not.toHaveBeenCalled();
    resolveSecond({ ok: true });
    await second;
    expect(state.submitting).toBe(false);
    expect(values.proceedAfterDeviation).toHaveBeenCalledTimes(1);
  });

  it('does not execute a stale visit action after changing to another visit', async () => {
    const { values, submit } = setup(platform);
    let resolve!: (value: { ok: boolean }) => void;
    values.submitVisitDeviationJustification.mockReturnValue(new Promise((done) => { resolve = done; }));
    const request = submit('Test justification');
    values.signatureViewScopeRef.current = 'visit-2';
    resolve({ ok: true });
    await request;
    expect(values.proceedAfterDeviation).not.toHaveBeenCalled();
  });
});
