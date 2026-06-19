import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AiChatMessage,
  AiContextSnapshot,
  AiPendingActionSummary,
  AiStatus,
} from './aiToolTypes';

type AiState = {
  sessionId: string | null;
  currentContext: AiContextSnapshot;
  pendingActions: AiPendingActionSummary[];
  lastGoal: string | null;
  lastStep: string | null;
  memorySummary: string | null;
  voiceEnabledHintDismissed: boolean;
  panelOpen: boolean;
  status: AiStatus;
  errorMessage: string | null;
  messages: AiChatMessage[];
  isTextBusy: boolean;

  setSessionId: (id: string | null) => void;
  setCurrentContext: (context: AiContextSnapshot) => void;
  addPendingAction: (action: AiPendingActionSummary) => void;
  removePendingAction: (id: string) => void;
  setProgress: (goal: string, step: string) => void;
  setMemorySummary: (summary: string | null) => void;
  dismissVoiceHint: () => void;
  setPanelOpen: (open: boolean) => void;
  setStatus: (status: AiStatus) => void;
  setErrorMessage: (message: string | null) => void;
  addMessage: (message: AiChatMessage) => void;
  setMessages: (messages: AiChatMessage[]) => void;
  clearConversation: () => void;
  setTextBusy: (busy: boolean) => void;
};

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      sessionId: null,
      currentContext: {},
      pendingActions: [],
      lastGoal: null,
      lastStep: null,
      memorySummary: null,
      voiceEnabledHintDismissed: false,
      panelOpen: false,
      status: 'ready',
      errorMessage: null,
      messages: [],
      isTextBusy: false,

      setSessionId: (id) => set({ sessionId: id }),

      setCurrentContext: (context) =>
        set((state) => ({
          currentContext: {
            ...state.currentContext,
            ...context,
          },
        })),

      addPendingAction: (action) =>
        set((state) => ({
          pendingActions: [
            action,
            ...state.pendingActions.filter(
              (existing) => existing.pending_action_id !== action.pending_action_id,
            ),
          ],
          status: 'pending',
        })),

      removePendingAction: (id) =>
        set((state) => ({
          pendingActions: state.pendingActions.filter(
            (action) => action.pending_action_id !== id,
          ),
          status: state.pendingActions.length <= 1 ? 'ready' : state.status,
        })),

      setProgress: (goal, step) =>
        set({
          lastGoal: goal,
          lastStep: step,
        }),

      setMemorySummary: (summary) => set({ memorySummary: summary }),

      dismissVoiceHint: () => set({ voiceEnabledHintDismissed: true }),

      setPanelOpen: (open) => set({ panelOpen: open }),

      setStatus: (status) => set({ status }),

      setErrorMessage: (message) =>
        set({
          errorMessage: message,
          status: message ? 'error' : 'ready',
        }),

      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),

      setMessages: (messages) => set({ messages }),

      clearConversation: () =>
        set({
          messages: [],
          sessionId: null,
          lastGoal: null,
          lastStep: null,
          memorySummary: null,
          status: 'ready',
          errorMessage: null,
        }),

      setTextBusy: (busy) =>
        set({
          isTextBusy: busy,
          status: busy ? 'thinking' : 'ready',
        }),
    }),
    {
      name: 'caresuite-ai-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        currentContext: state.currentContext,
        pendingActions: state.pendingActions,
        lastGoal: state.lastGoal,
        lastStep: state.lastStep,
        memorySummary: state.memorySummary,
        voiceEnabledHintDismissed: state.voiceEnabledHintDismissed,
        messages: state.messages.slice(-40),
      }),
    },
  ),
);
