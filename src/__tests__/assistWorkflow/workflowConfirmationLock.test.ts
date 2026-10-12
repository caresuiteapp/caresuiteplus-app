
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, expect, it, vi } from 'vitest';
import * as timeouts from '@/features/assistWorkflow/internal/withWorkflowTimeout';
import { createSingleFlight } from '@/lib/services/singleFlight';

type Result = { ok: boolean; data?: unknown; errorCode?: string };
type Run = (fn: () => Promise<Result>, options?: { timeoutMs?: number; recoveryAction?: string; onLateFailure?: (message: string) => void; buildRecoveryExpectation?: () => unknown; preferExistingContext?: boolean }) => Promise<Result>;
// Execute the actual callback with controlled service boundaries, avoiding a copy of its logic.
const source = readFileSync(path.join(__dirname, '../../hooks/useEmployeePortalVisitExecution.ts'), 'utf8');
const ast = ts.createSourceFile('hook.ts', source, ts.ScriptTarget.Latest, true);
let callback: ts.Expression | undefined;
let checkCallback: ts.Expression | undefined;
function find(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'runWorkflow' && node.initializer && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0];
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'checkPendingWorkflowConfirmation' && node.initializer && ts.isCallExpression(node.initializer)) checkCallback = node.initializer.arguments[0];
  ts.forEachChild(node, find);
}
find(ast);
if (!callback) throw new Error('Workflow callback missing');
if (!checkCallback) throw new Error('Confirmation check callback missing');
const js = ts.transpileModule('const run = ' + callback.getText(ast) + ';', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const checkJs = ts.transpileModule('const check = ' + checkCallback.getText(ast) + ';', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function fixture() {
  const ctx = { tenantId: 'tenant', employeeId: 'employee', assignmentId: 'assignment', assistVisitId: 'visit', detail: {} };
  const state = { pending: false, loading: false }, workflowInFlight = { current: false };
  const syncAfterWorkflow = vi.fn(async () => ctx);
  const refreshExecutionContext = vi.fn(async (): Promise<typeof ctx | null> => null);
  const ensurePortalWriteSession = vi.fn(async () => ({ ok: true }));
  const resolveAssistExecutionContext = vi.fn(async () => ({ ok: true, data: ctx }));
  const workflowAttemptRef = { current: 0 }, signatureScopeRef = { current: 'scope' };
  const pendingWorkflowConfirmationRef = { current: null as null | { complete: () => void } };
  const readWorkflowActionConfirmation = vi.fn(async (): Promise<{ state: string; context?: typeof ctx }> => ({ state: 'pending' }));
  const deps = { ...timeouts, workflowInFlight, workflowAttemptRef, signatureScopeRef, signatureScopeKey: 'scope', pendingWorkflowConfirmationRef,
    readWorkflowActionConfirmation, tenantId: ctx.tenantId, employeeId: ctx.employeeId, assignmentId: ctx.assignmentId,
    executionContextRef: { current: ctx }, executionContext: ctx, query: { data: ctx.detail },
    confirmedTaskAdditionsRef: { current: null }, mergeConfirmedOptionalTasks: (tasks: unknown) => tasks,
    portalSession: {}, ensurePortalWriteSession, syncAfterWorkflow, refreshExecutionContext, resolveAssistExecutionContext, authProfileId: 'profile', roleKey: 'employee_portal', runCanonicalMutation: createSingleFlight(),
    setWorkflowConfirmationPending: (value: boolean) => { state.pending = value; },
    setStartServiceLoading: (value: boolean) => { state.loading = value; },
    setWorkflowLoading: (value: boolean) => { state.loading = value; }, setRefetchWarning: vi.fn(),
    unwrapWorkflowContextPayload: (value: unknown) => value && typeof value === 'object' && 'detail' in value ? value : null,
    didWorkflowActionReachPostcondition: () => false, isStaleWorkflowTransitionError: () => false };
  const check = new Function(...Object.keys(deps), checkJs + '; return check;')(...Object.values(deps)) as () => Promise<void>;
  const runDeps = { ...deps, checkPendingWorkflowConfirmation: check };
  const run = new Function(...Object.keys(runDeps), js + '; return run;')(...Object.values(runDeps)) as Run;
  return { run, check, ctx, state, workflowInFlight, workflowAttemptRef, signatureScopeRef,
    pendingWorkflowConfirmationRef, readWorkflowActionConfirmation, syncAfterWorkflow, refreshExecutionContext, ensurePortalWriteSession, resolveAssistExecutionContext };
}
afterEach(() => vi.useRealTimers());
it('finalizes only from a fresh read and never uses the cached fallback when that read failed', async () => {
  const f = fixture(), action = vi.fn(async () => ({ ok: true, data: f.ctx }));
  f.resolveAssistExecutionContext.mockResolvedValueOnce({ ok: false, error: 'fresh read unavailable' } as never);
  expect((await f.run(action, { preferExistingContext: false })).errorCode).toBe('WORKFLOW_FINAL_CONTENT_UNAVAILABLE');
  expect(action).not.toHaveBeenCalled(); expect(f.refreshExecutionContext).not.toHaveBeenCalled();
  await f.run(action, { preferExistingContext: false });
  expect(f.resolveAssistExecutionContext).toHaveBeenLastCalledWith(expect.objectContaining({ autoRepair: false }));
  expect(action).toHaveBeenCalledOnce();
});

it('rejects a callback retained after its execution screen was detached before another write starts', async () => {
  const f = fixture();
  f.signatureScopeRef.current = '';
  const action = vi.fn(async () => ({ ok: true, data: f.ctx }));
  expect((await f.run(action)).errorCode).toBe('WORKFLOW_SCOPE_CHANGED');
  expect(action).not.toHaveBeenCalled();
  expect(f.ensurePortalWriteSession).not.toHaveBeenCalled();
});

it('keeps one submission locked through timeout, late success, and final reconciliation', async () => {
  vi.useFakeTimers(); const f = fixture(), write = deferred<Result>(), sync = deferred<typeof f.ctx>();
  f.syncAfterWorkflow.mockImplementation(() => sync.promise);
  const action = vi.fn(() => write.promise);
  const first = f.run(action, { timeoutMs: 10 });
  expect((await f.run(action)).errorCode).toBe('WORKFLOW_ACTION_TIMEOUT_UNCONFIRMED');
  await vi.advanceTimersByTimeAsync(10);
  expect((await first).errorCode).toBe('WORKFLOW_ACTION_TIMEOUT_UNCONFIRMED');
  expect(f.state.pending).toBe(true); expect(f.workflowInFlight.current).toBe(true);
  write.resolve({ ok: true, data: f.ctx }); await vi.advanceTimersByTimeAsync(0);
  expect(f.syncAfterWorkflow).toHaveBeenCalledTimes(1); expect(f.workflowInFlight.current).toBe(true);
  expect((await f.run(action)).ok).toBe(false); expect(action).toHaveBeenCalledTimes(1);
  sync.resolve(f.ctx); await vi.advanceTimersByTimeAsync(0);
  expect(f.state.pending).toBe(false); expect(f.workflowInFlight.current).toBe(false);
  expect((await f.run(async () => ({ ok: true, data: f.ctx }))).ok).toBe(true);
});
it('releases safely after a late rejected write and reports unconfirmed persistence', async () => {
  vi.useFakeTimers(); const f = fixture(), write = deferred<Result>(), onLateFailure = vi.fn();
  const first = f.run(() => write.promise, { timeoutMs: 10, onLateFailure });
  await vi.advanceTimersByTimeAsync(10); expect((await first).errorCode).toBe('WORKFLOW_ACTION_TIMEOUT_UNCONFIRMED');
  write.reject(new Error('offline')); await vi.advanceTimersByTimeAsync(0);
  expect(onLateFailure).toHaveBeenCalledTimes(1); expect(f.state.pending).toBe(false); expect(f.workflowInFlight.current).toBe(false);
});
it('handles a reply arriving in the same timer turn as the confirmation deadline', async () => {
  vi.useFakeTimers(); const f = fixture(), write = deferred<Result>();
  const first = f.run(() => write.promise, { timeoutMs: 10 });
  await vi.advanceTimersByTimeAsync(0);
  setTimeout(() => write.resolve({ ok: true, data: f.ctx }), 10);
  await vi.advanceTimersByTimeAsync(10); await first; await vi.advanceTimersByTimeAsync(0);
  expect(f.state.pending).toBe(false); expect(f.workflowInFlight.current).toBe(false); expect(f.syncAfterWorkflow).toHaveBeenCalledTimes(1);
});

it('stops the loading indicator when a request never replies and keeps duplicate submissions blocked', async () => {
  vi.useFakeTimers(); const f = fixture(), write = deferred<Result>();
  const action = vi.fn(() => write.promise);
  const first = f.run(action, { timeoutMs: 10, recoveryAction: 'end_service' });
  await vi.advanceTimersByTimeAsync(10);
  expect((await first).errorCode).toBe('WORKFLOW_ACTION_TIMEOUT_UNCONFIRMED');
  expect(f.state.loading).toBe(false);
  expect(f.state.pending).toBe(true);
  expect(f.syncAfterWorkflow).not.toHaveBeenCalled();
  await f.check();
  expect(f.state.pending).toBe(true);
  expect((await f.run(action)).ok).toBe(false);
  expect(action).toHaveBeenCalledTimes(1);
});

it('continues after a durable readback even when the original reply is permanently lost', async () => {
  vi.useFakeTimers(); const f = fixture(), write = deferred<Result>();
  const first = f.run(() => write.promise, { timeoutMs: 10, recoveryAction: 'end_service' });
  await vi.advanceTimersByTimeAsync(10); await first;
  f.readWorkflowActionConfirmation.mockResolvedValue({ state: 'confirmed', context: f.ctx });
  await f.check();
  expect(f.state.pending).toBe(false);
  expect(f.workflowInFlight.current).toBe(false);
  expect(f.syncAfterWorkflow).toHaveBeenCalledTimes(1);
  const nextWrite = deferred<Result>();
  const next = f.run(() => nextWrite.promise, { timeoutMs: 100, recoveryAction: 'save_documentation' });
  await vi.advanceTimersByTimeAsync(0);
  write.resolve({ ok: true, data: f.ctx });
  await vi.advanceTimersByTimeAsync(0);
  expect(f.syncAfterWorkflow).toHaveBeenCalledTimes(1);
  expect(f.workflowInFlight.current).toBe(true);
  expect(f.state.loading).toBe(true);
  nextWrite.resolve({ ok: true, data: f.ctx });
  expect((await next).ok).toBe(true);
});

it('coalesces concurrent status checks without sending another workflow mutation', async () => {
  vi.useFakeTimers(); const f = fixture(), write = deferred<Result>();
  const first = f.run(() => write.promise, { timeoutMs: 10, recoveryAction: 'end_service' });
  await vi.advanceTimersByTimeAsync(10); await first;
  const read = deferred<{ state: string }>();
  f.readWorkflowActionConfirmation.mockImplementation(() => read.promise);
  const check = f.check();
  await f.check();
  expect(f.readWorkflowActionConfirmation).toHaveBeenCalledTimes(2); // Initial timeout read plus one shared check.
  read.resolve({ state: 'unavailable' }); await check;
  expect(f.workflowInFlight.current).toBe(true);
  expect(f.state.pending).toBe(true);
});

it('ignores the old visit response after the workflow scope changes', async () => {
  vi.useFakeTimers(); const f = fixture(), write = deferred<Result>();
  const first = f.run(() => write.promise, { timeoutMs: 10 });
  await vi.advanceTimersByTimeAsync(0);
  f.signatureScopeRef.current = 'different-visit';
  f.workflowAttemptRef.current += 1;
  f.state.loading = true; // The new visit owns its own busy state.
  write.resolve({ ok: true, data: f.ctx });
  expect((await first).errorCode).toBe('WORKFLOW_SCOPE_CHANGED');
  expect(f.syncAfterWorkflow).not.toHaveBeenCalled();
  expect(f.state.loading).toBe(true);
});

it('keeps an ambiguous settled RPC locked until its durable read receipt arrives', async () => {
  const f = fixture();
  const action = vi.fn(async () => ({ ok: false, errorCode: 'WORKFLOW_ACTION_TIMEOUT_UNCONFIRMED' }));
  expect((await f.run(action, { recoveryAction: 'start_service' })).ok).toBe(false);
  expect(f.state.loading).toBe(false);
  expect(f.state.pending).toBe(true);
  expect(f.workflowInFlight.current).toBe(true);
  expect((await f.run(action, { recoveryAction: 'start_service' })).ok).toBe(false);
  expect(action).toHaveBeenCalledTimes(1);
  f.readWorkflowActionConfirmation.mockResolvedValue({ state: 'confirmed', context: f.ctx });
  await f.check();
  expect(f.state.pending).toBe(false);
  expect(f.workflowInFlight.current).toBe(false);
  expect(f.syncAfterWorkflow).toHaveBeenCalledTimes(1);
});

it('passes the attempted content version into failure recovery instead of accepting an older submitted flag', async () => {
  const f = fixture(); const expected = { kind: 'documentation', content: { short_description: 'Korrigiert' } };
  const result = await f.run(async () => ({ ok: false, errorCode: 'NETWORK' }), {
    recoveryAction: 'save_documentation', buildRecoveryExpectation: () => expected,
  });
  expect(result.ok).toBe(false);
  expect(f.readWorkflowActionConfirmation).toHaveBeenCalledWith(f.ctx, 'save_documentation', expected);
  expect(f.syncAfterWorkflow).not.toHaveBeenCalled();
});

it('retains the expected signature version while the original write is still awaiting confirmation', async () => {
  vi.useFakeTimers(); const f = fixture(), write = deferred<Result>();
  const expected = { kind: 'signature', signature: { signatureHash: 'new-image', payloadHash: 'new-content' } };
  const first = f.run(() => write.promise, { timeoutMs: 10, recoveryAction: 'save_signature', buildRecoveryExpectation: () => expected });
  await vi.advanceTimersByTimeAsync(10); await first;
  expect(f.readWorkflowActionConfirmation).toHaveBeenCalledWith(f.ctx, 'save_signature', expected);
  expect(f.workflowInFlight.current).toBe(true);
  await f.check(); expect(f.workflowInFlight.current).toBe(true);
  write.resolve({ ok: true, data: f.ctx }); await vi.advanceTimersByTimeAsync(0);
});

it('does not submit an old account after asynchronously preparing its signature hashes', async () => {
  const f = fixture(), prepared = deferred<unknown>(), action = vi.fn(async () => ({ ok: true, data: f.ctx }));
  const first = f.run(action, { recoveryAction: 'save_signature', buildRecoveryExpectation: () => prepared.promise });
  await Promise.resolve(); await Promise.resolve();
  f.signatureScopeRef.current = 'new-account'; f.workflowAttemptRef.current++;
  prepared.resolve({ kind: 'signature' });
  expect((await first).errorCode).toBe('WORKFLOW_SCOPE_CHANGED'); expect(action).not.toHaveBeenCalled();
});
