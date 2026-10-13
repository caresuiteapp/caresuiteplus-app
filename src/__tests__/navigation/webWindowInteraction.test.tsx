// @vitest-environment happy-dom
import React, { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ModalStackProvider, useModalStack } from '@/hooks/useModalStack.web';
import { ModalStackRenderer } from '@/components/navigation/ModalStackRenderer';
import { useSectionEditModal } from '@/hooks/useSectionEditModal.web';
import { usePageTab } from '@/hooks/usePageTab.web';

const navigation = vi.hoisted(() => ({ params: {} as Record<string, string>, push: vi.fn(), replace: vi.fn(), setParams: vi.fn(), back: vi.fn(), canGoBack: vi.fn(() => false) }));
vi.mock('expo-router', () => ({ usePathname: () => '/office/clients', useGlobalSearchParams: () => navigation.params, useRouter: () => navigation }));
vi.mock('@/hooks/useModalStack', async () => import('@/hooks/useModalStack.web'));
vi.mock('@/components/layout/platform', () => ({ PlatformModal: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }));
vi.mock('@/lib/navigation/moduleNav', () => ({ MODULE_NAV_MODAL_SCREENS: {
  'settings.profile': { Component: Form, title: 'Profil' }, 'settings.tenant': { Component: Form, title: 'Unternehmen' },
} }));
function Form({ payload }: { payload?: Record<string, unknown> }) {
  const [value, setValue] = useState('');
  return <input aria-label={String(payload?.name)} value={value} onChange={event => setValue(event.target.value)} />;
}
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  navigation.params = {}; navigation.push.mockReset(); navigation.replace.mockReset(); navigation.setParams.mockReset();
  window.sessionStorage.clear(); window.history.replaceState({ id: 'start' }, '', '/office/clients');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('covered registered pages keep their actual React input state when another page opens and closes', async () => {
  let windows!: ReturnType<typeof useModalStack>;
  function Capture() { windows = useModalStack(); return <ModalStackRenderer />; }
  const render = () => root.render(<ModalStackProvider scope="account-a"><Capture /></ModalStackProvider>);
  await act(async () => render());
  await act(async () => windows.openModal({ title: 'Profil', modalKey: 'settings.profile', payload: { name: 'first' } }));
  const firstUrl = navigation.push.mock.calls.at(-1)![0] as string;
  navigation.params = Object.fromEntries(new URL(firstUrl, 'https://app.test').searchParams);
  await act(async () => render());
  const input = host.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Ungespeicherter Entwurf');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // React's input node itself must survive covering and uncovering.
  await act(async () => windows.pushModal({ title: 'Unternehmen', modalKey: 'settings.tenant', payload: { name: 'second' } }));
  navigation.params = Object.fromEntries(new URL(navigation.push.mock.calls.at(-1)![0], 'https://app.test').searchParams);
  await act(async () => render());
  expect(windows.modalStack).toHaveLength(2); expect(host.querySelector('[aria-label="first"]')).toBe(input);
  await act(async () => windows.closeTopModal());
  navigation.params = Object.fromEntries(new URL(navigation.replace.mock.calls.at(-1)![0], 'https://app.test').searchParams);
  await act(async () => render());
  expect(windows.modalStack).toHaveLength(1); expect(host.querySelector('[aria-label="first"]')).toBe(input);
  expect(input.value).toBe('Ungespeicherter Entwurf');
});

it('changing account hides windows and refuses a delayed close from the old account', async () => {
  let windows!: ReturnType<typeof useModalStack>;
  function Capture() { windows = useModalStack(); return null; }
  const render = (scope: string) => root.render(<ModalStackProvider scope={scope}><Capture /></ModalStackProvider>);
  await act(async () => render('account-a'));
  await act(async () => windows.openModal({ title: 'Profil', modalKey: 'settings.profile' }));
  navigation.params = Object.fromEntries(new URL(navigation.push.mock.calls.at(-1)![0], 'https://app.test').searchParams);
  await act(async () => render('account-a'));
  const old = windows;
  await act(async () => render('account-b'));
  expect(windows.modalStack).toHaveLength(0);
  navigation.replace.mockClear(); old.closeAllModals(); expect(navigation.replace).not.toHaveBeenCalled();
});

it('edit close callbacks stay stable so parent effects cannot immediately close a newly opened section', async () => {
  let edit!: ReturnType<typeof useSectionEditModal<string>>;
  function Capture() { edit = useSectionEditModal<string>(); useEffect(() => edit.closeSection(), [edit.closeSection]); return <span>{edit.activeSection ?? 'closed'}</span>; }
  await act(async () => root.render(<Capture />));
  const close = edit.closeSection;
  await act(async () => edit.openSection('kontakt'));
  navigation.params = { csPage_recordEditSection: 'kontakt' };
  await act(async () => root.render(<Capture />));
  expect(edit.closeSection).toBe(close); expect(host.textContent).toBe('kontakt');
});

it('restores a page section from its address and changes it without replacing the whole page', async () => {
  navigation.params = { csPage_billing: 'budgets' };
  let select!: (key: string) => void;
  function Capture() { const [tab, setTab] = usePageTab<string>('billing', 'dashboard'); select = setTab; return <span>{tab}</span>; }
  await act(async () => root.render(<Capture />));
  expect(host.textContent).toBe('budgets');
  await act(async () => select('all'));
  expect(navigation.setParams).toHaveBeenCalledWith({ csPage_billing: 'all' });
  expect(navigation.push).not.toHaveBeenCalled(); expect(navigation.replace).not.toHaveBeenCalled();
});
