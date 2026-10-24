import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { ROLE_LABELS } from '@/data/constants';
import type { PermissionKey } from '@/types/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { confirmQmReadScope, type QmReadScope } from '@/lib/qm/confirmQmReadScope.web';
import { qmReadOwner, sameQmReadOwner } from '@/lib/qm/qmReadOwner.web';

const required = ['qm.view', 'qm.view_versions'] as const;
const empty: readonly PermissionKey[] = Object.freeze([]);
type Read = { owner: QmReadScope | null; sdk: unknown; revision: number; alive: boolean; suspended: boolean; ticket: symbol | null; status: 'loading' | 'ready' | 'denied' | 'error'; permissions: readonly PermissionKey[]; error: string | null };

/** QM document reads use the existing own-profile bridge and native database permission decision. */
export function useQmRuntimePermissions() {
  const auth = useAuth(), tenantId = useServiceTenantId(), owner = qmReadOwner(auth, tenantId);
  const [revision, setRevision] = useState(0), [, setUpdate] = useState(0);
  const latest = useRef({ auth, tenantId }); latest.current = { auth, tenantId };
  const current = useRef<Read | null>(null);
  const sdk = getSupabaseClient();
  if (!current.current || !sameQmReadOwner(current.current.owner, owner) || current.current.revision !== revision || current.current.sdk !== sdk) {
    if (current.current) { current.current.alive = false; current.current.ticket = null; current.current.permissions = empty; }
    current.current = { owner, sdk, revision, alive: false, suspended: false, ticket: null, status: owner && sdk && getServiceMode() === 'supabase' ? 'loading' : 'denied', permissions: empty, error: null };
  }
  const read = current.current;
  const isCurrent = () => current.current === read && read.alive && !read.suspended && !!read.owner && !!read.sdk
    && sameQmReadOwner(read.owner, qmReadOwner(latest.current.auth, latest.current.tenantId))
    && getServiceMode() === 'supabase' && getSupabaseClient() === read.sdk;
  const grants = () => isCurrent() && read.status === 'ready' ? read.permissions : empty;
  const refreshPermissions = () => {
    if (!isCurrent()) return;
    read.ticket = null; read.status = 'loading'; read.permissions = empty; read.error = null;
    setRevision(value => value + 1);
  };
  useEffect(() => {
    read.alive = true;
    const ticket = Symbol('qm-permission-read'); read.ticket = ticket;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const suspend = () => { if (current.current !== read || !read.alive) return; read.suspended = true; read.ticket = null; read.permissions = empty; read.status = 'loading'; setUpdate(value => value + 1); };
    const resume = () => { if (current.current !== read || !read.alive || hidden()) return; read.ticket = null; read.permissions = empty; read.status = 'loading'; setRevision(value => value + 1); };
    const visibility = () => { if (hidden()) suspend(); else resume(); };
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', visibility); window.addEventListener('focus', resume); window.addEventListener('pageshow', resume); window.addEventListener('pagehide', suspend); window.addEventListener('online', resume);
    }
    read.suspended = hidden();
    if (read.owner && read.status === 'loading' && !read.suspended) void confirmQmReadScope(read.owner, () => isCurrent() && read.ticket === ticket, required).then(result => {
      if (!isCurrent() || read.ticket !== ticket) return;
      read.permissions = result.ok ? Object.freeze([...required]) : empty; read.status = result.ok ? 'ready' : 'error'; read.error = result.ok ? null : result.error; setUpdate(value => value + 1);
    }).catch(() => { if (!isCurrent() || read.ticket !== ticket) return; read.permissions = empty; read.status = 'error'; read.error = 'Der aktuelle QM-Lesezugriff konnte nicht bestätigt werden.'; setUpdate(value => value + 1); });
    if (read.owner?.expiresAt != null) timer = setTimeout(() => { if (current.current !== read || !read.alive) return; read.permissions = empty; read.ticket = null; read.status = 'denied'; setRevision(value => value + 1); }, Math.min(2_147_483_647, Math.max(0, read.owner.expiresAt - Date.now())));
    return () => { if (timer !== undefined) clearTimeout(timer); if (typeof document !== 'undefined' && typeof window !== 'undefined') { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('focus', resume); window.removeEventListener('pageshow', resume); window.removeEventListener('pagehide', suspend); window.removeEventListener('online', resume); } read.alive = false; read.ticket = null; read.permissions = empty; };
  }, [read]);
  const confirmRead = async () => {
    if (!isCurrent() || read.status !== 'ready' || !read.owner) return { ok: false as const, error: 'Der eigene QM-Lesezugriff ist nicht mehr aktuell.' };
    const result = await confirmQmReadScope(read.owner, () => isCurrent() && read.status === 'ready', required);
    if (!isCurrent()) return { ok: false as const, error: 'Der eigene QM-Lesezugriff ist nicht mehr aktuell.' };
    if (!result.ok) { read.permissions = empty; read.status = 'error'; read.error = result.error; setUpdate(value => value + 1); }
    return result;
  };
  return { tenantId, roleKey: owner?.roleKey ?? null, roleLabel: owner ? ROLE_LABELS[owner.roleKey] : null, permissions: grants(), can: (permission: PermissionKey) => grants().includes(permission), loading: read.status === 'loading', error: read.error, refreshPermissions, confirmRead };
}
