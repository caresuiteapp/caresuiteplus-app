import { createContext, createElement, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ModalStackEntry, OpenModalOptions, PushModalOptions } from '@/types/modalNavigation';

type ModalStackContextValue = {
  modalStack: ModalStackEntry[];
  topModal: ModalStackEntry | null;
  openModal: (options: OpenModalOptions) => void;
  pushModal: (options: PushModalOptions) => void;
  closeTopModal: () => void;
  goBackModal: () => void;
  closeAllModals: () => void;
};

const ModalStackContext = createContext<ModalStackContextValue | null>(null);

function createEntry(options: OpenModalOptions): ModalStackEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: options.title,
    subtitle: options.subtitle,
    modalKey: options.modalKey,
    maxWidth: options.maxWidth,
    payload: options.payload,
  };
}

export function ModalStackProvider({ children, scope }: { children: ReactNode; scope?: string }) {
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [state, setState] = useState<{ scope?: string; entries: ModalStackEntry[] }>({ scope, entries: [] });
  const modalStack = state.scope === scope ? state.entries : [];
  const setModalStack = useCallback((update: (entries: ModalStackEntry[]) => ModalStackEntry[]) => {
    setState(previous => currentScope.current !== scope ? previous : ({ scope, entries: update(previous.scope === scope ? previous.entries : []) }));
  }, [scope]);

  const openModal = useCallback((options: OpenModalOptions) => {
    setModalStack(prev => [...prev, createEntry(options)]);
  }, [setModalStack]);

  const pushModal = useCallback((options: PushModalOptions) => {
    setModalStack((prev) => [...prev, createEntry(options)]);
  }, [setModalStack]);

  const closeTopModal = useCallback(() => {
    setModalStack((prev) => prev.slice(0, -1));
  }, [setModalStack]);

  const goBackModal = useCallback(() => {
    setModalStack((prev) => prev.slice(0, -1));
  }, [setModalStack]);

  const closeAllModals = useCallback(() => {
    setModalStack(() => []);
  }, [setModalStack]);

  const topModal = modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;

  const value = useMemo(
    () => ({
      modalStack,
      topModal,
      openModal,
      pushModal,
      closeTopModal,
      goBackModal,
      closeAllModals,
    }),
    [modalStack, topModal, openModal, pushModal, closeTopModal, goBackModal, closeAllModals],
  );

  return createElement(ModalStackContext.Provider, { value }, children);
}

export function useModalStack(): ModalStackContextValue {
  const ctx = useContext(ModalStackContext);
  if (!ctx) {
    throw new Error('useModalStack must be used within ModalStackProvider');
  }
  return ctx;
}
