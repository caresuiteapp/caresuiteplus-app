// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';

const h = vi.hoisted(() => ({ store: new Map<string, string>(), save: vi.fn(), platform: 'android' }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: vi.fn(async (key: string) => h.store.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => { h.store.set(key, value); }),
  removeItem: vi.fn(async (key: string) => { h.store.delete(key); }),
} }));
vi.mock('@/features/assistWorkflow/saveTaskResultsBatch', () => ({ saveTaskResultsBatch: h.save }));
vi.mock('react-native', async () => {
  const React = await import('react');
  return { Platform: { get OS() { return h.platform; } }, StyleSheet: { create: (value: unknown) => value },
    View: ({ children, testID }: any) => React.createElement('div', { 'data-testid': testID }, children),
    Text: ({ children, accessibilityRole }: any) => React.createElement('span', { role: accessibilityRole }, children),
  };
});
vi.mock('@/components/ui', async () => {
  const React = await import('react');
  return {
    PremiumButton: ({ title, onPress, testID, disabled, loading }: any) => React.createElement('button',
      { onClick: onPress, 'data-testid': testID, disabled: disabled || loading }, title),
    PremiumInput: ({ label, value, onChangeText, testID, editable }: any) => React.createElement('input',
      { 'aria-label': label, 'data-testid': testID, value, disabled: editable === false,
        onChange: (event: any) => onChangeText(event.target.value), onInput: (event: any) => onChangeText(event.target.value) }),
  };
});
vi.mock('@/components/layout/platform/platformmodal', async () => {
  const React = await import('react');
  return { PlatformModal: ({ children, visible }: any) => visible ? React.createElement('div', null, children) : null };
});
vi.mock('@/components/portal/EmployeePortalVisitDocumentationAiModal', () => ({ EmployeePortalVisitDocumentationAiModal: () => null }));
vi.mock('@/hooks/platform/useDeviceClass', () => ({ useDeviceClass: () => 'phone' }));
vi.mock('@/lib/platform/breakpoints', () => ({ isDesktopClass: () => false }));
vi.mock('@/lib/portal/employeePortalExecutionSurface', () => ({ employeePortalExecutionSurface: {}, employeePortalExecutionText: {} }));
vi.mock('@/theme', () => ({ spacing: { sm: 8, md: 16, xs: 4 }, typography: {} }));
vi.mock('@/hooks/useUnsavedWebChanges.web', () => ({ useUnsavedWebChanges: () => {} }));
vi.mock('@/design/web/webFontSize', () => ({ webScaledFontMetric: (value: number) => value }));

import { useTaskResultDrafts } from '@/hooks/useTaskResultDrafts';
import { EmployeePortalVisitDocumentationPanel as NativeDocumentation } from '@/components/portal/EmployeePortalVisitDocumentationPanel';
import { EmployeePortalVisitDocumentationPanel as WebDocumentation } from '@/components/portal/EmployeePortalVisitDocumentationPanel.web';

function task(id: string, status = 'open'): EmployeePortalTaskItem {
  return { id, title: id, description: '', status, required: false, completionNote: null, requiresNote: false } as EmployeePortalTaskItem;
}
function ctx(id: string): AssistExecutionContext {
  return { tenantId: 'tenant', employeeId: 'employee', assignmentId: id,
    detail: { tasks: [task(id)] }, assignmentStatus: 'gestartet' } as AssistExecutionContext;
}
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
let host: HTMLDivElement, root: Root;
let drafts!: ReturnType<typeof useTaskResultDrafts>;
const sync = vi.fn();
function Probe({ id }: { id: string }) {
  const context = React.useMemo(() => ctx(id), [id]);
  drafts = useTaskResultDrafts(context.detail.tasks, context, sync, id);
  return <div>{drafts.tasks.map(t => `${t.id}:${t.status}`).join(',')}:{drafts.saveError}</div>;
}
async function render(element: React.ReactNode) { await act(async () => root.render(element)); }
async function input(value: string) {
  const el = host.querySelector('[data-testid="portal-doc-short-description"]') as HTMLInputElement;
  await act(async () => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); });
}
beforeEach(() => {
  vi.clearAllMocks(); h.store.clear(); h.platform = 'android';
  h.save.mockImplementation(async ({ ctx: context, updates }: any) => ({ ok: true,
    data: { ...context, detail: { ...context.detail, tasks: [task(updates[0].taskId, updates[0].status)] } } }));
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe('execution task drafts in mounted React', () => {
  it('shows edited task status immediately and preserves a failed draft for retry', async () => {
    h.save.mockResolvedValueOnce({ ok: false, error: 'Server nicht erreichbar' });
    await render(<Probe id="A" />);
    await act(async () => { drafts.updateTask('A', 'done'); });
    expect(host.textContent).toContain('A:done');
    await act(async () => { expect(await drafts.flush()).toBe(false); });
    expect(drafts.hasPending).toBe(true); expect(drafts.saveError).toBe('Server nicht erreichbar');
    expect(h.store.get('employee-execution-task-drafts:tenant:employee:A')).toContain('done');
    await act(async () => { expect(await drafts.flush()).toBe(true); });
    expect(drafts.hasPending).toBe(false); expect(sync).toHaveBeenCalledTimes(1);
  });
  it('isolates visits and ignores a late task receipt from the previous visit', async () => {
    const old = deferred<any>(); h.save.mockImplementationOnce(() => old.promise);
    await render(<Probe id="A" />);
    await act(async () => { drafts.updateTask('A', 'done'); });
    let pending!: Promise<boolean>;
    await act(async () => { pending = drafts.flush(); });
    await render(<Probe id="B" />);
    expect(drafts.hasPending).toBe(false); expect(host.textContent).toContain('B:open');
    await act(async () => { drafts.updateTask('B', 'done'); expect(await drafts.flush()).toBe(true); });
    expect(h.save.mock.calls[1][0].updates).toEqual([{ taskId: 'B', status: 'done', completionNote: undefined }]);
    await act(async () => { old.resolve({ ok: true, data: ctx('A') }); await pending; });
    expect(sync).toHaveBeenCalledTimes(1); expect(sync.mock.calls[0][0].assignmentId).toBe('B');
    expect(drafts.hasPending).toBe(false); expect(drafts.saving).toBe(false);
  });
  it('waits for a running batch rather than treating an unfinished write as saved', async () => {
    const saved = deferred<any>(); h.save.mockImplementationOnce(() => saved.promise);
    await render(<Probe id="A" />);
    await act(async () => { drafts.updateTask('A', 'done'); });
    let first!: Promise<boolean>, closeGate!: Promise<boolean>, settled = false;
    await act(async () => { first = drafts.flush(); closeGate = drafts.flush().then(value => { settled = true; return value; }); });
    expect(settled).toBe(false); expect(h.save).toHaveBeenCalledTimes(1);
    await act(async () => { saved.resolve({ ok: true, data: ctx('A') }); await first; expect(await closeGate).toBe(true); });
    expect(settled).toBe(true); expect(drafts.hasPending).toBe(false);
  });
  it('restores only the current visit and assigns a newer revision to its next edit', async () => {
    h.store.set('employee-execution-task-drafts:tenant:employee:A', JSON.stringify({ A: { status: 'done', revision: 80 } }));
    await render(<Probe id="A" />); expect(drafts.tasks[0].status).toBe('done');
    await act(async () => { drafts.updateTask('A', 'open'); });
    expect(JSON.parse(h.store.get('employee-execution-task-drafts:tenant:employee:A')!).A.revision).toBe(81);
    await render(<Probe id="B" />); expect(drafts.tasks[0].status).toBe('open'); expect(drafts.hasPending).toBe(false);
  });
});

describe.each([['Android', NativeDocumentation], ['Web', WebDocumentation]] as const)('%s documentation behavior', (platform, Panel) => {
  it('retains an edited draft across server refresh and a rejected save, then permits a real retry', async () => {
    h.platform = platform === 'Web' ? 'web' : 'android';
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ok: true });
    await render(<Panel visible initialShortDescription="Geladene Dokumentation" onSubmit={save} />);
    await input('Noch nicht gespeicherte Arbeit');
    await render(<Panel visible initialShortDescription="Späte Serverantwort" onSubmit={save} />);
    expect((host.querySelector('input') as HTMLInputElement).value).toBe('Noch nicht gespeicherte Arbeit');
    await act(async () => { (host.querySelector('[data-testid="portal-doc-save-button"]') as HTMLButtonElement).click(); });
    expect(host.textContent).toContain('Speicherung konnte nicht bestätigt werden');
    expect((host.querySelector('input') as HTMLInputElement).value).toBe('Noch nicht gespeicherte Arbeit');
    await act(async () => { (host.querySelector('[data-testid="portal-doc-save-button"]') as HTMLButtonElement).click(); });
    expect(save).toHaveBeenCalledTimes(2); expect(save.mock.calls[1][0].shortDescription).toBe('Noch nicht gespeicherte Arbeit');
    expect(host.textContent).toContain('Gespeichert');
  });
  it('synchronously guards duplicate submit taps and exposes pending progress', async () => {
    const saved = deferred<any>(), save = vi.fn(() => saved.promise);
    await render(<Panel visible initialShortDescription="Dokumentation" onSubmit={save} />);
    const button = host.querySelector('[data-testid="portal-doc-save-button"]') as HTMLButtonElement;
    await act(async () => { button.click(); button.click(); });
    expect(save).toHaveBeenCalledTimes(1); expect(button.disabled).toBe(true);
    expect(host.textContent).toContain('Dokumentation wird gespeichert');
    await act(async () => saved.resolve({ ok: true })); expect(button.disabled).toBe(false);
  });
  it('rejects imperative submission when the visit is locked', async () => {
    const save = vi.fn(), ref = React.createRef<{ submit: () => Promise<void> }>();
    await render(<Panel ref={ref} visible disabled initialShortDescription="Dokumentation" onSubmit={save} />);
    await act(async () => ref.current!.submit()); expect(save).not.toHaveBeenCalled();
  });
});
