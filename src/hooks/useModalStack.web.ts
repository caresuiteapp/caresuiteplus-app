import { createContext, createElement, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { canGoBackWebPage, goBackWebPage } from '@/lib/navigation/webNavigationHistory';
import { readWebModalSnapshot, saveWebModalSnapshot } from '@/lib/navigation/webModalSnapshot';
import { webPageHref } from '@/lib/navigation/webPageHref';
import type { ModalStackEntry, OpenModalOptions } from '@/types/modalNavigation';

type Value = {
  modalStack: ModalStackEntry[];
  topModal: ModalStackEntry | null;
  openModal: (options: OpenModalOptions) => void;
  pushModal: (options: OpenModalOptions) => void;
  closeTopModal: () => void;
  goBackModal: () => void;
  closeAllModals: () => void;
};
const Context = createContext<Value | null>(null);

/** Registered windows share browser history and restore their stack on reload. */
export function ModalStackProvider({ children, scope = '' }: { children: ReactNode; scope?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const token = params.csWindow;
  const modalStack = useMemo(() => readWebModalSnapshot(scope, token), [scope, token]);
  const current = useRef({ scope, token, entries: modalStack });
  if (current.current.scope !== scope || current.current.token !== token) current.current = { scope, token, entries: modalStack };
  const publish = useCallback((entries: ModalStackEntry[], replace = false) => {
    if (current.current.scope !== scope || current.current.token !== token) return;
    current.current.entries = entries;
    const nextToken = saveWebModalSnapshot(scope, entries);
    const href = webPageHref(pathname, params, { csWindow: nextToken });
    if (replace) router.replace(href as never); else router.push(href as never);
  }, [params, pathname, router, scope, token]);
  const openModal = useCallback((options: OpenModalOptions) => {
    if (current.current.scope !== scope) return;
    publish([...current.current.entries, { ...options, id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }]);
  }, [publish, scope]);
  const closeTopModal = useCallback(() => {
    if (current.current.scope !== scope || current.current.token !== token) return;
    if (canGoBackWebPage(scope) && goBackWebPage(scope)) return;
    if (router.canGoBack()) router.back();
    else publish(current.current.entries.slice(0, -1), true);
  }, [publish, router, scope, token]);
  const closeAllModals = useCallback(() => publish([], true), [publish]);
  const value = useMemo(() => ({ modalStack, topModal: modalStack.at(-1) ?? null, openModal, pushModal: openModal, closeTopModal, goBackModal: closeTopModal, closeAllModals }), [modalStack, openModal, closeTopModal, closeAllModals]);
  return createElement(Context.Provider, { value }, children);
}

export function useModalStack(): Value {
  const value = useContext(Context);
  if (!value) throw new Error('useModalStack must be used within ModalStackProvider');
  return value;
}
