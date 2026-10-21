// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AcademyCommandHandler, AcademyWorkspace } from '@/lib/akademie/workspaceModel';
import { clearAcademyDrafts } from '@/lib/akademie/workspaceDrafts';
import { AcademyWorkspaceScreen } from '@/features/akademie/AcademyWorkspaceScreen.web';
import { AcademyWorkspaceError } from '@/lib/akademie/workspaceService';

type ViewProps = { workspace: AcademyWorkspace | null; busy: boolean; error: string | null; notice: string | null; initialSection?: string; initialMandatoryOnly?: boolean; onCommand: AcademyCommandHandler; onReload: () => void };
const state = vi.hoisted(() => ({
  user: 'user-a' as string | null, authenticated: true, tenant: 'tenant-a', account: 'account-a', portal: true,
  params: {} as Record<string, string>,
  load: vi.fn(), mutate: vi.fn(), ensure: vi.fn(), view: null as ViewProps | null,
}));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => state.params }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({
  authReady: true, isLoading: false, isAuthenticated: state.authenticated,
  user: state.user ? { id: state.user } : null, profile: { tenantId: state.tenant },
  portalSession: state.portal ? { tenantId: state.tenant, accountId: state.account, sessionToken: 'opaque-test-token' } : null,
}) }));
vi.mock('@/lib/auth/portalSupabaseAuth', () => ({ ensurePortalWriteSession: (...args: unknown[]) => state.ensure(...args) }));
vi.mock('@/lib/akademie/certificatePdf', () => ({ downloadAcademyCertificate: vi.fn() }));
vi.mock('@/lib/akademie/workspaceService', () => ({
  loadAcademyWorkspace: (...args: unknown[]) => state.load(...args),
  mutateAcademyWorkspace: (...args: unknown[]) => state.mutate(...args),
  applyAcademyMutationReceipt: (workspace: AcademyWorkspace) => workspace,
  AcademyWorkspaceError: class extends Error { constructor(message: string, readonly code = 'unknown', readonly uncertain = false) { super(message); } },
}));
vi.mock('@/features/akademie/AcademyWorkspace.web', () => ({ AcademyWorkspaceView: (props: ViewProps) => {
  state.view = props;
  return <div><span>{props.workspace?.viewer.name}</span><span>{props.error}</span><span>{props.notice}</span><button disabled={props.busy}>Bearbeiten</button></div>;
} }));

function workspace(name = 'Serverperson'): AcademyWorkspace {
  return { schemaVersion: 1, viewer: { mode: 'learner', name, audience: 'client' }, capabilities: { manageCourses: false, assign: false, review: false, learn: true }, courses: [], participants: [], enrollments: [], certificates: [] };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  clearAcademyDrafts(); state.user = 'user-a'; state.authenticated = true; state.tenant = 'tenant-a'; state.account = 'account-a'; state.portal = true; state.params = {};
  state.load.mockReset().mockResolvedValue(workspace()); state.ensure.mockReset().mockResolvedValue({ ok: true, data: {} });
  state.mutate.mockReset().mockResolvedValue({ recordId: 'enrollment-a', revision: 4 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); clearAcademyDrafts(); });
const render = async (key = 'route') => { await act(async () => root.render(<AcademyWorkspaceScreen key={key} view="learner" />)); };
async function command() { let result: unknown; await act(async () => { result = await state.view!.onCommand('complete_lesson', { lessonId: 'lesson-a' }, { id: 'enrollment-a', revision: 3 }); }); return result; }

describe('academy authenticated container', () => {
  it('accepts personal planning while clamping office report parameters out of learner routes', async () => {
    state.params = { section: 'reports' };
    await render();
    expect(state.view?.initialSection).toBe('overview');
    expect(state.load).toHaveBeenLastCalledWith('tenant-a', 'learner');
    state.params = { section: 'planning' };
    await render();
    expect(state.view?.initialSection).toBe('planning');
    await act(async () => root.render(<AcademyWorkspaceScreen view="office" initialSection="reports" initialMandatoryOnly />));
    expect(state.view?.initialSection).toBe('reports');
    expect(state.view?.initialMandatoryOnly).toBe(true);
    expect(state.load).toHaveBeenLastCalledWith('tenant-a', 'office');
  });

  it('serializes double clicks and checks the real portal session before writing', async () => {
    const saved = deferred<{ recordId: string; revision: number }>(); state.mutate.mockReturnValue(saved.promise);
    await render();
    let first!: ReturnType<AcademyCommandHandler>;
    await act(async () => {
      first = state.view!.onCommand('complete_lesson', { lessonId: 'lesson-a' }, { id: 'enrollment-a', revision: 3 });
      await state.view!.onCommand('complete_lesson', { lessonId: 'lesson-a' }, { id: 'enrollment-a', revision: 3 });
    });
    expect(state.ensure).toHaveBeenCalledTimes(1); expect(state.mutate).toHaveBeenCalledTimes(1);
    expect(state.view!.busy).toBe(true);
    await act(async () => { saved.resolve({ recordId: 'enrollment-a', revision: 4 }); await first; });
    expect(state.view!.notice).toContain('bestätigt');
    expect(state.mutate.mock.calls[0].slice(0, 2)).toEqual(['tenant-a', 'learner']);
    expect(state.mutate.mock.calls[0][2].data).toEqual({ lessonId: 'lesson-a' });
  });

  it('retains exactly the same request across remount, including a failed session check during retry', async () => {
    state.mutate.mockRejectedValueOnce(new Error('transport lost'));
    await render(); await command();
    const original = structuredClone(state.mutate.mock.calls[0][2]);
    await render('next-route');
    expect(state.view!.busy).toBe(true);
    state.ensure.mockResolvedValueOnce({ ok: false, error: 'Sitzung vorübergehend nicht erreichbar' });
    const retry = () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Vorgang erneut prüfen')!;
    await act(async () => retry().click());
    expect(state.view!.busy).toBe(true); expect(state.mutate).toHaveBeenCalledTimes(1);
    await act(async () => retry().click());
    expect(state.mutate.mock.calls[1][2]).toEqual(original);
    expect(state.view!.busy).toBe(false);
  });

  it('returns a successful receipt even if its reload fails, then blocks edits until a current read succeeds', async () => {
    await render(); state.load.mockRejectedValueOnce(new Error('Read unavailable'));
    const result = await command();
    expect(result).toEqual({ recordId: 'enrollment-a', revision: 4 });
    expect(state.view!.notice).toContain('bestätigt'); expect(state.view!.busy).toBe(true);
    await command(); expect(state.mutate).toHaveBeenCalledTimes(1);
    await act(async () => state.view!.onReload());
    expect(state.view!.busy).toBe(false);
  });

  it('discards a stale response after account change and clears pending personal data at logout', async () => {
    const old = deferred<AcademyWorkspace>(); state.load.mockReturnValueOnce(old.promise);
    await render(); state.user = 'user-b'; state.account = 'account-b'; state.load.mockResolvedValue(workspace('Zweite Person'));
    await render(); await act(async () => old.resolve(workspace('Alte Person')));
    expect(host.textContent).toContain('Zweite Person'); expect(host.textContent).not.toContain('Alte Person');
    state.mutate.mockRejectedValueOnce(new Error('transport lost')); await command();
    state.authenticated = false; await render();
    expect(host.textContent).not.toContain('Zweite Person'); expect(host.textContent).not.toContain('Vorgang erneut prüfen');
  });

  it('loads the current server revision after a conflict while returning null to preserve the editor draft', async () => {
    await render();
    state.mutate.mockRejectedValueOnce(new AcademyWorkspaceError('Inzwischen geändert', '40001', false));
    state.load.mockResolvedValueOnce(workspace('Aktueller Stand'));
    expect(await command()).toBeNull();
    expect(state.load).toHaveBeenCalledTimes(2);
    expect(state.view!.workspace?.viewer.name).toBe('Aktueller Stand');
    expect(state.view!.error).toBe('Inzwischen geändert');
    expect(state.view!.notice).toBeNull(); expect(state.view!.busy).toBe(false);
  });
});
