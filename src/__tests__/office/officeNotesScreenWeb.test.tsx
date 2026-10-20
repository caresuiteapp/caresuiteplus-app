// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { NotesActor } from '@/lib/office/notes/types.web';

const state = vi.hoisted(() => ({ tenant: 'tenant-a' as string | null, user: 'user-a' as string | null, role: 'business_admin' as RoleKey | null, permissions: ['office.access'] as PermissionKey[], actors: [] as NotesActor[] }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ user: state.user ? { id: state.user } : null, profile: { roleKey: 'business_admin' } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => state.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: state.role, permissions: state.permissions, can: (permission: PermissionKey) => state.permissions.includes(permission) }) }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children, scroll, contentOwnsHeader }: any) => <main data-scroll={String(scroll)} data-own-header={String(contentOwnsHeader)}>{children}</main> }));
vi.mock('@/components/office/notes/NotesWorkspace.web', () => ({ NotesWorkspace: ({ actor }: { actor: NotesActor }) => {
  const [draft, setDraft] = useState(''); state.actors.push(actor);
  return <input aria-label="Notizentwurf" value={draft} onInput={event => setDraft(event.currentTarget.value)} />;
} }));
import { OfficeNotesScreen } from '@/screens/office/OfficeNotesScreen.web';

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.tenant = 'tenant-a'; state.user = 'user-a'; state.role = 'business_admin'; state.permissions = ['office.access']; state.actors = [];
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async () => { await act(async () => root.render(<OfficeNotesScreen />)); };
const input = () => host.querySelector<HTMLInputElement>('[aria-label="Notizentwurf"]');

describe('Web Office Notes identity boundary', () => {
  it('uses the authenticated account and effective role/permissions in a non-scrolling light shell', async () => {
    state.role = 'billing'; await render();
    expect(state.actors.at(-1)).toEqual({ tenantId: 'tenant-a', userId: 'user-a', roleKey: 'billing', permissions: ['office.access'] });
    expect(host.querySelector('main')?.dataset).toMatchObject({ scroll: 'false', ownHeader: 'true' });
  });

  it('preserves the current editor but unmounts it before another tenant, user or role renders', async () => {
    await render();
    for (const change of [() => { state.tenant = 'tenant-b'; }, () => { state.user = 'user-b'; }, () => { state.role = 'billing'; }]) {
      await act(async () => { input()!.value = 'Private previous draft'; input()!.dispatchEvent(new Event('input', { bubbles: true })); });
      const previous = input(); await render(); expect(input()).toBe(previous); expect(input()?.value).toBe('Private previous draft');
      change(); await render(); expect(input()).not.toBe(previous); expect(input()?.value).toBe('');
    }
  });

  it('does not mount notes with missing identity, denied Office access or a portal-only effective role', async () => {
    await render(); expect(input()).toBeTruthy();
    state.permissions = []; await render(); expect(input()).toBeNull();
    state.permissions = ['office.access'];
    for (const role of ['employee_portal', 'client_portal', 'family_portal', null] as const) {
      state.role = role; await render(); expect(input()).toBeNull();
    }
    state.role = 'business_admin'; state.tenant = null; await render(); expect(input()).toBeNull();
    state.tenant = 'tenant-a'; state.user = null; await render(); expect(input()).toBeNull();
  });
});
