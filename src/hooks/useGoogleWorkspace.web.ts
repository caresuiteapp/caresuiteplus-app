import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/lib/auth/context';
import { fetchGoogleWorkspaceStatus, startGoogleWorkspaceConnection, disconnectGoogleWorkspace, type GoogleWorkspaceConnection } from '@/lib/googleWorkspace/googleWorkspaceService';
import { loadWorkspacePage, type WorkspaceFilter } from '@/lib/googleWorkspace/workspaceData.web';
import type { WorkspacePage, WorkspaceService } from '@/lib/googleWorkspace/workspaceModel';

type Snapshot<T> = { data: T | null; loading: boolean; error: string | null; at: number };
type Entry<T> = { snapshot: Snapshot<T>; listeners: Set<() => void>; pending?: Promise<void>; generation: number };
const cache = new Map<string, Entry<any>>();
function entry<T>(key: string): Entry<T> {
  if (!cache.has(key)) cache.set(key, { snapshot: { data: null, loading: false, error: null, at: 0 }, listeners: new Set(), generation: 0 });
  return cache.get(key)!;
}
function emit<T>(target: Entry<T>, next: Partial<Snapshot<T>>) { target.snapshot = { ...target.snapshot, ...next }; target.listeners.forEach(fn => fn()); }
function invalidateScope(scope: string, clearStatus = false) {
  for (const [key, target] of cache) if (key.startsWith(`${scope}|`)) { target.generation++; target.pending = undefined; emit(target, { ...(key.endsWith('|status') && !clearStatus ? {} : { data: null }), loading: false, at: 0, error: null }); }
}
function useResource<T>(key: string, loader: () => Promise<T>, enabled: boolean) {
  const target = entry<T>(key); const loaderRef = useRef(loader); loaderRef.current = loader;
  const snapshot = useSyncExternalStore(useCallback(fn => { target.listeners.add(fn); return () => { target.listeners.delete(fn); }; }, [target]), () => target.snapshot, () => target.snapshot);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (target.pending) return target.pending;
    const generation = target.generation;
    emit(target, { loading: true, error: null });
    const request = loaderRef.current().then(data => { if (generation === target.generation) emit(target, { data, at: Date.now(), error: null }); }).catch(error => { if (generation === target.generation) emit(target, { error: error instanceof Error ? error.message : 'Abruf fehlgeschlagen.' }); }).finally(() => { if (generation === target.generation) { target.pending = undefined; emit(target, { loading: false }); } });
    target.pending = request; await request;
  }, [enabled, target]);
  useEffect(() => {
    if (!enabled) return;
    if (!target.snapshot.at || Date.now() - target.snapshot.at > 60_000) void refresh();
    const update = () => { if (document.visibilityState === 'visible' && Date.now() - target.snapshot.at > 60_000) void refresh(); };
    const timer = window.setInterval(update, 120_000); window.addEventListener('focus', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); };
  }, [enabled, refresh, target, snapshot.at === 0, target.generation]);
  return { ...snapshot, refresh };
}
export function useWorkspaceScope() {
  const { user, profile } = useAuth();
  return user?.id && profile?.tenantId ? `${user.id}:${profile.tenantId}:${profile.roleKey}` : '';
}
export function useGoogleWorkspace(enabled = true) {
  const scope = useWorkspaceScope();
  const status = useResource(`${scope}|status`, fetchGoogleWorkspaceStatus, enabled && !!scope);
  const [actionLoading, setActionLoading] = useState(false); const [actionError, setActionError] = useState<string | null>(null);
  const lock = useRef(false); const scopeRef = useRef(scope); scopeRef.current = scope;
  const act = useCallback(async (kind: 'connect' | 'disconnect') => {
    if (lock.current || !scope || !enabled) return;
    lock.current = true; setActionLoading(true); setActionError(null);
    try {
      if (kind === 'connect') {
        const url = await startGoogleWorkspaceConnection(`${window.location.origin}/business/connect/google-workspace`);
        if (scopeRef.current === scope) window.location.assign(url);
      } else {
        await disconnectGoogleWorkspace();
        if (scopeRef.current === scope) { invalidateScope(scope, true); await status.refresh(); }
      }
    } catch (error) { if (scopeRef.current === scope) setActionError(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.'); }
    finally { lock.current = false; setActionLoading(false); }
  }, [enabled, scope, status.refresh]);
  useEffect(() => { setActionError(null); }, [scope]);
  return { connection: status.data as GoogleWorkspaceConnection | null, loading: status.loading || (!status.data && !status.error && !!scope), error: actionError || status.error, actionLoading, refresh: status.refresh, connect: () => act('connect'), disconnect: () => act('disconnect'), scope };
}
export function useWorkspacePage(service: WorkspaceService, filter: WorkspaceFilter, enabled: boolean, connectionKey = '') {
  const scope = useWorkspaceScope(); const serial = JSON.stringify(filter);
  return useResource<WorkspacePage>(`${scope}|${connectionKey}|${service}|${serial}`, () => loadWorkspacePage(service, filter), enabled && !!scope);
}
export function refreshWorkspaceData(scope: string) { invalidateScope(scope); }
