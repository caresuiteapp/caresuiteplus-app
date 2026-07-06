import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type PortalMessengerFocusContextValue = {
  /** Full-screen mobile messenger chrome (hide bottom nav, lock scroll). */
  active: boolean;
  setActive: (active: boolean) => void;
  selectedThreadId: string | null;
  threadTitle: string;
  openThread: (threadId: string, title?: string) => void;
  closeThread: () => void;
  setThreadTitle: (title: string) => void;
};

const PortalMessengerFocusContext = createContext<PortalMessengerFocusContextValue>({
  active: false,
  setActive: () => {},
  selectedThreadId: null,
  threadTitle: 'Chat',
  openThread: () => {},
  closeThread: () => {},
  setThreadTitle: () => {},
});

export function PortalMessengerFocusProvider({ children }: { children: ReactNode }) {
  const [active, setActiveState] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadTitle, setThreadTitleState] = useState('Chat');

  const setActive = useCallback((next: boolean) => {
    setActiveState(next);
  }, []);

  const openThread = useCallback((threadId: string, title?: string) => {
    setSelectedThreadId(threadId);
    if (title?.trim()) {
      setThreadTitleState(title.trim());
    }
  }, []);

  const closeThread = useCallback(() => {
    setSelectedThreadId(null);
    setThreadTitleState('Chat');
  }, []);

  const setThreadTitle = useCallback((title: string) => {
    setThreadTitleState(title.trim() || 'Chat');
  }, []);

  const value = useMemo(
    () => ({
      active,
      setActive,
      selectedThreadId,
      threadTitle,
      openThread,
      closeThread,
      setThreadTitle,
    }),
    [active, closeThread, openThread, selectedThreadId, setActive, setThreadTitle, threadTitle],
  );

  return (
    <PortalMessengerFocusContext.Provider value={value}>
      {children}
    </PortalMessengerFocusContext.Provider>
  );
}

export function usePortalMessengerFocus() {
  return useContext(PortalMessengerFocusContext);
}
