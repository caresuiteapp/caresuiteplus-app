import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
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

export function ModalStackProvider({ children }: { children: ReactNode }) {
  const [modalStack, setModalStack] = useState<ModalStackEntry[]>([]);

  const openModal = useCallback((options: OpenModalOptions) => {
    setModalStack([createEntry(options)]);
  }, []);

  const pushModal = useCallback((options: PushModalOptions) => {
    setModalStack((prev) => [...prev, createEntry(options)]);
  }, []);

  const closeTopModal = useCallback(() => {
    setModalStack((prev) => prev.slice(0, -1));
  }, []);

  const goBackModal = useCallback(() => {
    setModalStack((prev) => prev.slice(0, -1));
  }, []);

  const closeAllModals = useCallback(() => {
    setModalStack([]);
  }, []);

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
