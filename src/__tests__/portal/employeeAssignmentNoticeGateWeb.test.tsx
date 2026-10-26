// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { EmployeeAssignmentNoticeInbox } from '@/lib/portal/employeeAssignmentNoticeService.web';
const h = vi.hoisted(() => ({
  actor: { tenantId: 'tenant-a', employeeId: 'employee-a', isLinkedReady: true, employeeLinkReadOnly: false },
  authUserId: 'auth-a', accountId: 'account-a', pathname: '/portal/employee',
  inbox: { notices: [], total: 0 } as EmployeeAssignmentNoticeInbox,
  acknowledge: vi.fn(), route: vi.fn(), push: vi.fn(), refresh: vi.fn(), setData: vi.fn(),
}));
vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children, accessibilityRole }: { children: React.ReactNode; accessibilityRole?: string }) => <span role={accessibilityRole}>{children}</span>,
  Pressable: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => <button disabled={disabled} onClick={onPress}>{children}</button>,
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: h.push }), usePathname: () => h.pathname }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => h.actor }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ user: { id: h.authUserId }, portalSession: { accountId: h.accountId } }) }));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useCareLightPalette: () => ({ c: {} }) }));
vi.mock('@/hooks/core/useAsyncQuery', () => ({ useAsyncQuery: () => ({ data: h.inbox, setData: h.setData, refresh: h.refresh }) }));
vi.mock('@/lib/realtime/subscribeToTenantTables', () => ({ subscribeToTenantTables: () => () => {} }));
vi.mock('@/lib/portal/employeeAssignmentNoticeService.web', () => ({
  fetchEmployeeAssignmentNotices: vi.fn(), acknowledgeEmployeeAssignmentNotices: h.acknowledge,
  resolveEmployeeAssignmentNoticeRoute: h.route,
}));
vi.mock('@/components/layout/platform/CarePopupShell', () => ({
  CarePopupShell: ({ visible, title, children, onClose, footerActions }: {
    visible: boolean; title: string; children: React.ReactNode; onClose: () => void;
    footerActions: { title: string; onPress: () => void; disabled?: boolean }[];
  }) => visible ? <section role="dialog"><h1>{title}</h1><button onClick={onClose}>Schließen</button>{children}
    {footerActions.map(action => <button key={action.title} disabled={action.disabled} onClick={action.onPress}>{action.title}</button>)}
  </section> : null,
}));
import { EmployeeAssignmentNoticeGate } from '@/components/portal/EmployeeAssignmentNoticeGate.web';
let root: Root;
let host: HTMLDivElement;
const initial = () => ({ id: 'notice-a', visitId: 'visit-a', title: 'Termin am Dienstag geändert', body: '11:30–13:30 Uhr', changeKind: 'changed', createdAt: '' });
const render = () => act(async () => { root.render(<EmployeeAssignmentNoticeGate />); });
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(item => item.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
beforeEach(() => {
  vi.clearAllMocks();
  h.actor = { tenantId: 'tenant-a', employeeId: 'employee-a', isLinkedReady: true, employeeLinkReadOnly: false };
  h.authUserId = 'auth-a'; h.accountId = 'account-a'; h.pathname = '/portal/employee';
  h.inbox = { notices: [initial()], total: 1 };
  h.setData.mockImplementation((update: (value: EmployeeAssignmentNoticeInbox) => EmployeeAssignmentNoticeInbox) => { h.inbox = update(h.inbox); });
  h.acknowledge.mockResolvedValue({ ok: true, data: undefined });
  h.route.mockResolvedValue({ ok: true, data: '/portal/employee/assignments/visit-a/execute' });
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

it('defers without sending a receipt and keeps unread notices accessible in this session', async () => {
  await render();
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  await click('Später');
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(h.acknowledge).not.toHaveBeenCalled();
  await click('1 ungelesene Einsatzinfo · Anzeigen');
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
});

it('keeps information visible until the server confirms the receipt; an error remains retryable', async () => {
  let resolve!: (value: { ok: false; error: string }) => void;
  h.acknowledge.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await render(); await click('Angezeigte Infos gelesen');
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  expect(h.setData).not.toHaveBeenCalled();
  await act(async () => { resolve({ ok: false, error: 'Speichern fehlgeschlagen' }); });
  expect(host.textContent).toContain('Speichern fehlgeschlagen');
  expect(host.textContent).toContain('Termin am Dienstag geändert');
  await click('Angezeigte Infos gelesen');
  expect(h.setData).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(h.acknowledge).toHaveBeenLastCalledWith({ tenantId: 'tenant-a', employeeId: 'employee-a', authUserId: 'auth-a' }, ['notice-a']);
});

it.each(['read', 'open'] as const)('unblocks the popup after a hanging %s action without accepting a late result', async action => {
  vi.useFakeTimers();
  let resolve!: (value: { ok: true; data: string | undefined }) => void;
  const request = new Promise(done => { resolve = done; });
  if (action === 'read') h.acknowledge.mockImplementationOnce(() => request);
  else h.route.mockImplementationOnce(() => request);
  await render();
  await click(action === 'read' ? 'Angezeigte Infos gelesen' : 'Aktuellen Einsatz öffnen');
  expect([...host.querySelectorAll('button')].find(button => button.textContent === 'Später')?.disabled).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(15_001); });
  expect(host.textContent).toContain(action === 'read'
    ? 'Die Lesebestätigung konnte nicht rechtzeitig bestätigt werden.' : 'Der Einsatz konnte nicht rechtzeitig geprüft werden.');
  expect([...host.querySelectorAll('button')].find(button => button.textContent === 'Später')?.disabled).toBe(false);
  expect(h.setData).not.toHaveBeenCalled();
  await click('Später');
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => { resolve({ ok: true, data: action === 'open' ? '/portal/employee/assignments/visit-a/execute' : undefined }); });
  expect(h.push).not.toHaveBeenCalled();
  expect(h.setData).not.toHaveBeenCalled();
});

it('announces a later change even after older information was postponed', async () => {
  await render(); await click('Später');
  h.inbox = { notices: [{ ...initial(), id: 'notice-b', title: 'Neuer Einsatz am Freitag' }, initial()], total: 2 };
  await render();
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Neuer Einsatz am Freitag');
  expect(host.querySelector('[role="dialog"]')?.textContent).not.toContain('Termin am Dienstag geändert');
});

it('does not navigate from an old pending request after an account or tenant switch', async () => {
  let resolve!: (value: { ok: true; data: string }) => void;
  h.route.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await render(); await click('Aktuellen Einsatz öffnen');
  h.actor = { ...h.actor, tenantId: 'tenant-b', employeeId: 'employee-b' };
  h.authUserId = 'auth-b'; h.accountId = 'account-b'; h.inbox = { notices: [], total: 0 };
  await render();
  await act(async () => { resolve({ ok: true, data: '/portal/employee/assignments/visit-a/execute' }); });
  expect(h.push).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('Termin am Dienstag geändert');
});

it('does not apply an old read response to the next employee inbox', async () => {
  let resolve!: (value: { ok: true; data: undefined }) => void;
  h.acknowledge.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await render(); await click('Angezeigte Infos gelesen');
  h.actor = { ...h.actor, employeeId: 'employee-b' }; h.authUserId = 'auth-b';
  h.inbox = { notices: [{ ...initial(), id: 'notice-b', title: 'Eigener neuer Einsatz' }], total: 1 };
  await render();
  await act(async () => { resolve({ ok: true, data: undefined }); });
  expect(h.setData).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Eigener neuer Einsatz');
});

it('opens a current assignment without acknowledging the notice or interrupting visit execution', async () => {
  await render(); await click('Aktuellen Einsatz öffnen');
  expect(h.push).toHaveBeenCalledWith('/portal/employee/assignments/visit-a/execute');
  expect(h.acknowledge).not.toHaveBeenCalled();
  h.pathname = '/portal/employee/assignments/visit-a/execute';
  h.inbox = { notices: [{ ...initial(), id: 'notice-b' }], total: 1 };
  await render();
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

it('hides notice content for an unverified or offline read-only employee link', async () => {
  h.actor.employeeLinkReadOnly = true;
  await render(); expect(host.textContent).toBe('');
  h.actor.employeeLinkReadOnly = false; h.actor.isLinkedReady = false;
  await render(); expect(host.textContent).toBe('');
});
