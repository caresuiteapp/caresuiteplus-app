// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ path: '/portal/client', account: 'one', items: [] as { id: string; route: string }[], push: vi.fn() }));
vi.mock('expo-router', () => ({ usePathname: () => f.path, useRouter: () => ({ push: f.push }) }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ tenantId: 't', clientId: 'c', actorId: f.account, isLinkedReady: true }) }));
vi.mock('@/hooks/useportalofficemessages', () => ({ usePortalOfficeMessages: () => ({ threads: [{ id: 'm', unreadCount: 1 }] }) }));
vi.mock('@/components/portal/ClientSignatureAttentionProvider', () => ({ useClientSignatureAttention: () => ({ items: f.items }) }));
vi.mock('@/components/brand/appStartIntroSession', () => ({ useAppStartIntroReady: () => true }));
vi.mock('@/components/portal/assist/PortalGlassModal', () => ({ PortalGlassModal: () => null }));
import { ClientPortalAttentionPrompt } from '@/components/portal/ClientPortalAttentionPrompt.web';
let host: HTMLDivElement; let root: Root;
const proof = { id: 'p', route: '/portal/client/documents/p' };
const other = { id: 'q', route: '/portal/client/documents/q' };
beforeEach(() => {
  f.path = '/portal/client'; f.account = 'one'; f.items = [proof, other]; f.push.mockReset();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async () => { await act(async () => root.render(<ClientPortalAttentionPrompt />)); };
it('offers only navigation and ignores Escape/backdrop even with unread messages', async () => {
  await render();
  const dialog = document.querySelector('dialog')!;
  expect(dialog.open).toBe(true);
  expect(dialog.querySelectorAll('button')).toHaveLength(1);
  const cancel = new Event('cancel', { cancelable: true }); dialog.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  dialog.click(); expect(dialog.open).toBe(true);
  await act(async () => dialog.querySelector('button')!.click());
  expect(f.push).toHaveBeenCalledWith('/portal/client/documents/signatures');
  expect(dialog.open).toBe(true); // Only successful navigation removes the modal.
});
it.each(['/portal/client/messages', '/portal/client/profile', '/portal/client/documents', '/portal/client/documents/unrelated'])('keeps the gate on %s', async (path) => {
  f.path = path; await render(); expect(document.querySelector('dialog')).not.toBeNull();
});
it.each(['/portal/client/documents/signatures', '/portal/client/documents/signatures/d', '/portal/client/documents/p'])('leaves signing usable at %s', async (path) => {
  f.path = path; await render(); expect(document.querySelector('dialog')).toBeNull();
});
it('keeps a just-signed detail usable and reopens on leaving until the last item is done', async () => {
  f.path = proof.route; await render(); f.items = [other]; await render();
  expect(document.querySelector('dialog')).toBeNull();
  f.path = '/portal/client/profile'; await render(); expect(document.querySelector('dialog')).not.toBeNull();
  f.items = []; await render(); expect(document.querySelector('dialog')).toBeNull();
});
it('does not carry the detail exemption across account changes', async () => {
  f.path = proof.route; await render(); f.account = 'two'; f.items = [other]; await render();
  expect(document.querySelector('dialog')).not.toBeNull();
});
